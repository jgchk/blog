import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileWatcherManager } from '../../src/state/file-watcher-manager.js';
import type { FSWatcher } from 'chokidar';
import type { FileChangeEvent } from '../../src/types.js';

function createMockWatcher(): FSWatcher {
  return {
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as FSWatcher;
}

function createFileChangeEvent(
  path: string,
  type: FileChangeEvent['type'] = 'change'
): FileChangeEvent {
  return {
    type,
    path,
    category: 'markdown',
    slug: path.replace('.md', ''),
    timestamp: new Date(),
  };
}

describe('FileWatcherManager', () => {
  let manager: FileWatcherManager;

  beforeEach(() => {
    manager = new FileWatcherManager();
  });

  describe('watcher', () => {
    it('should be null initially', () => {
      expect(manager.watcher).toBeNull();
    });

    it('should store the watcher', () => {
      const watcher = createMockWatcher();

      manager.setWatcher(watcher);

      expect(manager.watcher).toBe(watcher);
    });
  });

  describe('pendingChanges', () => {
    it('should add a pending change', () => {
      const event = createFileChangeEvent('/posts/my-article.md');

      manager.addPendingChange(event);

      expect(manager.hasPendingChanges()).toBe(true);
    });

    it('should deduplicate changes by path', () => {
      const event1 = createFileChangeEvent('/posts/my-article.md');
      const event2 = createFileChangeEvent('/posts/my-article.md');

      manager.addPendingChange(event1);
      manager.addPendingChange(event2);

      const changes = manager.flushPendingChanges();
      expect(changes).toHaveLength(1);
    });

    it('should keep latest change for same path', () => {
      const event1 = createFileChangeEvent('/posts/my-article.md', 'add');
      const event2 = createFileChangeEvent('/posts/my-article.md', 'change');

      manager.addPendingChange(event1);
      manager.addPendingChange(event2);

      const changes = manager.flushPendingChanges();
      expect(changes[0]!.type).toBe('change');
    });

    it('should track changes for different paths', () => {
      const event1 = createFileChangeEvent('/posts/article-1.md');
      const event2 = createFileChangeEvent('/posts/article-2.md');

      manager.addPendingChange(event1);
      manager.addPendingChange(event2);

      const changes = manager.flushPendingChanges();
      expect(changes).toHaveLength(2);
    });
  });

  describe('flushPendingChanges', () => {
    it('should return empty array when no changes', () => {
      expect(manager.flushPendingChanges()).toEqual([]);
    });

    it('should return and clear all pending changes', () => {
      const event = createFileChangeEvent('/posts/my-article.md');
      manager.addPendingChange(event);

      const changes = manager.flushPendingChanges();

      expect(changes).toHaveLength(1);
      expect(changes[0]).toBe(event);
      expect(manager.hasPendingChanges()).toBe(false);
    });
  });

  describe('hasPendingChanges', () => {
    it('should return false when no changes', () => {
      expect(manager.hasPendingChanges()).toBe(false);
    });

    it('should return true when changes exist', () => {
      manager.addPendingChange(createFileChangeEvent('/posts/article.md'));

      expect(manager.hasPendingChanges()).toBe(true);
    });
  });

  describe('pendingChangeCount', () => {
    it('should return 0 when no changes', () => {
      expect(manager.pendingChangeCount).toBe(0);
    });

    it('should return correct count', () => {
      manager.addPendingChange(createFileChangeEvent('/posts/article-1.md'));
      manager.addPendingChange(createFileChangeEvent('/posts/article-2.md'));

      expect(manager.pendingChangeCount).toBe(2);
    });
  });

  describe('closeWatcher', () => {
    it('should close the watcher if set', async () => {
      const watcher = createMockWatcher();
      manager.setWatcher(watcher);

      await manager.closeWatcher();

      expect(watcher.close).toHaveBeenCalled();
      expect(manager.watcher).toBeNull();
    });

    it('should do nothing if no watcher set', async () => {
      await expect(manager.closeWatcher()).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear pending changes', () => {
      manager.addPendingChange(createFileChangeEvent('/posts/article.md'));

      manager.clear();

      expect(manager.hasPendingChanges()).toBe(false);
    });

    it('should set watcher to null (but not close it)', () => {
      const watcher = createMockWatcher();
      manager.setWatcher(watcher);

      manager.clear();

      expect(manager.watcher).toBeNull();
      // Note: clear() does NOT close the watcher - that's the caller's responsibility
    });
  });
});
