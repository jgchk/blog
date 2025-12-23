import type { SyncStatus, SyncError } from '@blog/core';
import { createSyncStatus } from '@blog/core';

/**
 * Tracks sync operations for admin dashboard.
 * Per data-model.md SyncStatus specification.
 */
export class SyncTracker {
  private syncHistory: Map<string, SyncStatus> = new Map();
  private consecutiveFailures: number = 0;

  /**
   * Start a new sync operation
   */
  startSync(syncId: string, commitHash: string): SyncStatus {
    const status = createSyncStatus(syncId, commitHash);
    status.status = 'in_progress';
    status.consecutiveFailures = this.consecutiveFailures;
    this.syncHistory.set(syncId, status);
    return status;
  }

  /**
   * Mark sync as completed successfully
   */
  completeSync(
    syncId: string,
    articlesProcessed: number,
    articlesFailed: number,
    errors: SyncError[]
  ): SyncStatus | null {
    const status = this.syncHistory.get(syncId);
    if (!status) return null;

    status.status = articlesFailed > 0 ? 'failed' : 'completed';
    status.articlesProcessed = articlesProcessed;
    status.articlesFailed = articlesFailed;
    status.errors = errors;
    status.completedAt = new Date();

    if (status.status === 'completed') {
      this.consecutiveFailures = 0;
    } else {
      this.consecutiveFailures++;
    }
    status.consecutiveFailures = this.consecutiveFailures;

    return status;
  }

  /**
   * Mark sync as failed
   */
  failSync(syncId: string, error: SyncError): SyncStatus | null {
    const status = this.syncHistory.get(syncId);
    if (!status) return null;

    status.status = 'failed';
    status.errors.push(error);
    status.completedAt = new Date();
    this.consecutiveFailures++;
    status.consecutiveFailures = this.consecutiveFailures;

    return status;
  }

  /**
   * Get sync status by ID
   */
  getSync(syncId: string): SyncStatus | undefined {
    return this.syncHistory.get(syncId);
  }

  /**
   * Get recent sync operations
   */
  getRecentSyncs(limit: number = 10): SyncStatus[] {
    return Array.from(this.syncHistory.values())
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get current consecutive failure count
   */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /**
   * Check if alert threshold is reached (3+ consecutive failures)
   */
  shouldAlert(): boolean {
    return this.consecutiveFailures >= 3;
  }

  /**
   * Reset failure count (after manual intervention)
   */
  resetFailures(): void {
    this.consecutiveFailures = 0;
  }
}
