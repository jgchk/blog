import type { Article } from '../models/article.js';

/**
 * Utility class for sorting articles.
 */
export class ArticleSorter {
  /**
   * Sort articles in reverse chronological order (newest first)
   */
  static sortByDate(articles: Article[]): Article[] {
    return [...articles].sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  /**
   * Sort articles in chronological order (oldest first)
   */
  static sortByDateAscending(articles: Article[]): Article[] {
    return [...articles].sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Get the N most recent articles
   */
  static getRecent(articles: Article[], count: number): Article[] {
    return this.sortByDate(articles).slice(0, count);
  }
}
