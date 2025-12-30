import type { WebSocket } from 'ws';
import type { FSWatcher } from 'chokidar';
import { ArticleIndex, Slug, type Article } from '@blog/core';
import type {
  DevServerStateData,
  RenderedArticle,
  FileChangeEvent,
} from './types.js';

/**
 * DevServerState class managing articles, index, and client connections.
 * Per data-model.md specification.
 */
export class DevServerState implements DevServerStateData {
  status: DevServerStateData['status'] = 'stopped';
  articles: Map<string, RenderedArticle> = new Map();
  articleIndex: ArticleIndex | null = null;
  indexHtml = '';
  archiveHtml = '';
  allTagsHtml = '';
  tagPages: Map<string, string> = new Map();
  clients: Set<WebSocket> = new Set();
  watcher: FSWatcher | null = null;
  pendingChanges: Map<string, FileChangeEvent> = new Map();
  startedAt: Date | null = null;

  /**
   * Add a rendered article to state.
   */
  addArticle(article: RenderedArticle): void {
    this.articles.set(article.slug, article);
    this.rebuildIndex();
  }

  /**
   * Remove an article from state.
   */
  removeArticle(slug: string): void {
    this.articles.delete(slug);
    this.rebuildIndex();
  }

  /**
   * Get an article by slug.
   */
  getArticle(slug: string): RenderedArticle | undefined {
    return this.articles.get(slug);
  }

  /**
   * Get all articles as array.
   */
  getAllArticles(): RenderedArticle[] {
    return Array.from(this.articles.values());
  }

  /**
   * Get article count.
   */
  get articleCount(): number {
    return this.articles.size;
  }

  /**
   * Rebuild article index for wikilink resolution.
   */
  private rebuildIndex(): void {
    const articleList: Article[] = this.getAllArticles()
      .filter((a) => !a.error)
      .map((a) => ({
        slug: Slug.fromNormalized(a.slug),
        title: a.metadata.title,
        date: a.metadata.date,
        content: '',
        html: a.html,
        tags: a.metadata.tags,
        aliases: [],
        draft: false,
        excerpt: a.metadata.excerpt,
        sourcePath: '',
        updatedAt: a.renderedAt,
      }));

    this.articleIndex = ArticleIndex.buildFromArticles(articleList);
  }

  /**
   * Add a WebSocket client.
   */
  addClient(client: WebSocket): void {
    this.clients.add(client);
  }

  /**
   * Remove a WebSocket client.
   */
  removeClient(client: WebSocket): void {
    this.clients.delete(client);
  }

  /**
   * Get connected client count.
   */
  get clientCount(): number {
    return this.clients.size;
  }

  /**
   * Add a pending file change (for debouncing).
   */
  addPendingChange(event: FileChangeEvent): void {
    this.pendingChanges.set(event.path, event);
  }

  /**
   * Get and clear pending changes.
   */
  flushPendingChanges(): FileChangeEvent[] {
    const changes = Array.from(this.pendingChanges.values());
    this.pendingChanges.clear();
    return changes;
  }

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
    this.articles.clear();
    this.articleIndex = null;
    this.indexHtml = '';
    this.archiveHtml = '';
    this.allTagsHtml = '';
    this.tagPages.clear();
    this.clients.clear();
    this.watcher = null;
    this.pendingChanges.clear();
    this.startedAt = null;
  }
}
