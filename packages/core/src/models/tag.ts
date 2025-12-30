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
    slug: normalizeTagSlug(name),
    name,
  };
}

/**
 * Normalize a tag name to a URL-safe slug.
 * Examples:
 * - "JavaScript" → "javascript"
 * - "Machine Learning" → "machine-learning"
 * - "C++" → "c-plus-plus"
 */
export function normalizeTagSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\+/g, '-plus')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
