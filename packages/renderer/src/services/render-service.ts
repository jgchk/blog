import {
  FrontMatterParser,
  MarkdownParser,
  type Article,
  type StorageAdapter,
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
