import type { Article } from '../publishing/article.js';
import { Slug } from '../publishing/slug.js';

/**
 * In-memory index for fast article lookup.
 * Per data-model.md specification.
 */
export class ArticleIndex {
  /** Slug → Article lookup */
  private bySlug: Map<string, Article> = new Map();

  /** Normalized title → slug lookup */
  private byTitle: Map<string, string> = new Map();

  /** Normalized alias → slug lookup */
  private byAlias: Map<string, string> = new Map();

  private constructor() {}

  /**
   * Build article index from array of articles
   */
  static buildFromArticles(articles: Article[]): ArticleIndex {
    const index = new ArticleIndex();

    for (const article of articles) {
      const slugString = article.slug.toString();

      // Index by slug
      index.bySlug.set(slugString, article);

      // Index by normalized title
      const normalizedTitle = Slug.normalizeForMatching(article.title);
      if (normalizedTitle && !index.byTitle.has(normalizedTitle)) {
        index.byTitle.set(normalizedTitle, slugString);
      }

      // Index by normalized aliases
      for (const alias of article.aliases) {
        const normalizedAlias = Slug.normalizeForMatching(alias);
        if (normalizedAlias && !index.byAlias.has(normalizedAlias)) {
          index.byAlias.set(normalizedAlias, slugString);
        }
      }
    }

    return index;
  }

  /**
   * Resolve a query to an article slug.
   * Priority order per FR-005: slug → title → aliases
   * @returns Target slug or null if not found
   */
  resolve(query: string): { slug: string; resolvedBy: 'slug' | 'title' | 'alias' } | null {
    const normalized = Slug.normalizeForMatching(query);
    if (!normalized) return null;

    // 1. Try exact slug match
    if (this.bySlug.has(normalized)) {
      return { slug: normalized, resolvedBy: 'slug' };
    }

    // 2. Try title match
    const titleMatch = this.byTitle.get(normalized);
    if (titleMatch) {
      return { slug: titleMatch, resolvedBy: 'title' };
    }

    // 3. Try alias match
    const aliasMatch = this.byAlias.get(normalized);
    if (aliasMatch) {
      return { slug: aliasMatch, resolvedBy: 'alias' };
    }

    return null;
  }

  /**
   * Get article by slug
   */
  getBySlug(slug: string): Article | undefined {
    return this.bySlug.get(slug);
  }

  /**
   * Get all articles
   */
  getAllArticles(): Article[] {
    return Array.from(this.bySlug.values());
  }

  /**
   * Get article count
   */
  get count(): number {
    return this.bySlug.size;
  }
}
