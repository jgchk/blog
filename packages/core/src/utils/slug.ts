import { Slug } from '../models/slug.js';

/**
 * Normalize a string to a URL-safe slug.
 * Per data-model.md normalization rules:
 * - Lowercase
 * - Spaces, dashes, underscores → hyphens
 * - Remove non-alphanumeric characters (except hyphens)
 * - Collapse multiple hyphens
 * - Trim leading/trailing hyphens
 *
 * @deprecated Use Slug.normalize() or Slug.create() instead
 */
export function normalizeSlug(input: string): string {
  return Slug.normalize(input);
}

/**
 * Normalize text for cross-link matching.
 * Per FR-005 normalization rules:
 * - "Article B Title" → "article-b-title"
 * - "ARTICLE B TITLE" → "article-b-title"
 * - "Article_B_Title" → "article-b-title"
 * - "Article-B-Title" → "article-b-title"
 *
 * @deprecated Use Slug.normalizeForMatching() instead
 */
export function normalizeForMatching(input: string): string {
  return Slug.normalizeForMatching(input);
}

/**
 * Extract slug from a folder path.
 * e.g., "posts/my-article/index.md" → "my-article"
 */
export function extractSlugFromPath(path: string): string {
  const parts = path.split('/');
  // Find the folder name (the part before index.md)
  const folderIndex = parts.findIndex((p) => p === 'index.md') - 1;
  if (folderIndex >= 0 && parts[folderIndex]) {
    return normalizeSlug(parts[folderIndex]);
  }
  // Fallback: use the filename without extension
  const filename = parts[parts.length - 1];
  if (filename) {
    return normalizeSlug(filename.replace(/\.md$/, ''));
  }
  return '';
}
