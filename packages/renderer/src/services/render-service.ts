import {
  FrontMatterParser,
  MarkdownParser,
  normalizeTagSlug,
  TagIndex,
  type Article,
  type StorageAdapter,
  type Tag,
  type ValidationError,
} from '@blog/core';
import { RetryHandler, type RetryOptions, type RetryResult } from './retry-handler.js';

/**
 * Options for RenderService
 */
export interface RenderServiceOptions {
  /** Source storage adapter (for reading source files) */
  sourceStorage?: StorageAdapter;
  /** Retry options for failed operations */
  retryOptions?: RetryOptions;
  /** Custom sleep function for testing */
  sleepFn?: (ms: number) => Promise<void>;
}

/**
 * Legacy alias for AssetCopyOptions
 * @deprecated Use RenderServiceOptions instead
 */
export type AssetCopyOptions = Pick<RenderServiceOptions, 'sourceStorage'>;

/**
 * Result of copying assets
 */
export interface AssetCopyResult {
  copied: string[];
  failed: Array<{ path: string; error: string }>;
}

/**
 * Result of rendering an article
 */
export type RenderResult =
  | { success: true; article: Article }
  | { success: false; error: ValidationError };

/**
 * Result of publishing with retry
 */
export interface PublishResult {
  success: boolean;
  attempts: number;
  errors?: Error[];
}

/**
 * Orchestrates the markdown → HTML rendering pipeline.
 * Per research.md specification.
 */
export class RenderService {
  private frontMatterParser: FrontMatterParser;
  private markdownParser: MarkdownParser;
  private storage: StorageAdapter;
  private sourceStorage: StorageAdapter | undefined;
  private retryHandler: RetryHandler;

  constructor(storage: StorageAdapter, options?: RenderServiceOptions) {
    this.frontMatterParser = new FrontMatterParser();
    this.markdownParser = new MarkdownParser();
    this.storage = storage;
    this.sourceStorage = options?.sourceStorage;
    this.retryHandler = new RetryHandler(options?.retryOptions, options?.sleepFn);
  }

  /**
   * Render a markdown file to an Article
   * @param markdown - Raw markdown content with front matter
   * @param slug - Article slug (from folder name)
   * @param sourcePath - Path to source file
   */
  async renderArticle(
    markdown: string,
    slug: string,
    sourcePath: string = `posts/${slug}/index.md`
  ): Promise<RenderResult> {
    // Parse front matter
    const parseResult = this.frontMatterParser.parse(markdown, sourcePath);

    if (!parseResult.success) {
      return { success: false, error: parseResult.error };
    }

    const { data: frontMatter, content } = parseResult;

    // Render markdown to HTML
    const html = await this.markdownParser.parse(content);

    // Generate excerpt
    const excerpt =
      frontMatter.excerpt ?? this.markdownParser.generateExcerpt(content);

    // Build article
    const article: Article = {
      slug,
      title: frontMatter.title,
      date: new Date(frontMatter.date),
      content,
      html,
      tags: frontMatter.tags ?? [],
      aliases: frontMatter.aliases ?? [],
      draft: frontMatter.draft ?? false,
      excerpt,
      sourcePath,
      updatedAt: new Date(),
    };

    return { success: true, article };
  }

  /**
   * Publish a rendered article to storage
   */
  async publishArticle(article: Article): Promise<void> {
    // Generate full HTML page
    const htmlPage = this.wrapInTemplate(article);

    // Write to storage
    await this.storage.write(
      `articles/${article.slug}/index.html`,
      Buffer.from(htmlPage, 'utf-8'),
      'text/html'
    );
  }

  /**
   * Publish a rendered article to storage with retry logic.
   * Per FR-013: 3 retries with 1s, 2s, 4s exponential backoff.
   * @param article - The article to publish
   * @returns PublishResult with success status and attempt count
   */
  async publishArticleWithRetry(article: Article): Promise<PublishResult> {
    const result = await this.retryHandler.execute(async () => {
      await this.publishArticle(article);
    });

    return {
      success: result.success,
      attempts: result.attempts,
      errors: result.success ? undefined : result.errors,
    };
  }

  /**
   * Copy assets with retry logic.
   * Per FR-013: 3 retries with exponential backoff for failed operations.
   * @param slug - Article slug (folder name)
   * @param sourceDir - Source directory prefix (default: 'posts')
   * @returns RetryResult with AssetCopyResult
   */
  async copyAssetsWithRetry(
    slug: string,
    sourceDir: string = 'posts'
  ): Promise<RetryResult<AssetCopyResult>> {
    return this.retryHandler.execute(async () => {
      return this.copyAssets(slug, sourceDir);
    });
  }

