import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import Handlebars from 'handlebars';
import {
  MarkdownParser,
  FrontMatterParser,
  ArticleIndex,
  ArticleSorter,
  ArchiveBuilder,
  Slug,
  normalizeTagSlug,
  formatDate as formatDateLong,
  type Article,
  type ParsedArticle,
} from '@blog/core';
import type { RenderedArticle, RenderError, DevServerConfig } from './types.js';
import { createRenderError, articleToRendered } from './types.js';
import { resolveConfigPaths } from './config.js';

/**
 * Template cache to avoid re-reading and compiling templates.
 */
const templateCache = new Map<string, Handlebars.TemplateDelegate>();

/**
 * Load and compile a Handlebars template.
 */
function loadTemplate(
  templatesDir: string,
  name: string
): Handlebars.TemplateDelegate {
  const cacheKey = `${templatesDir}:${name}`;
  const cached = templateCache.get(cacheKey);
  if (cached) return cached;

  const templatePath = resolve(templatesDir, `${name}.html`);
  const templateSource = readFileSync(templatePath, 'utf-8');
  const compiled = Handlebars.compile(templateSource);

  templateCache.set(cacheKey, compiled);
  return compiled;
}

/**
 * Clear the template cache (useful when templates change).
 */
export function clearTemplateCache(): void {
  templateCache.clear();
}

/**
 * Register Handlebars helpers for dev server.
 */
function registerHelpers(): void {
  // Only register once
  if (Handlebars.helpers['if']) return;

  // The 'if' and 'each' helpers are built-in, no need to register
}

/**
 * Format a date for display.
 */
function formatDateDisplay(date: Date): { dateIso: string; dateFormatted: string } {
  const dateIso = date.toISOString().split('T')[0] ?? '';
  const dateFormatted = formatDateLong(date);
  return { dateIso, dateFormatted };
}

/**
 * Get article assets (images, etc.) from the article directory.
 */
function getArticleAssets(articleDir: string): string[] {
  if (!existsSync(articleDir)) return [];

  const files = readdirSync(articleDir);
  const assetExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.pdf'];

  return files.filter((file) => {
    const ext = file.toLowerCase().substring(file.lastIndexOf('.'));
    return assetExtensions.includes(ext);
  });
}

/**
 * Render a single article to HTML.
 * Uses @blog/core MarkdownParser and FrontMatterParser.
 */
export async function renderArticle(
  config: DevServerConfig,
  filePath: string,
  articleIndex?: ArticleIndex
): Promise<{ article: RenderedArticle } | { error: RenderError }> {
  const paths = resolveConfigPaths(config);
  registerHelpers();

  try {
    // Read the markdown file
    const markdown = readFileSync(filePath, 'utf-8');

    // Parse front matter
    const fmParser = new FrontMatterParser();
    const fmResult = fmParser.parse(markdown, filePath);

    if (!fmResult.success) {
      return {
        error: {
          type: 'frontmatter',
          message: `Front matter error: ${fmResult.error.type}`,
          file: filePath,
        },
      };
    }

    // Extract slug from file path (posts/{slug}/index.md)
    const articleDir = dirname(filePath);
    const slugString = articleDir.split('/').pop() ?? '';
    const articleSlug = Slug.fromNormalized(slugString);

    // Parse markdown content to HTML
    const mdParser = new MarkdownParser({ articleIndex });
    const parseResult = await mdParser.parseWithMetadata(fmResult.content);

    // Get article assets
    const assets = getArticleAssets(articleDir);

    // Build article object
    const article: ParsedArticle = {
      slug: articleSlug,
      title: fmResult.data.title,
      date: new Date(fmResult.data.date),
      content: fmResult.content,
      html: parseResult.html,
      tags: fmResult.data.tags ?? [],
      aliases: fmResult.data.aliases ?? [],
      draft: fmResult.data.draft ?? false,
      excerpt: fmResult.data.excerpt ?? mdParser.generateExcerpt(fmResult.content),
      sourcePath: filePath,
      updatedAt: new Date(),
    };

    // Load and render article template
    const template = loadTemplate(paths.templatesDir, 'article');
    const { dateIso, dateFormatted } = formatDateDisplay(article.date);

    const html = template({
      ...article,
      content: parseResult.html,
      dateIso,
      dateFormatted,
      tags: article.tags.map((tag) => ({
        name: tag,
        slug: normalizeTagSlug(tag),
      })),
      year: new Date().getFullYear(),
    });

    return {
      article: articleToRendered(article as Article, html, assets),
    };
  } catch (err) {
    return {
      error: createRenderError('unknown', filePath, err),
    };
  }
}

