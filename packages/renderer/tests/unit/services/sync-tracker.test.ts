import { describe, it, expect, beforeEach } from 'vitest';
import { SyncTracker } from '../../../src/services/sync-tracker.js';

describe('SyncTracker', () => {
  let tracker: SyncTracker;

  beforeEach(() => {
    tracker = new SyncTracker();
  });

  describe('startSync', () => {
    it('creates a new sync status with in_progress status', () => {
      const status = tracker.startSync('sync-123', 'abc123');

      expect(status.syncId).toBe('sync-123');
      expect(status.commitHash).toBe('abc123');
      expect(status.status).toBe('in_progress');
      expect(status.articlesProcessed).toBe(0);
      expect(status.articlesFailed).toBe(0);
      expect(status.errors).toEqual([]);
      expect(status.consecutiveFailures).toBe(0);
      expect(status.startedAt).toBeInstanceOf(Date);
      expect(status.completedAt).toBeNull();
    });

    it('preserves consecutive failure count from previous syncs', () => {
      // First sync fails
      tracker.startSync('sync-1', 'commit-1');
      tracker.failSync('sync-1', {
        articleSlug: 'test',
        errorType: 'parse',
        message: 'Parse error',
      });

      // Second sync should inherit the consecutive failure count
      const status = tracker.startSync('sync-2', 'commit-2');
      expect(status.consecutiveFailures).toBe(1);
    });
  });

  describe('completeSync', () => {
    it('marks sync as completed when no failures', () => {
      tracker.startSync('sync-123', 'abc123');
      const status = tracker.completeSync('sync-123', 10, 0, []);

      expect(status).not.toBeNull();
      expect(status!.status).toBe('completed');
      expect(status!.articlesProcessed).toBe(10);
      expect(status!.articlesFailed).toBe(0);
      expect(status!.completedAt).toBeInstanceOf(Date);
    });

    it('marks sync as failed when there are failures', () => {
      tracker.startSync('sync-123', 'abc123');
      const errors = [
        { articleSlug: 'post-1', errorType: 'parse' as const, message: 'Error' },
      ];
      const status = tracker.completeSync('sync-123', 10, 2, errors);

      expect(status).not.toBeNull();
      expect(status!.status).toBe('failed');
      expect(status!.articlesFailed).toBe(2);
      expect(status!.errors).toEqual(errors);
    });

    it('resets consecutive failures on successful sync', () => {
      // Create failures
      tracker.startSync('sync-1', 'commit-1');
      tracker.failSync('sync-1', {
        articleSlug: 'test',
        errorType: 'parse',
        message: 'Error',
      });
      expect(tracker.getConsecutiveFailures()).toBe(1);

      // Successful sync resets counter
      tracker.startSync('sync-2', 'commit-2');
      tracker.completeSync('sync-2', 5, 0, []);
      expect(tracker.getConsecutiveFailures()).toBe(0);
    });

    it('increments consecutive failures on failed sync', () => {
      tracker.startSync('sync-1', 'commit-1');
      tracker.completeSync('sync-1', 10, 2, [
        { articleSlug: 'post-1', errorType: 'parse', message: 'Error' },
      ]);

      expect(tracker.getConsecutiveFailures()).toBe(1);
    });

    it('returns null for unknown sync ID', () => {
      const status = tracker.completeSync('unknown', 10, 0, []);
      expect(status).toBeNull();
    });
  });

  describe('failSync', () => {
    it('marks sync as failed and records error', () => {
      tracker.startSync('sync-123', 'abc123');
      const error = {
        articleSlug: 'test-article',
        errorType: 'storage' as const,
        message: 'Storage error',
      };
      const status = tracker.failSync('sync-123', error);

      expect(status).not.toBeNull();
      expect(status!.status).toBe('failed');
      expect(status!.errors).toContainEqual(error);
      expect(status!.completedAt).toBeInstanceOf(Date);
    });

    it('increments consecutive failure count', () => {
      tracker.startSync('sync-1', 'commit-1');
      tracker.failSync('sync-1', {
        articleSlug: 'test',
        errorType: 'unknown',
        message: 'Error',
      });

      expect(tracker.getConsecutiveFailures()).toBe(1);

      tracker.startSync('sync-2', 'commit-2');
      tracker.failSync('sync-2', {
        articleSlug: 'test',
        errorType: 'unknown',
        message: 'Error',
      });

      expect(tracker.getConsecutiveFailures()).toBe(2);
    });

    it('returns null for unknown sync ID', () => {
      const status = tracker.failSync('unknown', {
        articleSlug: 'test',
        errorType: 'parse',
        message: 'Error',
      });
      expect(status).toBeNull();
    });
  });

  describe('getSync', () => {
    it('retrieves sync status by ID', () => {
      tracker.startSync('sync-123', 'abc123');
      const status = tracker.getSync('sync-123');

      expect(status).not.toBeUndefined();
      expect(status!.syncId).toBe('sync-123');
    });

    it('returns undefined for unknown sync ID', () => {
      const status = tracker.getSync('unknown');
      expect(status).toBeUndefined();
    });
  });

  describe('getRecentSyncs', () => {
    it('returns syncs sorted by start time (newest first)', async () => {
      // Create syncs with slight time differences
      tracker.startSync('sync-1', 'commit-1');
      await new Promise((resolve) => setTimeout(resolve, 10));
      tracker.startSync('sync-2', 'commit-2');
      await new Promise((resolve) => setTimeout(resolve, 10));
      tracker.startSync('sync-3', 'commit-3');

      const recent = tracker.getRecentSyncs();

      expect(recent[0].syncId).toBe('sync-3');
      expect(recent[1].syncId).toBe('sync-2');
      expect(recent[2].syncId).toBe('sync-1');
    });

    it('respects limit parameter', () => {
      tracker.startSync('sync-1', 'commit-1');
      tracker.startSync('sync-2', 'commit-2');
      tracker.startSync('sync-3', 'commit-3');

      const recent = tracker.getRecentSyncs(2);

      expect(recent).toHaveLength(2);
    });

    it('returns empty array when no syncs exist', () => {
      const recent = tracker.getRecentSyncs();
      expect(recent).toEqual([]);
    });
  });

  describe('shouldAlert', () => {
    it('returns false when consecutive failures < 3', () => {
      expect(tracker.shouldAlert()).toBe(false);

      tracker.startSync('sync-1', 'commit-1');
      tracker.failSync('sync-1', {
        articleSlug: 'test',
        errorType: 'parse',
        message: 'Error',
      });
      expect(tracker.shouldAlert()).toBe(false);

      tracker.startSync('sync-2', 'commit-2');
      tracker.failSync('sync-2', {
        articleSlug: 'test',
        errorType: 'parse',
        message: 'Error',
      });
      expect(tracker.shouldAlert()).toBe(false);
    });

    it('returns true when consecutive failures >= 3 (FR-014)', () => {
      for (let i = 1; i <= 3; i++) {
        tracker.startSync(`sync-${i}`, `commit-${i}`);
        tracker.failSync(`sync-${i}`, {
          articleSlug: 'test',
          errorType: 'parse',
          message: 'Error',
        });
      }

      expect(tracker.shouldAlert()).toBe(true);
      expect(tracker.getConsecutiveFailures()).toBe(3);
    });
  });

  describe('resetFailures', () => {
    it('resets consecutive failure count to zero', () => {
      // Create some failures
      for (let i = 1; i <= 3; i++) {
        tracker.startSync(`sync-${i}`, `commit-${i}`);
        tracker.failSync(`sync-${i}`, {
          articleSlug: 'test',
          errorType: 'parse',
          message: 'Error',
        });
      }

      expect(tracker.getConsecutiveFailures()).toBe(3);

      tracker.resetFailures();

      expect(tracker.getConsecutiveFailures()).toBe(0);
      expect(tracker.shouldAlert()).toBe(false);
    });
  });
});
