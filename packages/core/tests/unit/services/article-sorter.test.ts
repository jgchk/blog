import { describe, it, expect } from 'vitest';
import { ArticleSorter } from '../../../src/services/article-sorter.js';
import type { Article } from '../../../src/models/article.js';

describe('ArticleSorter', () => {
  const createArticle = (slug: string, date: string): Article => ({
    slug,
    title: `Article ${slug}`,
    date: new Date(date),
    content: 'Test content',
    html: '<p>Test content</p>',
    tags: [],
    aliases: [],
    draft: false,
    excerpt: 'Test excerpt',
    sourcePath: `posts/${slug}/index.md`,
    updatedAt: new Date(),
  });

  describe('sortByDate', () => {
    it('should sort articles in reverse chronological order (newest first)', () => {
      const articles = [
        createArticle('old', '2024-01-01'),
        createArticle('newest', '2025-03-15'),
        createArticle('middle', '2024-06-15'),
      ];

      const sorted = ArticleSorter.sortByDate(articles);

      expect(sorted[0]?.slug).toBe('newest');
      expect(sorted[1]?.slug).toBe('middle');
      expect(sorted[2]?.slug).toBe('old');
    });

    it('should handle articles with same date', () => {
      const articles = [
        createArticle('a', '2025-01-15'),
        createArticle('b', '2025-01-15'),
      ];

      const sorted = ArticleSorter.sortByDate(articles);

      expect(sorted).toHaveLength(2);
    });

    it('should not mutate original array', () => {
      const articles = [
        createArticle('old', '2024-01-01'),
        createArticle('new', '2025-01-01'),
      ];
      const originalFirst = articles[0]?.slug;

      ArticleSorter.sortByDate(articles);

      expect(articles[0]?.slug).toBe(originalFirst);
    });

    it('should handle empty array', () => {
      const sorted = ArticleSorter.sortByDate([]);
      expect(sorted).toEqual([]);
    });

    it('should handle single article', () => {
      const articles = [createArticle('only', '2025-01-15')];
      const sorted = ArticleSorter.sortByDate(articles);
      expect(sorted).toHaveLength(1);
    });
  });

  describe('sortByDateAscending', () => {
    it('should sort articles in chronological order (oldest first)', () => {
      const articles = [
        createArticle('newest', '2025-03-15'),
        createArticle('old', '2024-01-01'),
        createArticle('middle', '2024-06-15'),
      ];

      const sorted = ArticleSorter.sortByDateAscending(articles);

      expect(sorted[0]?.slug).toBe('old');
      expect(sorted[1]?.slug).toBe('middle');
      expect(sorted[2]?.slug).toBe('newest');
    });
  });

  describe('getRecent', () => {
    it('should return specified number of most recent articles', () => {
      const articles = [
        createArticle('a', '2024-01-01'),
        createArticle('b', '2024-06-01'),
        createArticle('c', '2025-01-01'),
        createArticle('d', '2025-02-01'),
      ];

      const recent = ArticleSorter.getRecent(articles, 2);

      expect(recent).toHaveLength(2);
      expect(recent[0]?.slug).toBe('d');
      expect(recent[1]?.slug).toBe('c');
    });

    it('should return all articles if count exceeds available', () => {
      const articles = [createArticle('only', '2025-01-01')];

      const recent = ArticleSorter.getRecent(articles, 10);

      expect(recent).toHaveLength(1);
    });
  });
});
