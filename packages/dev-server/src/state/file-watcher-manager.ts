import type { FSWatcher } from 'chokidar';
import type { FileChangeEvent } from '../types.js';

/**
 * Manages file watching and change debouncing.
 */
export class FileWatcherManager {
  private _watcher: FSWatcher | null = null;
  private pendingChanges: Map<string, FileChangeEvent> = new Map();

  /**
   * Get the current file watcher.
   */
  get watcher(): FSWatcher | null {
    return this._watcher;
  }

  /**
   * Set the file watcher.
   */
  setWatcher(watcher: FSWatcher): void {
    this._watcher = watcher;
  }

  /**
   * Add a pending file change (for debouncing).
   */
  addPendingChange(event: FileChangeEvent): void {
    this.pendingChanges.set(event.path, event);
  }

  /**
   * Get and clear all pending changes.
   */
  flushPendingChanges(): FileChangeEvent[] {
    const changes = Array.from(this.pendingChanges.values());
    this.pendingChanges.clear();
    return changes;
  }

  /**
   * Check if there are pending changes.
   */
  hasPendingChanges(): boolean {
    return this.pendingChanges.size > 0;
  }

  /**
   * Get the number of pending changes.
   */
  get pendingChangeCount(): number {
    return this.pendingChanges.size;
  }

  /**
   * Close the watcher and set to null.
   */
  async closeWatcher(): Promise<void> {
    if (this._watcher) {
      await this._watcher.close();
      this._watcher = null;
    }
  }

  /**
   * Clear pending changes and watcher reference.
   * Note: Does NOT close the watcher - use closeWatcher() for that.
   */
  clear(): void {
    this.pendingChanges.clear();
    this._watcher = null;
  }
}
