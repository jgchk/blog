import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import Handlebars from 'handlebars';
import {
  FrontMatterParser,
  MarkdownParser,
  TagIndex,
  normalizeTagSlug,
  type Article,
} from '@blog/core';
import { LocalStorageAdapter } from '../adapters/local-storage.js';
import type {
  PipelineOptions,
  PipelineOutput,
  PipelineRenderResult,
  PipelineState,
} from './pipeline-types.js';

/**
 * Pipeline renderer for full-site rendering in CI/CD.
 * Renders all posts, tag pages, and home page to local filesystem.
 */
export class PipelineRenderer {
  private postsDir: string;
  private outputDir: string;
  private templatesDir: string;
  private s3Bucket?: string;
  private cloudfrontId?: string;
  private logger: (message: string) => void;
  private state: PipelineState = 'INIT';

  private frontMatterParser: FrontMatterParser;
  private markdownParser: MarkdownParser;
  private sourceStorage: LocalStorageAdapter;
  private outputStorage: LocalStorageAdapter;

  // Compiled Handlebars templates
  private articleTemplate!: Handlebars.TemplateDelegate;
  private homeTemplate!: Handlebars.TemplateDelegate;
  private tagTemplate!: Handlebars.TemplateDelegate;
  private tagsTemplate!: Handlebars.TemplateDelegate;

  constructor(options: PipelineOptions = {}) {
    this.postsDir = options.postsDir ?? './posts';
    this.outputDir = options.outputDir ?? './rendered';
    this.templatesDir = options.templatesDir ?? './packages/site/src/templates';
    this.s3Bucket = options.s3Bucket;
    this.cloudfrontId = options.cloudfrontId;
    this.logger = options.logger ?? console.log;

    this.frontMatterParser = new FrontMatterParser();
    this.markdownParser = new MarkdownParser();
    this.sourceStorage = new LocalStorageAdapter(this.postsDir);
    this.outputStorage = new LocalStorageAdapter(this.outputDir);
  }

  /**
   * Log a progress message with timestamp.
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.logger(`[${timestamp}] ${message}`);
  }

  /**
   * Log a state transition.
   */
  private setState(newState: PipelineState): void {
    this.state = newState;
    this.log(`State: ${newState}`);
  }

  /**
   * Discover all posts in the posts directory.
   * Returns list of post slugs (directory names).
   */
  async discoverPosts(): Promise<string[]> {
    this.log(`Discovering posts in ${this.postsDir}`);
    const slugs = await this.sourceStorage.listDirectories('');

    // Filter to only directories that contain index.md
    const validSlugs: string[] = [];
    for (const slug of slugs) {
      const hasIndex = await this.sourceStorage.exists(`${slug}/index.md`);
      if (hasIndex) {
        validSlugs.push(slug);
      }
    }

    this.log(`Found ${validSlugs.length} posts`);
    return validSlugs;
  }