  /**
   * Copy co-located assets (images, files) from source post folder to output.
   * Per FR-012: resolve relative paths for images and assets.
   * @param slug - Article slug (folder name)
   * @param sourceDir - Source directory prefix (default: 'posts')
   */
  async copyAssets(slug: string, sourceDir: string = 'posts'): Promise<AssetCopyResult> {
    const result: AssetCopyResult = { copied: [], failed: [] };

    if (!this.sourceStorage) {
      return result;
    }

    const sourcePrefix = `${sourceDir}/${slug}/`;
    const destPrefix = `articles/${slug}/`;

    try {
      // List all files in the source post folder
      const sourceFiles = await this.sourceStorage.list(sourcePrefix);

      for (const sourcePath of sourceFiles) {
        // Skip the index.md file - only copy assets
        if (sourcePath.endsWith('/index.md') || sourcePath.endsWith('.md')) {
          continue;
        }

        // Get relative path from source folder
        const relativePath = sourcePath.slice(sourcePrefix.length);
        if (!relativePath) {
          continue;
        }

        const destPath = `${destPrefix}${relativePath}`;

        try {
          // Read source file
          const content = await this.sourceStorage.read(sourcePath);

          // Determine content type from extension
          const contentType = this.getContentType(relativePath);

          // Write to destination
          await this.storage.write(destPath, content, contentType);

          result.copied.push(relativePath);
        } catch (error) {
          result.failed.push({
            path: relativePath,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } catch (error) {
      // If we can't list the source directory, return empty result
      // This is not necessarily an error - the directory might not have assets
      console.warn(
        `Could not list assets for ${slug}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return result;
  }

  /**
   * Get MIME content type from file extension
   */
  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      // Images
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      ico: 'image/x-icon',
      // Documents
      pdf: 'application/pdf',
      // Data
      json: 'application/json',
      xml: 'application/xml',
      // Web
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      // Archives
      zip: 'application/zip',
      // Default
    };

    return contentTypes[ext ?? ''] ?? 'application/octet-stream';
  }

  /**
   * Render all tags page from articles
   * Per FR-006: Tags sorted alphabetically by name
   * @param articles - Array of articles to extract tags from
   * @returns Rendered HTML string
   */
  renderAllTagsPage(articles: Article[]): string {
    // Build tag data with counts
    const tagMap = new Map<string, { name: string; slug: string; count: number }>();

    for (const article of articles) {
      for (const tag of article.tags) {
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

    return this.wrapAllTagsInTemplate(sortedTags);
  }

  /**
   * Publish rendered all-tags page to storage
   * Outputs to tags/index.html
   * @param articles - Array of articles to extract tags from
   */
  async publishAllTagsPage(articles: Article[]): Promise<void> {
    const html = this.renderAllTagsPage(articles);

    await this.storage.write(
      'tags/index.html',
      Buffer.from(html, 'utf-8'),
      'text/html'
    );
  }

  /**
   * Render a single tag page with its articles
   * Per FR-007: Tag page displays tag name, article count, and article list sorted by date descending
   * @param tag - Tag entity with slug and name
   * @param articles - Articles with this tag
   * @returns Rendered HTML string
   */
  renderTagPage(tag: Tag, articles: Article[]): string {
    // Sort articles by date (newest first)
    const sortedArticles = [...articles].sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );

    return this.wrapTagPageInTemplate(tag, sortedArticles);
  }

  /**
   * Publish a single tag page to storage
   * Outputs to tags/{slug}.html
   * Per FR-005: Tag slug is normalized to lowercase
   * @param tag - Tag entity
   * @param articles - Articles with this tag
   */
  async publishTagPage(tag: Tag, articles: Article[]): Promise<void> {
    // Skip tags with no articles (orphaned tags)
    if (articles.length === 0) {
      console.warn(`Skipping tag "${tag.name}" - no articles found`);
      return;
    }

    const html = this.renderTagPage(tag, articles);
    // Ensure slug is lowercase for S3 key consistency
    const slug = tag.slug.toLowerCase();

    await this.storage.write(
      `tags/${slug}.html`,
      Buffer.from(html, 'utf-8'),
      'text/html'
    );
  }

  /**
   * Publish all individual tag pages to storage
   * Iterates through all tags in the TagIndex and generates a page for each
   * @param tagIndex - Complete tag index
   * @param articles - All articles in the system
   */
  async publishAllTagPages(tagIndex: TagIndex, articles: Article[]): Promise<void> {
    const allTags = tagIndex.getAllTags();

    for (const tag of allTags) {
      // Get articles for this specific tag
      const tagArticles = articles.filter((article) =>
        article.tags.some((t) => normalizeTagSlug(t) === tag.slug)
      );

      await this.publishTagPage(tag, tagArticles);
    }
  }

  /**
   * Wrap tag page HTML in a full page template
   * Per FR-007: TagPageContext structure
   * Per FR-008: Article links use /articles/{slug}/ pattern, tag links use /tags/{slug}.html pattern
   */
  private wrapTagPageInTemplate(tag: Tag, articles: Article[]): string {
    const year = new Date().getFullYear();
    const articleCount = articles.length;
    const isPlural = articleCount !== 1;

    const articleListHtml =
      articles.length > 0
        ? `<section aria-label="Tagged articles">
      ${articles
        .map(
          (article) => `<article>
        <h2><a href="/articles/${article.slug}/">${this.escapeHtml(article.title)}</a></h2>
        <time datetime="${article.date.toISOString().split('T')[0]}">${this.formatDate(article.date)}</time>
        <p>${this.escapeHtml(article.excerpt)}</p>
      </article>`
        )
        .join('\n      ')}
    </section>`
        : '<p>No articles found with this tag.</p>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Articles tagged with ${this.escapeHtml(tag.name)}">
  <title>Tag: ${this.escapeHtml(tag.name)}</title>
  <link rel="stylesheet" href="/assets/styles/main.css">
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>

  <header role="banner">
    <nav aria-label="Main navigation">
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/archive.html">Archive</a></li>
        <li><a href="/tags/">Tags</a></li>
      </ul>
    </nav>
  </header>

  <main id="main-content" role="main">
    <h1>Tag: ${this.escapeHtml(tag.name)}</h1>
    <p>${articleCount} ${isPlural ? 'articles' : 'article'} tagged with "${this.escapeHtml(tag.name)}"</p>

    ${articleListHtml}

    <nav aria-label="Tag navigation">
      <a href="/tags/">View all tags</a>
    </nav>
  </main>

  <footer role="contentinfo">
    <p>&copy; ${year} Blog. All rights reserved.</p>
  </footer>
</body>
</html>`;
  }

  /**
   * Wrap all tags HTML in a full page template
   */
  private wrapAllTagsInTemplate(tags: Array<{ name: string; slug: string; count: number }>): string {
    const year = new Date().getFullYear();
    const totalTags = tags.length;

    const tagListHtml = tags.length > 0
      ? `<p>Showing ${totalTags} tags</p>
    <nav aria-label="Tag cloud">
      <ul class="tag-cloud" role="list">
        ${tags.map(tag => `<li>
          <a href="/tags/${tag.slug}.html" aria-label="${this.escapeHtml(tag.name)} (${tag.count} articles)">
            ${this.escapeHtml(tag.name)} <span class="tag-count">(${tag.count})</span>
          </a>
        </li>`).join('\n        ')}
      </ul>
    </nav>`
      : '<p>No tags yet. Check back after articles are published.</p>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="All tags on the blog">
  <title>All Tags</title>
  <link rel="stylesheet" href="/assets/styles/main.css">
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>

  <header role="banner">
    <nav aria-label="Main navigation">
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/archive.html">Archive</a></li>
        <li><a href="/tags/" aria-current="page">Tags</a></li>
      </ul>
    </nav>
  </header>

  <main id="main-content" role="main">
    <h1>All Tags</h1>
    ${tagListHtml}
  </main>

  <footer role="contentinfo">
    <p>&copy; ${year} Blog. All rights reserved.</p>
  </footer>
</body>
</html>`;
  }

  /**
   * Wrap article HTML in a full page template
   */
  private wrapInTemplate(article: Article): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${this.escapeHtml(article.excerpt)}">
  <title>${this.escapeHtml(article.title)}</title>
  <link rel="stylesheet" href="/assets/styles/main.css">
</head>
<body>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/archive.html">Archive</a>
      <a href="/tags/">Tags</a>
    </nav>
  </header>
  <main>
    <article>
      <header>
        <h1>${this.escapeHtml(article.title)}</h1>
        <time datetime="${article.date.toISOString().split('T')[0]}">${this.formatDate(article.date)}</time>
        ${article.tags.length > 0 ? `<div class="tags">${article.tags.map((t) => `<a href="/tags/${this.slugify(t)}.html">${this.escapeHtml(t)}</a>`).join(' ')}</div>` : ''}
      </header>
      <div class="content">
        ${article.html}
      </div>
    </article>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()}</p>
  </footer>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }
}
