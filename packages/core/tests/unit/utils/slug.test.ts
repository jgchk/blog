import { describe, it, expect } from 'vitest';
import { extractSlugFromPath } from '../../../src/utils/slug.js';

describe('slug utilities', () => {
  describe('extractSlugFromPath', () => {
    it('should extract slug from posts path', () => {
      expect(extractSlugFromPath('posts/my-article/index.md')).toBe('my-article');
    });

    it('should handle nested paths', () => {
      expect(extractSlugFromPath('some/path/to/my-article/index.md')).toBe('my-article');
    });

    it('should normalize the extracted slug', () => {
      expect(extractSlugFromPath('posts/My_Article/index.md')).toBe('my-article');
    });

    it('should handle paths without index.md', () => {
      expect(extractSlugFromPath('posts/my-article.md')).toBe('my-article');
    });

    it('should handle empty path', () => {
      expect(extractSlugFromPath('')).toBe('');
    });
  });
});
