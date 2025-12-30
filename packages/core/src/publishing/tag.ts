import { Slug } from './slug.js';

/**
 * A label for grouping related articles.
 * Value Object - immutable, identity based on slug.
 * Per data-model.md specification.
 */
export interface Tag {
  /** URL-safe identifier */
  readonly slug: string;

  /** Display name (original casing preserved) */
  readonly name: string;
}

/**
 * Tag with computed statistics from TagIndex.
 * Used when displaying tag pages or tag clouds.
 */
export interface TagWithStats extends Tag {
  /** Number of articles with this tag */
  readonly count: number;

  /** Article slugs that have this tag */
  readonly articles: readonly string[];
}

/**
 * Create a Tag from a display name
 */
export function createTag(name: string): Tag {
  return {
    slug: Slug.normalizeTag(name),
    name,
  };
}

