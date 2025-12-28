/**
 * SyncOrchestrator Interface Contract
 *
 * Defines the contract for orchestrating sync operations between
 * GitHub and the rendered blog content.
 */

import type { SyncStatus, NotificationAdapter, StorageAdapter } from '@blog/core';
import type { GitHubContentFetcher, RepositoryRef } from './github-content.js';

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
 * Dependencies required by SyncOrchestrator.
 */
export interface SyncOrchestratorDependencies {
  /** Fetcher for GitHub content */
  contentFetcher: GitHubContentFetcher;

  /** Storage adapter for rendered content */
  storage: StorageAdapter;

  /** Notification adapter for alerts */
  notifier: NotificationAdapter;

  /** CloudFront distribution ID for cache invalidation */
  distributionId: string;
}

/**
 * Interface for orchestrating sync operations.
 */
export interface SyncOrchestrator {
  /**
   * Execute a sync operation.
   *
   * Flow:
   * 1. Start sync tracking
   * 2. Fetch content from GitHub (incremental: changed files, full: all posts)
   * 3. Render articles
   * 4. Copy assets
   * 5. Handle deletions
   * 6. Regenerate tag pages
   * 7. Invalidate CloudFront cache
   * 8. Send notification
   * 9. Complete sync tracking
   *
   * @param request - Sync request configuration
   * @returns Result of sync operation
   */
  sync(request: SyncRequest): Promise<SyncResult>;

  /**
   * Get current sync status.
   * Returns null if no sync is in progress.
   */
  getCurrentSync(): SyncStatus | null;

  /**
   * Check if a sync is currently in progress.
   */
  isSyncInProgress(): boolean;
}

/**
 * Factory function type for creating SyncOrchestrator instances.
 */
export type CreateSyncOrchestrator = (
  dependencies: SyncOrchestratorDependencies
) => SyncOrchestrator;
