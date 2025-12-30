import type { CrossLinkResolution } from './cross-link.js';
import type { ArticleIndex } from './article-index.js';
import { Slug } from '../publishing/slug.js';

/**
 * Resolves cross-links between articles.
 * Per FR-005 resolution order: slug → title → aliases
 */
export class CrossLinkResolver {
  constructor(private articleIndex: ArticleIndex) {}

  /**
   * Resolve a cross-link query to an article
   * @param query - The text inside [[brackets]]
   * @returns Resolution result with target slug and how it was resolved
   */
  resolve(query: string): CrossLinkResolution {
    const normalized = Slug.normalizeForMatching(query);

    const result = this.articleIndex.resolve(query);

    if (result) {
      return {
        link: {
          originalText: query,
          normalizedText: normalized,
          targetSlug: result.slug,
          isResolved: true,
          position: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
        },
        resolvedBy: result.resolvedBy,
        targetSlug: result.slug,
      };
    }

    return {
      link: {
        originalText: query,
        normalizedText: normalized,
        targetSlug: null,
        isResolved: false,
        position: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
      },
      resolvedBy: null,
      targetSlug: null,
    };
  }
}
