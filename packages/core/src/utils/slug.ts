/**
 * Normalize a string to a URL-safe slug.
 * Per data-model.md normalization rules:
 * - Lowercase
 * - Spaces, dashes, underscores → hyphens
 * - Remove non-alphanumeric characters (except hyphens)
 * - Collapse multiple hyphens
 * - Trim leading/trailing hyphens
 */
export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Normalize text for cross-link matching.
 * Per FR-005 normalization rules:
 * - "Article B Title" → "article-b-title"
 * - "ARTICLE B TITLE" → "article-b-title"
 * - "Article_B_Title" → "article-b-title"
 * - "Article-B-Title" → "article-b-title"
 */
export function normalizeForMatching(input: string): string {
  return normalizeSlug(input);
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
