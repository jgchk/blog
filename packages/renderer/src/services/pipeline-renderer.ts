import { FrontMatterParser, MarkdownParser } from '@blog/core/authoring';
import {
  ArchiveBuilder,
  ArticleFactory,
  Slug,
  TagIndex,
  type Article,
} from '@blog/core/publishing';
import { LocalStorageAdapter } from '../adapters/local-storage.js';
import type {
  PipelineOptions,
  PipelineOutput,
  PipelineRenderResult,
  PipelineState,
} from './pipeline-types.js';
import { TemplateRenderer } from './template-renderer.js';

/**
 * Pipeline renderer for full-site rendering in CI/CD.
 * Renders all posts, tag pages, and home page to local filesystem.
 */
export class PipelineRenderer {
  private postsDir: string;
  private outputDir: string;
  private templatesDir: string;
  private siteDir?: string;
  private s3Bucket?: string;
  private cloudfrontId?: string;
  private logger: (message: string) => void;
  private state: PipelineState = 'INIT';

  private frontMatterParser: FrontMatterParser;
  private markdownParser: MarkdownParser;
  private articleFactory: ArticleFactory;
  private sourceStorage: LocalStorageAdapter;
  private outputStorage: LocalStorageAdapter;
  private templateRenderer: TemplateRenderer;

  constructor(options: PipelineOptions = {}) {
    this.postsDir = options.postsDir ?? './posts';
    this.outputDir = options.outputDir ?? './rendered';
    this.templatesDir = options.templatesDir ?? './packages/site/src/templates';
    this.siteDir = options.siteDir;
    this.s3Bucket = options.s3Bucket;
    this.cloudfrontId = options.cloudfrontId;
    this.logger = options.logger ?? console.log;

    this.frontMatterParser = new FrontMatterParser();
    this.markdownParser = new MarkdownParser();
    this.articleFactory = new ArticleFactory();
    this.sourceStorage = new LocalStorageAdapter(this.postsDir);
    this.outputStorage = new LocalStorageAdapter(this.outputDir);
    this.templateRenderer = new TemplateRenderer(this.templatesDir);
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

      // Create Slug from directory name (already normalized by filesystem)
      const articleSlug = Slug.fromNormalized(slug);

      // Stage 1: Create ParsedArticle from front matter and content
      const parsedArticle = this.articleFactory.createParsedArticle({
        frontMatter,
        content: markdownContent,
        slug: articleSlug,
        sourcePath,
      });

      // Stage 2: Render markdown to HTML and create Article
      const html = await this.markdownParser.parse(markdownContent);
      const article = this.articleFactory.createArticle(parsedArticle, html);

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
   * Preload and cache all templates for fail-fast error detection.
   */
  async loadTemplates(): Promise<void> {
    this.log('Loading templates');

    // Preload all templates to catch errors early
    await Promise.all([
      this.templateRenderer.loadTemplate('article'),
      this.templateRenderer.loadTemplate('index'),
      this.templateRenderer.loadTemplate('tag'),
      this.templateRenderer.loadTemplate('tags'),
      this.templateRenderer.loadTemplate('archive'),
    ]);

    this.log('Templates loaded');
  }

  /**
   * Render a single article to HTML.
   */
  async renderArticleHtml(article: Article): Promise<string> {
    return this.templateRenderer.renderArticle(article);
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
      const destPath = `articles/${slug}/${relativePath}`;

      const content = await this.sourceStorage.read(file);
      await this.outputStorage.write(destPath, content);
      assets.push(destPath);
    }

    return assets;
  }

