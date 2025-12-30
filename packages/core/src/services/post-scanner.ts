import { Slug } from '../models/slug.js';

/**
 * Scans and validates post paths according to spec.md:L148
 * Only posts at posts/{slug}/index.md are valid.
 * Nested folders like posts/2024/my-article/ are ignored.
 */
export class PostScanner {
  private readonly VALID_PATH_REGEX = /^posts\/[^/]+\/index\.md$/;

  /**
   * Check if a path is a valid post path
   * Only accepts: posts/{slug}/index.md
   * Rejects: posts/2024/slug/index.md (nested)
   * Rejects: posts/slug/other.md (not index.md)
   */
  isValidPostPath(path: string): boolean {
    return this.VALID_PATH_REGEX.test(path);
  }

  /**
   * Extract and normalize the slug from a valid post path
   * @param path - The post path
   * @returns The normalized slug, or null if path is invalid
   */
  extractSlug(path: string): string | null {
    if (!this.isValidPostPath(path)) {
      return null;
    }

    // Extract the folder name between posts/ and /index.md
    const match = path.match(/^posts\/([^/]+)\/index\.md$/);
    if (!match?.[1]) {
      return null;
    }

    return Slug.normalize(match[1]);
  }

  /**
   * Filter an array of paths to only valid post paths
   */
  filterValidPaths(paths: string[]): string[] {
    return paths.filter((path) => this.isValidPostPath(path));
  }

  /**
   * Get all post slugs from an array of paths
   */
  getSlugs(paths: string[]): string[] {
    return paths
      .map((path) => this.extractSlug(path))
      .filter((slug): slug is string => slug !== null);
  }
}
