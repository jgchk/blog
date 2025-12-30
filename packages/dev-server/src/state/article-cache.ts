import { Slug, createTag, type Article } from '@blog/core/publishing';
import { ArticleIndex } from '@blog/core/linking';
import type { RenderedArticle } from '../types.js';

/**
 * Manages article storage and retrieval with automatic index rebuilding.
 */
export class ArticleCache {
  private articles: Map<string, RenderedArticle> = new Map();
  private _articleIndex: ArticleIndex | null = null;

  /**
   * Add a rendered article to the cache.
   * Triggers index rebuild.
   */
  addArticle(article: RenderedArticle): void {
    this.articles.set(article.slug, article);
    this.rebuildIndex();
  }

  /**
   * Remove an article from the cache by slug.
   * Triggers index rebuild.
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
   * Get all articles as an array.
   */
  getAllArticles(): RenderedArticle[] {
    return Array.from(this.articles.values());
  }

  /**
   * Get the number of articles in the cache.
   */
  get articleCount(): number {
    return this.articles.size;
  }

  /**
   * Get the article index for wikilink resolution.
   */
  get articleIndex(): ArticleIndex | null {
    return this._articleIndex;
  }

  /**
   * Clear all articles and reset the index.
   */
  clear(): void {
    this.articles.clear();
    this._articleIndex = null;
  }

  /**
   * Rebuild the article index from current articles.
   * Only includes articles without errors.
   */
  private rebuildIndex(): void {
    const validArticles = this.getAllArticles().filter((a) => !a.error);

    if (validArticles.length === 0) {
      this._articleIndex = null;
      return;
    }

    const articleList: Article[] = validArticles.map((a) => ({
      slug: Slug.fromNormalized(a.slug),
      title: a.metadata.title,
      date: a.metadata.date,
      html: a.html,
      tags: a.metadata.tags.map(createTag),
      aliases: [] as string[],
      draft: false,
      excerpt: a.metadata.excerpt,
      sourcePath: '',
      updatedAt: a.renderedAt,
    }));

    this._articleIndex = ArticleIndex.buildFromArticles(articleList);
  }
}