  /**
   * Copy site-wide static assets (fonts, CSS) to output directory.
   */
  async copySiteAssets(): Promise<string[]> {
    if (!this.siteDir) {
      return [];
    }

    const assets: string[] = [];
    const siteStorage = new LocalStorageAdapter(this.siteDir);

    // Copy fonts from src/fonts to fonts/
    const fontsDir = 'src/fonts';
    try {
      const fontFiles = await siteStorage.list(`${fontsDir}/`);
      for (const file of fontFiles) {
        const relativePath = file.slice(`${fontsDir}/`.length);
        const destPath = `fonts/${relativePath}`;

        const content = await siteStorage.read(file);
        await this.outputStorage.write(destPath, content);
        assets.push(destPath);
      }
    } catch {
      // Fonts directory may not exist
    }

    // Copy CSS from src/styles to assets/styles/
    const stylesDir = 'src/styles';
    try {
      const styleFiles = await siteStorage.list(`${stylesDir}/`);
      for (const file of styleFiles) {
        const relativePath = file.slice(`${stylesDir}/`.length);
        const destPath = `assets/styles/${relativePath}`;

        const content = await siteStorage.read(file);
        await this.outputStorage.write(destPath, content);
        assets.push(destPath);
      }
    } catch {
      // Styles directory may not exist
    }

    // Copy images from src/images to assets/images/
    const imagesDir = 'src/images';
    try {
      const imageFiles = await siteStorage.list(`${imagesDir}/`);
      for (const file of imageFiles) {
        const relativePath = file.slice(`${imagesDir}/`.length);
        const destPath = `assets/images/${relativePath}`;

        const content = await siteStorage.read(file);
        await this.outputStorage.write(destPath, content);
        assets.push(destPath);
      }
    } catch {
      // Images directory may not exist
    }

    // Copy favicons from src/favicons to assets/favicons/
    const faviconsDir = 'src/favicons';
    try {
      const faviconFiles = await siteStorage.list(`${faviconsDir}/`);
      for (const file of faviconFiles) {
        const relativePath = file.slice(`${faviconsDir}/`.length);
        const destPath = `assets/favicons/${relativePath}`;

        const content = await siteStorage.read(file);
        await this.outputStorage.write(destPath, content);
        assets.push(destPath);
      }
    } catch {
      // Favicons directory may not exist
    }

    this.log(`Copied ${assets.length} site assets`);
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

      const slugString = article.slug.toString();

      try {
        // Render HTML
        const html = await this.renderArticleHtml(article);
        const htmlPath = `articles/${slugString}/index.html`;
        await this.outputStorage.write(htmlPath, Buffer.from(html, 'utf-8'));

        // Copy assets
        const assetPaths = await this.copyAssets(slugString);

        const duration = Date.now() - startTime;
        results.push({
          slug: slugString,
          success: true,
          htmlPath,
          assetPaths,
          duration,
        });

        this.log(`[${index + 1}/${articles.length}] Rendered ${slugString} (${duration}ms)`);
      } catch (error) {
        const duration = Date.now() - startTime;
        results.push({
          slug: slugString,
          success: false,
          htmlPath: '',
          assetPaths: [],
          error: error instanceof Error ? error : new Error('Unknown error'),
          duration,
        });

        this.log(`[${index + 1}/${articles.length}] FAILED ${slugString}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

    for (const tag of tags) {
      // Get articles for this tag
      const tagArticles = articles.filter(article =>
        article.tags.some(t => t.slug === tag.slug)
      );

      const html = await this.templateRenderer.renderTagPage(tag, tagArticles);

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

    const html = await this.templateRenderer.renderAllTagsPage(tags);

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
    const hasMoreArticles = articles.length > 10;

    const html = await this.templateRenderer.renderHomePage(recentArticles, hasMoreArticles);

    await this.outputStorage.write(
      'index.html',
      Buffer.from(html, 'utf-8')
    );
  }

  /**
   * Render the archive page.
   */
  async renderArchivePage(articles: Article[]): Promise<void> {
    this.log('Rendering archive page');

    const archiveGroups = ArchiveBuilder.buildArchive(articles);
    const totalArticles = articles.length;

    const html = await this.templateRenderer.renderArchivePage(archiveGroups, totalArticles);

    await this.outputStorage.write(
      'archive/index.html',
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

      // Render archive page
      await this.renderArchivePage(articles);

      // Copy site-wide assets (fonts, CSS)
      const siteAssets = await this.copySiteAssets();

      // Calculate totals
      const totalAssets = results.reduce((sum, r) => sum + r.assetPaths.length, 0) + siteAssets.length;

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
