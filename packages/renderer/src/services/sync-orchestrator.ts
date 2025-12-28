/**
 * SyncOrchestrator - Coordinates sync operations between GitHub and the rendered blog.
 * Per contracts/sync-orchestrator.ts specification.
 */

import crypto from 'crypto';
import type {
  StorageAdapter,
  NotificationAdapter,
  NotificationMessage,
  SyncStatus,
  SyncError,
  Article,
  TagIndex,
} from '@blog/core';
import { TagIndex as TagIndexClass, formatValidationError } from '@blog/core';
import type {
  GitHubContentFetcher,
  RepositoryRef,
  GitHubFile,
} from '../adapters/github-content.js';
import type { RenderService } from './render-service.js';
import type { SyncTracker } from './sync-tracker.js';

/**
 * Request to perform a sync operation.
 */
export interface SyncRequest {
  /** Type of sync operation */
  type: 'incremental' | 'full';

  /** Repository information */
  repository: RepositoryRef;

  /** For incremental: files changed in this push */
  changes?: {
    added: string[];
    modified: string[];
    removed: string[];
  };

  /** Commit hash that triggered sync (for tracking) */
  commitHash?: string;

  /** Force re-render even if content unchanged (for full syncs) */
  force?: boolean;
}

/**
 * Result of a completed sync operation.
 */
export interface SyncResult {
  /** Sync operation ID */
  syncId: string;

  /** Overall success status */
  success: boolean;

  /** Articles successfully rendered */
  articlesRendered: string[];

  /** Articles that failed rendering */
  articlesFailed: Array<{
    slug: string;
    error: string;
  }>;

  /** Articles deleted */
  articlesDeleted: string[];

  /** Tag pages regenerated */
  tagPagesGenerated: number;

  /** CloudFront invalidation status */
  cacheInvalidated: boolean;

  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Notification sent after sync completion.
 */
export interface RenderNotification {
  subject: string;
  body: string;
  severity: 'info' | 'warning' | 'error';
  metadata: {
    syncId: string;
    articlesProcessed: number;
    articlesFailed: number;
    articlesDeleted: number;
    durationMs: number;
  };
}

/**
 * CloudFront invalidation interface
 */
export interface CloudFrontInvalidator {
  createInvalidation(params: {
    DistributionId: string;
    InvalidationBatch: {
      Paths: { Quantity: number; Items: string[] };
      CallerReference: string;
    };
  }): Promise<void>;
}

/**
 * Dependencies required by SyncOrchestrator.
 */
export interface SyncOrchestratorDependencies {
  /** Fetcher for GitHub content */
  contentFetcher: Pick<
    GitHubContentFetcher,
    'fetchFile' | 'listDirectory' | 'listPostSlugs' | 'fetchPostFiles'
  >;

  /** Storage adapter for rendered content */
  storage: StorageAdapter;

  /** Notification adapter for alerts */
  notifier: NotificationAdapter;

  /** Render service for articles and tag pages */
  renderService: Pick<
    RenderService,
    | 'renderArticle'
    | 'publishArticle'
    | 'publishArticleWithRetry'
    | 'copyAssets'
    | 'copyAssetsWithRetry'
    | 'publishAllTagsPage'
    | 'publishAllTagPages'
  >;

  /** Sync tracker for status management */
  syncTracker: Pick<
    SyncTracker,
    'startSync' | 'completeSync' | 'failSync' | 'getSync' | 'getRecentSyncs'
  >;

  /** CloudFront distribution ID for cache invalidation */
  distributionId: string;

  /** CloudFront client for cache invalidation */
  cloudFront?: CloudFrontInvalidator;
}

/**
 * Orchestrates sync operations between GitHub and the rendered blog.
 */
export class SyncOrchestrator {
  private contentFetcher: SyncOrchestratorDependencies['contentFetcher'];
  private storage: StorageAdapter;
  private notifier: NotificationAdapter;
  private renderService: SyncOrchestratorDependencies['renderService'];
  private syncTracker: SyncOrchestratorDependencies['syncTracker'];
  private distributionId: string;
  private cloudFront?: CloudFrontInvalidator;

  private currentSync: SyncStatus | null = null;

  constructor(deps: SyncOrchestratorDependencies) {
    this.contentFetcher = deps.contentFetcher;
    this.storage = deps.storage;
    this.notifier = deps.notifier;
    this.renderService = deps.renderService;
    this.syncTracker = deps.syncTracker;
    this.distributionId = deps.distributionId;
    this.cloudFront = deps.cloudFront;
  }

  /**
   * Check if a sync is currently in progress.
   */
  isSyncInProgress(): boolean {
    return this.currentSync !== null && this.currentSync.status === 'in_progress';
  }

  /**
   * Get current sync status.
   */
  getCurrentSync(): SyncStatus | null {
    return this.currentSync;
  }