  /**
   * Read and parse a single post.
   */
  async readPost(slug: string): Promise<Article | null> {
    const sourcePath = `${slug}/index.md`;
    try {
      const content = await this.sourceStorage.read(sourcePath);
      const markdown = content.toString('utf-8');

      const parseResult = this.frontMatterParser.parse(markdown, sourcePath);
      if (!parseResult.success) {
        this.log(`Parse error for ${slug}: ${parseResult.error.type}`);
        return null;
      }

      const { data: frontMatter, content: markdownContent } = parseResult;

      // Skip drafts
      if (frontMatter.draft) {
        this.log(`Skipping draft: ${slug}`);
        return null;
      }

      const html = await this.markdownParser.parse(markdownContent);
      const excerpt = frontMatter.excerpt ?? this.markdownParser.generateExcerpt(markdownContent);

      const article: Article = {
        slug,
        title: frontMatter.title,
        date: new Date(frontMatter.date),
        content: markdownContent,
        html,
        tags: frontMatter.tags ?? [],
        aliases: frontMatter.aliases ?? [],
        draft: frontMatter.draft ?? false,
        excerpt,
        sourcePath,
        updatedAt: new Date(),
      };

      return article;
    } catch (error) {
      this.log(`Error reading ${slug}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Read all posts from the posts directory.
   */
  async readAllPosts(): Promise<Article[]> {
    const slugs = await this.discoverPosts();
    const articles: Article[] = [];

    for (const slug of slugs) {
      const article = await this.readPost(slug);
      if (article) {
        articles.push(article);
      }
    }

    // Sort by date descending (newest first)
    articles.sort((a, b) => b.date.getTime() - a.date.getTime());

    this.log(`Read ${articles.length} articles`);
    return articles;
  }

  /**
   * Load and compile Handlebars templates.
   */
  async loadTemplates(): Promise<void> {
    this.log('Loading templates');

    const loadTemplate = async (name: string): Promise<Handlebars.TemplateDelegate> => {
      const templatePath = path.join(this.templatesDir, `${name}.html`);
      const content = await fs.readFile(templatePath, 'utf-8');
      return Handlebars.compile(content);
    };

    this.articleTemplate = await loadTemplate('article');
    this.homeTemplate = await loadTemplate('index');
    this.tagTemplate = await loadTemplate('tag');
    this.tagsTemplate = await loadTemplate('tags');

    this.log('Templates loaded');
  }

  /**
   * Render a single article to HTML.
   */
  renderArticleHtml(article: Article): string {
    const year = new Date().getFullYear();
    const dateIso = article.date.toISOString().split('T')[0];
    const dateFormatted = article.date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const tags = article.tags.map(tag => ({
      name: tag,
      slug: normalizeTagSlug(tag),
    }));

    return this.articleTemplate({
      title: article.title,
      dateIso,
      dateFormatted,
      excerpt: article.excerpt,
      content: article.html,
      tags,
      year,
    });
  }

  /**
   * Copy co-located assets for an article.
   */
  async copyAssets(slug: string): Promise<string[]> {
    const assets: string[] = [];
    const files = await this.sourceStorage.list(`${slug}/`);

    for (const file of files) {
      // Skip markdown files
      if (file.endsWith('.md')) continue;

      const relativePath = file.slice(`${slug}/`.length);
      const destPath = `posts/${slug}/${relativePath}`;

      const content = await this.sourceStorage.read(file);
      await this.outputStorage.write(destPath, content);
      assets.push(destPath);
    }

    return assets;
  }

  /**
   * Render all posts to output directory.
   */
  async renderAllPosts(articles: Article[]): Promise<PipelineRenderResult[]> {
    this.log(`Rendering ${articles.length} posts`);
    const results: PipelineRenderResult[] = [];

    for (const [index, article] of articles.entries()) {
      const startTime = Date.now();

      try {
        // Render HTML
        const html = this.renderArticleHtml(article);
        const htmlPath = `posts/${article.slug}/index.html`;
        await this.outputStorage.write(htmlPath, Buffer.from(html, 'utf-8'));

        // Copy assets
        const assetPaths = await this.copyAssets(article.slug);

        const duration = Date.now() - startTime;
        results.push({
          slug: article.slug,
          success: true,
          htmlPath,
          assetPaths,
          duration,
        });

        this.log(`[${index + 1}/${articles.length}] Rendered ${article.slug} (${duration}ms)`);
      } catch (error) {
        const duration = Date.now() - startTime;
        results.push({
          slug: article.slug,
          success: false,
          htmlPath: '',
          assetPaths: [],
          error: error instanceof Error ? error : new Error('Unknown error'),
          duration,
        });

        this.log(`[${index + 1}/${articles.length}] FAILED ${article.slug}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return results;
  }

  /**
   * Generate tag index from articles.
   */
  generateTagIndex(articles: Article[]): TagIndex {
    return TagIndex.buildFromArticles(articles);
  }

  /**
   * Render all tag pages.
   */
  async renderAllTagPages(articles: Article[], tagIndex: TagIndex): Promise<number> {
    const tags = tagIndex.getAllTags();
    this.log(`Rendering ${tags.length} tag pages`);

    const year = new Date().getFullYear();

    for (const tag of tags) {
      // Get articles for this tag
      const tagArticles = articles.filter(article =>
        article.tags.some(t => normalizeTagSlug(t) === tag.slug)
      ).sort((a, b) => b.date.getTime() - a.date.getTime());

      const html = this.tagTemplate({
        tagName: tag.name,
        tagSlug: tag.slug,
        articleCount: tagArticles.length,
        isPlural: tagArticles.length !== 1,
        articles: tagArticles.map(article => ({
          slug: article.slug,
          title: article.title,
          dateIso: article.date.toISOString().split('T')[0],
          dateFormatted: article.date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          excerpt: article.excerpt,
        })),
        year,
      });

      await this.outputStorage.write(
        `tags/${tag.slug}.html`,
        Buffer.from(html, 'utf-8')
      );
    }

    return tags.length;
  }

  /**
   * Render the all-tags index page.
   */
  async renderAllTagsPage(tagIndex: TagIndex): Promise<void> {
    this.log('Rendering all tags page');

    const tags = tagIndex.getAllTags().map(tag => ({
      name: tag.name,
      slug: tag.slug,
      count: tag.count,
    }));

    // Sort alphabetically by name
    tags.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    const year = new Date().getFullYear();

    const html = this.tagsTemplate({
      tags,
      totalTags: tags.length,
      year,
    });

    await this.outputStorage.write(
      'tags/index.html',
      Buffer.from(html, 'utf-8')
    );
  }

  /**
   * Render the home page.
   */
  async renderHomePage(articles: Article[]): Promise<void> {
    this.log('Rendering home page');

    // Show most recent 10 articles
    const recentArticles = articles.slice(0, 10);
    const year = new Date().getFullYear();

    const html = this.homeTemplate({
      articles: recentArticles.map(article => ({
        slug: article.slug,
        title: article.title,
        dateIso: article.date.toISOString().split('T')[0],
        dateFormatted: article.date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        excerpt: article.excerpt,
        tags: article.tags.map(tag => ({
          name: tag,
          slug: normalizeTagSlug(tag),
        })),
      })),
      hasMoreArticles: articles.length > 10,
      year,
    });

    await this.outputStorage.write(
      'index.html',
      Buffer.from(html, 'utf-8')
    );
  }

  /**
   * Execute the full pipeline.
   * Per FR-007: Fail-fast on any render error.
   */
  async execute(): Promise<PipelineOutput> {
    const startTime = Date.now();
    const errors: Array<{ slug: string; message: string }> = [];

    try {
      this.setState('INIT');

      // Load templates
      await this.loadTemplates();

      // Read all posts
      this.setState('READING');
      const articles = await this.readAllPosts();

      if (articles.length === 0) {
        this.log('No articles found');
        return {
          success: true,
          duration: Date.now() - startTime,
          postsRendered: 0,
          postsFailed: 0,
          assetsUploaded: 0,
          tagPagesGenerated: 0,
          invalidationId: null,
          errors: [],
        };
      }

      // Render all posts
      this.setState('RENDERING');
      const results = await this.renderAllPosts(articles);

      // Check for failures - fail-fast per FR-007
      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        for (const failure of failures) {
          errors.push({
            slug: failure.slug,
            message: failure.error?.message ?? 'Unknown error',
          });
        }

        // Fail-fast: stop on first error
        this.setState('FAILED');
        // firstError is guaranteed to exist since failures.length > 0
        const firstError = failures[0]!;
        throw new Error(`Render failed for ${firstError.slug}: ${firstError.error?.message ?? 'Unknown error'}`);
      }

      // Build tag index
      const tagIndex = this.generateTagIndex(articles);

      // Render tag pages
      const tagPagesCount = await this.renderAllTagPages(articles, tagIndex);

      // Render all-tags page
      await this.renderAllTagsPage(tagIndex);

      // Render home page
      await this.renderHomePage(articles);

      // Calculate totals
      const totalAssets = results.reduce((sum, r) => sum + r.assetPaths.length, 0);

      this.setState('COMPLETE');

      const duration = Date.now() - startTime;
      this.log(`Pipeline complete: ${results.length} posts, ${tagPagesCount} tag pages in ${duration}ms`);

      return {
        success: true,
        duration,
        postsRendered: results.length,
        postsFailed: 0,
        assetsUploaded: totalAssets,
        tagPagesGenerated: tagPagesCount,
        invalidationId: null,
        errors: [],
      };
    } catch (error) {
      this.setState('FAILED');
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.log(`Pipeline failed: ${message}`);

      return {
        success: false,
        duration,
        postsRendered: 0,
        postsFailed: errors.length || 1,
        assetsUploaded: 0,
        tagPagesGenerated: 0,
        invalidationId: null,
        errors: errors.length > 0 ? errors : [{ slug: 'unknown', message }],
      };
    }
  }
}
