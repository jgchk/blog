import type { ParsedArticle } from '../models/article.js';
import type { ValidationError } from '../models/validation-error.js';

/**
 * Result of article validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  normalizedArticle?: ParsedArticle;
}

/**
 * Validates parsed articles and detects duplicates.
 */
export class ArticleValidator {
  /**
   * Validate a single article
   */
  validate(article: ParsedArticle): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate slug
    if (!article.slug || article.slug.trim() === '') {
      errors.push({
        type: 'missing_title',
        path: article.sourcePath,
      });
    }

    // Validate title
    if (!article.title || article.title.trim() === '') {
      errors.push({
        type: 'missing_title',
        path: article.sourcePath,
      });
    }

    // Validate date
    if (!article.date || isNaN(article.date.getTime())) {
      errors.push({
        type: 'invalid_date',
        path: article.sourcePath,
        value: article.date?.toString() ?? 'undefined',
      });
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Return normalized article
    return {
      valid: true,
      errors: [],
      normalizedArticle: {
        ...article,
        title: article.title.trim(),
        slug: article.slug.trim().toLowerCase(),
        tags: article.tags ?? [],
        aliases: article.aliases ?? [],
        draft: article.draft ?? false,
      },
    };
  }

  /**
   * Detect duplicate slugs across multiple articles
   * @param articles - Array of articles to check
   * @returns Array of duplicate_slug validation errors
   */
  detectDuplicates(articles: ParsedArticle[]): ValidationError[] {
    const slugMap = new Map<string, string[]>();

    for (const article of articles) {
      const slug = article.slug.toLowerCase();
      const paths = slugMap.get(slug) ?? [];
      paths.push(article.sourcePath);
      slugMap.set(slug, paths);
    }

    const errors: ValidationError[] = [];

    for (const [slug, paths] of slugMap) {
      if (paths.length > 1) {
        errors.push({
          type: 'duplicate_slug',
          slug,
          paths,
        });
      }
    }

    return errors;
  }

  /**
   * Filter out draft articles
   * @param articles - Array of articles to filter
   * @returns Array of non-draft articles
   */
  filterDrafts(articles: ParsedArticle[]): ParsedArticle[] {
    return articles.filter((article) => !article.draft);
  }
}
