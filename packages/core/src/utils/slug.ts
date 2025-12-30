import { Slug } from '../models/slug.js';

/**
 * Extract slug from a folder path.
 * e.g., "posts/my-article/index.md" → "my-article"
 */
export function extractSlugFromPath(path: string): string {
  const parts = path.split('/');
  // Find the folder name (the part before index.md)
  const folderIndex = parts.findIndex((p) => p === 'index.md') - 1;
  if (folderIndex >= 0 && parts[folderIndex]) {
    return Slug.normalize(parts[folderIndex]);
  }
  // Fallback: use the filename without extension
  const filename = parts[parts.length - 1];
  if (filename) {
    return Slug.normalize(filename.replace(/\.md$/, ''));
  }
  return '';
}