/**
 * Render the blog index page.
 */
export async function renderIndex(
  config: DevServerConfig,
  articles: RenderedArticle[],
  maxArticles: number = 10
): Promise<string> {
  const paths = resolveConfigPaths(config);
  registerHelpers();

  // Sort articles by date (newest first) and filter out drafts
  const sortedArticles = ArticleSorter.sortByDate(
    articles
      .filter((a) => !a.error)
      .map((a) => ({
        slug: Slug.fromNormalized(a.slug),
        title: a.metadata.title,
        date: a.metadata.date,
        tags: a.metadata.tags,
        excerpt: a.metadata.excerpt,
        content: '',
        html: '',
        aliases: [],
        draft: false,
        sourcePath: '',
        updatedAt: new Date(),
      }))
  );

  const displayArticles = sortedArticles.slice(0, maxArticles);
  const hasMoreArticles = sortedArticles.length > maxArticles;

  const template = loadTemplate(paths.templatesDir, 'index');

  return template({
    articles: displayArticles.map((article) => {
      const { dateIso, dateFormatted } = formatDateDisplay(article.date);
      return {
        slug: article.slug.toString(),
        title: article.title,
        excerpt: article.excerpt,
        dateIso,
        dateFormatted,
        tags: article.tags.map((tag) => ({
          name: tag,
          slug: normalizeTagSlug(tag),
        })),
      };
    }),
    hasMoreArticles,
    year: new Date().getFullYear(),
  });
}

/**
 * Render the archive page.
 */
export async function renderArchive(
  config: DevServerConfig,
  articles: RenderedArticle[]
): Promise<string> {
  const paths = resolveConfigPaths(config);
  registerHelpers();

  // Convert to Article format for ArchiveBuilder
  const articleList: Article[] = articles
    .filter((a) => !a.error)
    .map((a) => ({
      slug: Slug.fromNormalized(a.slug),
      title: a.metadata.title,
      date: a.metadata.date,
      tags: a.metadata.tags,
      excerpt: a.metadata.excerpt,
      content: '',
      html: '',
      aliases: [],
      draft: false,
      sourcePath: '',
      updatedAt: new Date(),
    }));

  const archiveGroups = ArchiveBuilder.buildArchive(articleList);

  const template = loadTemplate(paths.templatesDir, 'archive');

  return template({
    totalArticles: articleList.length,
    archiveGroups: archiveGroups.map((group) => ({
      yearMonth: group.yearMonth,
      displayName: group.displayName,
      count: group.count,
      isPlural: group.count !== 1,
      articles: group.articles.map((article) => {
        const { dateIso, dateFormatted } = formatDateDisplay(article.date);
        return {
          slug: article.slug.toString(),
          title: article.title,
          dateIso,
          dateFormatted,
        };
      }),
    })),
    year: new Date().getFullYear(),
  });
}

/**
 * Render a tag page.
 */
