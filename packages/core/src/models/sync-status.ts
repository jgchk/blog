/**
 * Admin dashboard status for Git sync operations.
 * Per data-model.md specification.
 */
export interface SyncStatus {
  /** Unique sync operation ID */
  syncId: string;

  /** Git commit hash that triggered sync */
  commitHash: string;

  /** Current status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';

  /** Articles processed in this sync */
  articlesProcessed: number;

  /** Articles that failed to render */
  articlesFailed: number;

  /** Error details if failed */
  errors: SyncError[];

  /** Consecutive failure count (for alerting) */
  consecutiveFailures: number;

  /** Timestamps */
  startedAt: Date;
  completedAt: Date | null;
}

/**
 * Error details for a failed article sync
 */
export interface SyncError {
  articleSlug: string;
  errorType: 'parse' | 'render' | 'storage' | 'unknown';
  message: string;
  stack?: string;
}

/**
 * Create a new SyncStatus in pending state
 */
export function createSyncStatus(syncId: string, commitHash: string): SyncStatus {
  return {
    syncId,
    commitHash,
    status: 'pending',
    articlesProcessed: 0,
    articlesFailed: 0,
    errors: [],
    consecutiveFailures: 0,
    startedAt: new Date(),
    completedAt: null,
  };
}
