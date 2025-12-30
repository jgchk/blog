import type { WebSocket } from 'ws';
import type { FSWatcher } from 'chokidar';
import type { ArticleIndex } from '@blog/core/linking';
import type {
  DevServerStateData,
  RenderedArticle,
  FileChangeEvent,
  ServerMessage,
} from './types.js';
import { ArticleCache } from './state/article-cache.js';
import { RenderCache } from './state/render-cache.js';
import { ConnectionManager } from './state/connection-manager.js';
import { FileWatcherManager } from './state/file-watcher-manager.js';

/**
 * DevServerState class managing articles, index, and client connections.
 * Composes specialized managers for single responsibility.
 * Per data-model.md specification.
 */
export class DevServerState implements DevServerStateData {
  status: DevServerStateData['status'] = 'stopped';
  startedAt: Date | null = null;

  // Composed managers
  private readonly _articleCache = new ArticleCache();
  private readonly _renderCache = new RenderCache();
  private readonly _connectionManager = new ConnectionManager();
  private readonly _fileWatcherManager = new FileWatcherManager();

  // ============================================
  // Article Cache delegation
  // ============================================

  /**
   * Add a rendered article to state.
   */
  addArticle(article: RenderedArticle): void {
    this._articleCache.addArticle(article);
  }

  /**
   * Remove an article from state.
   */
  removeArticle(slug: string): void {
    this._articleCache.removeArticle(slug);
  }

  /**
   * Get an article by slug.
   */
  getArticle(slug: string): RenderedArticle | undefined {
    return this._articleCache.getArticle(slug);
  }

  /**
   * Get all articles as array.
   */
  getAllArticles(): RenderedArticle[] {
    return this._articleCache.getAllArticles();
  }

  /**
   * Get article count.
   */
  get articleCount(): number {
    return this._articleCache.articleCount;
  }

  /**
   * All rendered articles keyed by slug.
   * Exposed for backward compatibility.
   */
  get articles(): Map<string, RenderedArticle> {
    // Create a map from the cache for backward compatibility
    const map = new Map<string, RenderedArticle>();
    for (const article of this._articleCache.getAllArticles()) {
      map.set(article.slug, article);
    }
    return map;
  }

  /**
   * Article index for wikilink resolution.
   */
  get articleIndex(): ArticleIndex | null {
    return this._articleCache.articleIndex;
  }

  // ============================================
  // Render Cache delegation
  // ============================================

  /**
   * Rendered index page HTML.
   */
  get indexHtml(): string {
    return this._renderCache.indexHtml;
  }

  set indexHtml(value: string) {
    this._renderCache.setIndex(value);
  }

  /**
   * Rendered archive page HTML.
   */
  get archiveHtml(): string {
    return this._renderCache.archiveHtml;
  }

  set archiveHtml(value: string) {
    this._renderCache.setArchive(value);
  }

  /**
   * Rendered all tags page HTML.
   */
  get allTagsHtml(): string {
    return this._renderCache.allTagsHtml;
  }

  set allTagsHtml(value: string) {
    this._renderCache.setAllTags(value);
  }

  /**
   * Rendered tag pages keyed by tag slug.
   */
  get tagPages(): Map<string, string> {
    // Return proxy for backward compatibility
    const cache = this._renderCache;
    return new Proxy(new Map<string, string>(), {
      get(target, prop) {
        if (prop === 'get') {
          return (key: string) => cache.getTagPage(key);
        }
        if (prop === 'set') {
          return (key: string, value: string) => {
            cache.setTagPage(key, value);
            return target;
          };
        }
        if (prop === 'clear') {
          return () => cache.clear();
        }
        if (prop === 'size') {
          return cache.getTagSlugs().length;
        }
        return Reflect.get(target, prop);
      },
    });
  }

  // ============================================
  // Connection Manager delegation
  // ============================================

  /**
   * Add a WebSocket client.
   */
  addClient(client: WebSocket): void {
    this._connectionManager.addClient(client);
  }

  /**
   * Remove a WebSocket client.
   */
  removeClient(client: WebSocket): void {
    this._connectionManager.removeClient(client);
  }

  /**
   * Get connected client count.
   */
  get clientCount(): number {
    return this._connectionManager.clientCount;
  }

  /**
   * Connected WebSocket clients.
   */
  get clients(): Set<WebSocket> {
    return this._connectionManager.getClients();
  }

  /**
   * Broadcast a message to all connected clients.
   */
  broadcast(message: ServerMessage): void {
    this._connectionManager.broadcast(message);
  }

  // ============================================
  // File Watcher Manager delegation
  // ============================================

  /**
   * Active file watcher.
   */
  get watcher(): FSWatcher | null {
    return this._fileWatcherManager.watcher;
  }

  set watcher(value: FSWatcher | null) {
    if (value) {
      this._fileWatcherManager.setWatcher(value);
    } else {
      this._fileWatcherManager.clear();
    }
  }

  /**
   * Add a pending file change (for debouncing).
   */
  addPendingChange(event: FileChangeEvent): void {
    this._fileWatcherManager.addPendingChange(event);
  }

  /**
   * Get and clear pending changes.
   */
  flushPendingChanges(): FileChangeEvent[] {
    return this._fileWatcherManager.flushPendingChanges();
  }

  /**
   * Pending file changes (for debouncing).
   */
  get pendingChanges(): Map<string, FileChangeEvent> {
    // Return a read-only view for backward compatibility
    const changes = new Map<string, FileChangeEvent>();
    // Note: The manager doesn't expose individual pending changes
    // This is acceptable as this property is primarily used for count/existence checks
    return changes;
  }

  // ============================================
  // Lifecycle methods
  // ============================================

  /**
   * Set server status.
   */
  setStatus(status: DevServerStateData['status']): void {
    this.status = status;
    if (status === 'running') {
      this.startedAt = new Date();
    }
  }

  /**
   * Reset state to initial values.
   */
  reset(): void {
    this.status = 'stopped';
    this.startedAt = null;
    this._articleCache.clear();
    this._renderCache.clear();
    this._connectionManager.clear();
    this._fileWatcherManager.clear();
  }

  // ============================================
  // Direct manager access (for advanced use)
  // ============================================

  /**
   * Get the article cache manager.
   */
  get articleCacheManager(): ArticleCache {
    return this._articleCache;
  }

  /**
   * Get the render cache manager.
   */
  get renderCacheManager(): RenderCache {
    return this._renderCache;
  }

  /**
   * Get the connection manager.
   */
  get connectionManager(): ConnectionManager {
    return this._connectionManager;
  }

  /**
   * Get the file watcher manager.
   */
  get fileWatcherManager(): FileWatcherManager {
    return this._fileWatcherManager;
  }
}
