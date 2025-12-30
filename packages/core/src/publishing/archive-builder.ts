import type { Article } from './article.js';
import { ArticleSorter } from './article-sorter.js';

/**
 * Archive group representing a year-month
 */
export interface ArchiveGroup {
  /** Year-month key (e.g., "2025-01") */
  yearMonth: string;

  /** Display name (e.g., "January 2025") */
  displayName: string;

  /** Year as number */
  year: number;

  /** Month as number (1-12) */
  month: number;

  /** Number of articles in this group */
  count: number;

  /** Articles in this group (sorted by date descending) */
  articles: Article[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Builds archive structures from articles.
 */
export class ArchiveBuilder {
  /**
   * Build archive grouped by year-month
   * @returns Array of archive groups sorted by date descending
   */
  static buildArchive(articles: Article[]): ArchiveGroup[] {
    if (articles.length === 0) return [];

    const groups = new Map<string, Article[]>();

    // Group by year-month (using UTC to avoid timezone issues)
    for (const article of articles) {
      const year = article.date.getUTCFullYear();
      const month = article.date.getUTCMonth() + 1; // 1-indexed
      const key = `${year}-${month.toString().padStart(2, '0')}`;

      const group = groups.get(key) ?? [];
      group.push(article);
      groups.set(key, group);
    }

    // Convert to array and sort
    const archiveGroups: ArchiveGroup[] = [];

    for (const [key, groupArticles] of groups) {
      const [yearStr, monthStr] = key.split('-');
      const year = parseInt(yearStr ?? '0', 10);
      const month = parseInt(monthStr ?? '0', 10);
      const monthName = MONTH_NAMES[month - 1] ?? 'Unknown';

      archiveGroups.push({
        yearMonth: key,
        displayName: `${monthName} ${year}`,
        year,
        month,
        count: groupArticles.length,
        articles: ArticleSorter.sortByDate(groupArticles),
      });
    }

    // Sort groups by year-month descending
    return archiveGroups.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }

  /**
   * Get articles for a specific year-month
   */
  static getArticlesByMonth(
    articles: Article[],
    year: number,
    month: number
  ): Article[] {
    return ArticleSorter.sortByDate(
      articles.filter((article) => {
        return (
          article.date.getUTCFullYear() === year &&
          article.date.getUTCMonth() + 1 === month
        );
      })
    );
  }

  /**
   * Get list of years that have articles
   * @returns Array of years sorted descending
   */
  static getYears(articles: Article[]): number[] {
    const years = new Set<number>();

    for (const article of articles) {
      years.add(article.date.getUTCFullYear());
    }

    return Array.from(years).sort((a, b) => b - a);
  }
}
