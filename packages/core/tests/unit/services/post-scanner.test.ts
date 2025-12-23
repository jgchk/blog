import { describe, it, expect } from 'vitest';
import { PostScanner } from '../../../src/services/post-scanner.js';

describe('PostScanner', () => {
  describe('isValidPostPath', () => {
    const scanner = new PostScanner();

    it('should accept valid post path: posts/my-article/index.md', () => {
      expect(scanner.isValidPostPath('posts/my-article/index.md')).toBe(true);
    });

    it('should accept valid post path with hyphens: posts/my-great-article/index.md', () => {
      expect(scanner.isValidPostPath('posts/my-great-article/index.md')).toBe(true);
    });

    it('should reject nested folder paths: posts/2024/my-article/index.md', () => {
      // Per spec.md:L148 - only posts/slug/ is scanned, not posts/year/slug/
      expect(scanner.isValidPostPath('posts/2024/my-article/index.md')).toBe(false);
    });

    it('should reject deeply nested paths: posts/category/subcategory/article/index.md', () => {
      expect(scanner.isValidPostPath('posts/category/subcategory/article/index.md')).toBe(false);
    });

    it('should reject non-index.md files: posts/my-article/other.md', () => {
      expect(scanner.isValidPostPath('posts/my-article/other.md')).toBe(false);
    });

    it('should reject files in root posts folder: posts/index.md', () => {
      expect(scanner.isValidPostPath('posts/index.md')).toBe(false);
    });

    it('should reject paths outside posts folder: articles/my-article/index.md', () => {
      expect(scanner.isValidPostPath('articles/my-article/index.md')).toBe(false);
    });
  });

  describe('extractSlug', () => {
    const scanner = new PostScanner();

    it('should extract slug from valid path', () => {
      expect(scanner.extractSlug('posts/my-article/index.md')).toBe('my-article');
    });

    it('should normalize slug to lowercase', () => {
      expect(scanner.extractSlug('posts/My-Article/index.md')).toBe('my-article');
    });

    it('should return null for invalid paths', () => {
      expect(scanner.extractSlug('posts/2024/my-article/index.md')).toBeNull();
    });
  });

  describe('filterValidPaths', () => {
    const scanner = new PostScanner();

    it('should filter out invalid paths', () => {
      const paths = [
        'posts/valid-article/index.md',
        'posts/2024/nested/index.md',
        'posts/another-valid/index.md',
        'posts/invalid.md',
      ];

      const result = scanner.filterValidPaths(paths);

      expect(result).toEqual([
        'posts/valid-article/index.md',
        'posts/another-valid/index.md',
      ]);
    });
  });
});