export async function renderTagPage(
  config: DevServerConfig,
  tag: string,
  articles: RenderedArticle[]
): Promise<string> {
  const paths = resolveConfigPaths(config);
  registerHelpers();

  // Filter articles with this tag
  const taggedArticles: Article[] = articles
    .filter((a) => !a.error && a.metadata.tags.includes(tag))
    .map((a) => ({
      slug: Slug.fromNormalized(a.slug),
      title: a.metadata.title,
      date: a.metadata.date,
      tags: a.metadata.tags,
      excerpt: a.metadata.excerpt,
      content: '',
      html: '',
      aliases: [],
      draft: false,
      sourcePath: '',
      updatedAt: new Date(),
    }));

  // Sort by date
  const sortedArticles = ArticleSorter.sortByDate(taggedArticles);

  const template = loadTemplate(paths.templatesDir, 'tag');

  return template({
    tagName: tag,
    tagSlug: normalizeTagSlug(tag),
    articleCount: sortedArticles.length,
    isPlural: sortedArticles.length !== 1,
    articles: sortedArticles.map((article) => {
      const { dateIso, dateFormatted } = formatDateDisplay(article.date);
      return {
        slug: article.slug.toString(),
        title: article.title,
        excerpt: article.excerpt,
        dateIso,
        dateFormatted,
      };
    }),
    year: new Date().getFullYear(),
  });
}

/**
 * Get all unique tags from articles.
 */
export function getAllTags(articles: RenderedArticle[]): string[] {
  const tagSet = new Set<string>();
  for (const article of articles) {
    if (!article.error) {
      for (const tag of article.metadata.tags) {
        tagSet.add(tag);
      }
    }
  }
  return Array.from(tagSet).sort();
}

/**
 * Render the all tags page.
 * Per FR-006: Tags sorted alphabetically by name.
 */
export async function renderAllTags(
  config: DevServerConfig,
  articles: RenderedArticle[]
): Promise<string> {
  const paths = resolveConfigPaths(config);
  registerHelpers();

  // Build tag data with counts
  const tagMap = new Map<string, { name: string; slug: string; count: number }>();

  for (const article of articles) {
    if (article.error) continue;

    for (const tag of article.metadata.tags) {
      const slug = normalizeTagSlug(tag);
      const existing = tagMap.get(slug);
      if (existing) {
        existing.count++;
      } else {
        tagMap.set(slug, { name: tag, slug, count: 1 });
      }
    }
  }

  // Sort alphabetically by name (case-insensitive)
  const sortedTags = Array.from(tagMap.values()).sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );

  const template = loadTemplate(paths.templatesDir, 'tags');

  return template({
    totalTags: sortedTags.length,
    tags: sortedTags,
    year: new Date().getFullYear(),
  });
}

/**
 * Scan posts directory and render all articles.
 */
export async function scanAndRenderAll(
  config: DevServerConfig
): Promise<{
  articles: Map<string, RenderedArticle>;
  errors: RenderError[];
}> {
  const paths = resolveConfigPaths(config);
  const articles = new Map<string, RenderedArticle>();
  const errors: RenderError[] = [];

  if (!existsSync(paths.postsDir)) {
    return { articles, errors };
  }

  // First pass: scan all articles to build index
  const articleList: Article[] = [];
  const postDirs = readdirSync(paths.postsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  // Parse all articles first (without index for initial pass)
  for (const slug of postDirs) {
    const indexPath = join(paths.postsDir, slug, 'index.md');
    if (!existsSync(indexPath)) continue;

    const result = await renderArticle(config, indexPath);
    if ('article' in result && !result.article.error) {
      // Store for index building
      articleList.push({
        slug: Slug.fromNormalized(result.article.slug),
        title: result.article.metadata.title,
        date: result.article.metadata.date,
        content: '',
        html: result.article.html,
        tags: result.article.metadata.tags,
        aliases: [],
        draft: false,
        excerpt: result.article.metadata.excerpt,
        sourcePath: indexPath,
        updatedAt: new Date(),
      });
    }
  }

  // Build article index for wikilink resolution
  const articleIndex = ArticleIndex.buildFromArticles(articleList);

  // Second pass: render with wikilink resolution
  for (const slug of postDirs) {
    const indexPath = join(paths.postsDir, slug, 'index.md');
    if (!existsSync(indexPath)) continue;

    const result = await renderArticle(config, indexPath, articleIndex);
    if ('article' in result) {
      articles.set(slug, result.article);
    } else {
      errors.push(result.error);
    }
  }

  return { articles, errors };
}