  /**
   * Generate a unique sync ID.
   */
  private generateSyncId(): string {
    return `sync-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Extract post slug from file path.
   * e.g., "posts/hello-world/index.md" -> "hello-world"
   */
  private extractSlugFromPath(path: string): string | undefined {
    const match = path.match(/^posts\/([^/]+)\//);
    return match ? match[1] : undefined;
  }

  /**
   * Get unique slugs from file paths.
   */
  private getUniqueSlugsFromPaths(paths: string[]): string[] {
    const slugs = new Set<string>();
    for (const path of paths) {
      const slug = this.extractSlugFromPath(path);
      if (slug) {
        slugs.add(slug);
      }
    }
    return Array.from(slugs);
  }

  /**
   * Execute a sync operation.
   */
  async sync(request: SyncRequest): Promise<SyncResult> {
    const startTime = Date.now();
    const syncId = this.generateSyncId();
    const commitHash = request.commitHash ?? 'unknown';

    // Track sync start
    this.currentSync = this.syncTracker.startSync(syncId, commitHash);

    const result: SyncResult = {
      syncId,
      success: true,
      articlesRendered: [],
      articlesFailed: [],
      articlesDeleted: [],
      tagPagesGenerated: 0,
      cacheInvalidated: false,
      durationMs: 0,
    };

    const renderedArticles: Article[] = [];
    const errors: SyncError[] = [];
    const invalidationPaths: string[] = [];

    try {
      // Determine which slugs to process
      let slugsToProcess: string[] = [];

      if (request.type === 'incremental' && request.changes) {
        // Incremental sync: process only changed files
        const addedSlugs = this.getUniqueSlugsFromPaths(request.changes.added);
        const modifiedSlugs = this.getUniqueSlugsFromPaths(request.changes.modified);
        slugsToProcess = [...new Set([...addedSlugs, ...modifiedSlugs])];

        // Handle deletions
        const deletedSlugs = this.getUniqueSlugsFromPaths(request.changes.removed);
        for (const slug of deletedSlugs) {
          await this.deletePost(slug);
          result.articlesDeleted.push(slug);
          invalidationPaths.push(`/articles/${slug}/*`);
        }
      } else {
        // Full sync: process all posts
        slugsToProcess = await this.contentFetcher.listPostSlugs(request.repository);
      }

      // Process each slug
      for (const slug of slugsToProcess) {
        try {
          const article = await this.fetchAndRenderPost(request.repository, slug);
          if (article) {
            renderedArticles.push(article);
            result.articlesRendered.push(slug);
            invalidationPaths.push(`/articles/${slug}/*`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.articlesFailed.push({ slug, error: errorMessage });
          errors.push({
            articleSlug: slug,
            errorType: 'render',
            message: errorMessage,
          });
        }
      }

      // Regenerate tag pages if any articles were rendered
      if (renderedArticles.length > 0) {
        const tagIndex = this.buildTagIndex(renderedArticles);
        await this.renderService.publishAllTagsPage(renderedArticles);
        await this.renderService.publishAllTagPages(tagIndex, renderedArticles);
        result.tagPagesGenerated = tagIndex.getAllTags().length;
        invalidationPaths.push('/tags/*');
      }

      // Invalidate CloudFront cache
      if (invalidationPaths.length > 0 && this.cloudFront) {
        try {
          await this.cloudFront.createInvalidation({
            DistributionId: this.distributionId,
            InvalidationBatch: {
              Paths: {
                Quantity: invalidationPaths.length,
                Items: invalidationPaths,
              },
              CallerReference: syncId,
            },
          });
          result.cacheInvalidated = true;
        } catch (error) {
          console.warn('Failed to invalidate CloudFront cache:', error);
        }
      }

      // Send success notification
      await this.sendSuccessNotification(result, startTime);

      // Complete sync tracking
      this.syncTracker.completeSync(
        syncId,
        result.articlesRendered.length,
        result.articlesFailed.length,
        errors
      );

      result.success = result.articlesFailed.length === 0;
    } catch (error) {
      // Send failure notification
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.sendFailureNotification(syncId, errorMessage, startTime);

      // Fail sync tracking
      this.syncTracker.failSync(syncId, {
        articleSlug: '',
        errorType: 'unknown',
        message: errorMessage,
      });

      result.success = false;
    } finally {
      result.durationMs = Date.now() - startTime;
      this.currentSync = null;
    }

    return result;
  }

  /**
   * Fetch and render a single post.
   */
  private async fetchAndRenderPost(
    repository: RepositoryRef,
    slug: string
  ): Promise<Article | null> {
    // Fetch all files for this post
    const files = await this.contentFetcher.fetchPostFiles(repository, slug);

    // Find the index.md file
    const indexFile = files.find(
      (f) => f.path.endsWith('/index.md') || f.path.endsWith(`/${slug}/index.md`)
    );

    if (!indexFile) {
      console.warn(`No index.md found for post ${slug}`);
      return null;
    }

    // Render the article
    const markdown = indexFile.content.toString('utf-8');
    const renderResult = await this.renderService.renderArticle(
      markdown,
      slug,
      indexFile.path
    );

    if (!renderResult.success) {
      throw new Error(`Failed to render ${slug}: ${formatValidationError(renderResult.error)}`);
    }

    const article = renderResult.article;

    // Skip drafts
    if (article.draft) {
      console.log(`Skipping draft: ${slug}`);
      return null;
    }

    // Publish the article
    await this.renderService.publishArticleWithRetry(article);

    // Copy assets
    await this.copyPostAssets(repository, slug, files);

    return article;
  }

  /**
   * Copy assets for a post (images, etc.).
   */
  private async copyPostAssets(
    repository: RepositoryRef,
    slug: string,
    files: GitHubFile[]
  ): Promise<void> {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
    const MAX_CUMULATIVE_SIZE = 25 * 1024 * 1024; // 25MB total
    let cumulativeSize = 0;

    for (const file of files) {
      // Skip markdown files
      if (file.path.endsWith('.md')) {
        continue;
      }

      // Check individual file size
      if (file.size > MAX_FILE_SIZE) {
        console.warn(
          `Skipping file ${file.path}: size ${file.size} exceeds maximum of ${MAX_FILE_SIZE} bytes`
        );
        continue;
      }

      // Check cumulative size
      cumulativeSize += file.size;
      if (cumulativeSize > MAX_CUMULATIVE_SIZE) {
        console.warn(
          `Cumulative asset size for ${slug} exceeds ${MAX_CUMULATIVE_SIZE} bytes, some assets may be skipped`
        );
      }

      // Determine destination path
      const relativePath = file.path.replace(`posts/${slug}/`, '');
      const destPath = `articles/${slug}/${relativePath}`;

      // Write to storage
      const contentType = this.getContentType(relativePath);
      await this.storage.write(destPath, file.content, contentType);
    }
  }

  /**
   * Delete a post from storage.
   */
  private async deletePost(slug: string): Promise<void> {
    const prefix = `articles/${slug}/`;
    const keys = await this.storage.list(prefix);

    for (const key of keys) {
      await this.storage.delete(key);
    }
  }

  /**
   * Build TagIndex from articles.
   */
  private buildTagIndex(articles: Article[]): TagIndex {
    return TagIndexClass.buildFromArticles(articles);
  }

  /**
   * Build success notification.
   */
  buildSuccessNotification(result: SyncResult, startTime: number): NotificationMessage {
    const durationMs = Date.now() - startTime;
    const hasWarnings = result.articlesFailed.length > 0;

    return {
      subject: hasWarnings ? 'Blog Sync Completed with Warnings' : 'Blog Sync Completed',
      body: [
        `Sync ${result.syncId} completed successfully.`,
        `${result.articlesRendered.length} articles processed.`,
        result.articlesFailed.length > 0
          ? `${result.articlesFailed.length} articles failed.`
          : '',
        result.articlesDeleted.length > 0
          ? `${result.articlesDeleted.length} articles deleted.`
          : '',
        `${result.tagPagesGenerated} tag pages regenerated.`,
      ]
        .filter(Boolean)
        .join('\n'),
      severity: hasWarnings ? 'warning' : 'info',
      metadata: {
        syncId: result.syncId,
        articlesProcessed: String(result.articlesRendered.length),
        articlesFailed: String(result.articlesFailed.length),
        articlesDeleted: String(result.articlesDeleted.length),
        durationMs: String(durationMs),
      },
    };
  }

  /**
   * Build failure notification.
   */
  buildFailureNotification(
    syncId: string,
    errorMessage: string,
    startTime: number
  ): NotificationMessage {
    const durationMs = Date.now() - startTime;

    return {
      subject: 'Blog Sync Failed',
      body: `Sync ${syncId} failed.\n${errorMessage}`,
      severity: 'error',
      metadata: {
        syncId,
        articlesProcessed: '0',
        articlesFailed: '0',
        articlesDeleted: '0',
        durationMs: String(durationMs),
      },
    };
  }

  /**
   * Send success notification.
   */
  private async sendSuccessNotification(result: SyncResult, startTime: number): Promise<void> {
    try {
      const notification = this.buildSuccessNotification(result, startTime);
      await this.notifier.send(notification);
    } catch (error) {
      console.warn('Failed to send success notification:', error);
    }
  }

  /**
   * Send failure notification.
   */
  private async sendFailureNotification(
    syncId: string,
    errorMessage: string,
    startTime: number
  ): Promise<void> {
    try {
      const notification = this.buildFailureNotification(syncId, errorMessage, startTime);
      await this.notifier.send(notification);
    } catch (error) {
      console.warn('Failed to send failure notification:', error);
    }
  }

  /**
   * Get MIME content type from file extension.
   */
  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      ico: 'image/x-icon',
      pdf: 'application/pdf',
      json: 'application/json',
      xml: 'application/xml',
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      zip: 'application/zip',
    };

    return contentTypes[ext ?? ''] ?? 'application/octet-stream';
  }
}
