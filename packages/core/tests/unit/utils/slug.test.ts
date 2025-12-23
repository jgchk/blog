import { describe, it, expect } from 'vitest';
import { normalizeSlug, normalizeForMatching, extractSlugFromPath } from '../../../src/utils/slug.js';

describe('slug utilities', () => {
  describe('normalizeSlug', () => {
    it('should convert to lowercase', () => {
      expect(normalizeSlug('Hello World')).toBe('hello-world');
    });

    it('should replace spaces with hyphens', () => {
      expect(normalizeSlug('hello world')).toBe('hello-world');
    });

    it('should replace underscores with hyphens', () => {
      expect(normalizeSlug('hello_world')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(normalizeSlug("hello's world!")).toBe('hellos-world');
    });

    it('should collapse multiple hyphens', () => {
      expect(normalizeSlug('hello---world')).toBe('hello-world');
    });

    it('should trim leading and trailing hyphens', () => {
      expect(normalizeSlug('-hello-world-')).toBe('hello-world');
    });

    it('should handle multiple spaces', () => {
      expect(normalizeSlug('hello   world')).toBe('hello-world');
    });

    it('should handle mixed separators', () => {
      expect(normalizeSlug('hello_world-test')).toBe('hello-world-test');
    });

    it('should preserve numbers', () => {
      expect(normalizeSlug('article 123')).toBe('article-123');
    });

    it('should handle empty string', () => {
      expect(normalizeSlug('')).toBe('');
    });

    it('should handle only special characters', () => {
      expect(normalizeSlug('!!!@@@###')).toBe('');
    });
  });

  describe('normalizeForMatching', () => {
    it('should normalize "Article B Title" to "article-b-title"', () => {
      expect(normalizeForMatching('Article B Title')).toBe('article-b-title');
    });

    it('should normalize "ARTICLE B TITLE" to "article-b-title"', () => {
      expect(normalizeForMatching('ARTICLE B TITLE')).toBe('article-b-title');
    });

    it('should normalize "Article_B_Title" to "article-b-title"', () => {
      expect(normalizeForMatching('Article_B_Title')).toBe('article-b-title');
    });

    it('should normalize "Article-B-Title" to "article-b-title"', () => {
      expect(normalizeForMatching('Article-B-Title')).toBe('article-b-title');
    });

    it('should handle leading/trailing whitespace', () => {
      expect(normalizeForMatching('  Article Title  ')).toBe('article-title');
    });
  });

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
