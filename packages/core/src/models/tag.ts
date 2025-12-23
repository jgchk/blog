/**
 * A label for grouping related articles.
 * Per data-model.md specification.
 */
export interface Tag {
  /** URL-safe identifier */
  slug: string;

  /** Display name (original casing preserved) */
  name: string;

  /** Number of articles with this tag */
  count: number;

  /** Article slugs that have this tag */
  articles: string[];
}

/**
 * Create a Tag from a display name
 */
export function createTag(name: string): Tag {
  return {
    slug: normalizeTagSlug(name),
    name,
    count: 0,
    articles: [],
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
