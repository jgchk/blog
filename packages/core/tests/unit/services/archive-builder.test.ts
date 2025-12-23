import { describe, it, expect } from 'vitest';
import { ArchiveBuilder } from '../../../src/services/archive-builder.js';
import type { Article } from '../../../src/models/article.js';

describe('ArchiveBuilder', () => {
  // Use UTC dates to avoid timezone issues
  const createArticle = (slug: string, date: string): Article => ({
    slug,
    title: `Article ${slug}`,
    date: new Date(date + 'T12:00:00Z'),
    content: 'Test content',
    html: '<p>Test content</p>',
    tags: [],
    aliases: [],
    draft: false,
    excerpt: 'Test excerpt',
    sourcePath: `posts/${slug}/index.md`,
    updatedAt: new Date(),
  });

  describe('buildArchive', () => {
    it('should group articles by year-month', () => {
      const articles = [
        createArticle('a', '2025-01-15'),
        createArticle('b', '2025-01-20'),
        createArticle('c', '2025-02-10'),
        createArticle('d', '2024-12-01'),
      ];

      const archive = ArchiveBuilder.buildArchive(articles);

      expect(archive).toHaveLength(3); // 2025-01, 2025-02, 2024-12
    });

    it('should sort groups by date descending', () => {
      const articles = [
        createArticle('a', '2024-01-01'),
        createArticle('b', '2025-06-01'),
        createArticle('c', '2025-01-01'),
      ];

      const archive = ArchiveBuilder.buildArchive(articles);

      expect(archive[0]?.yearMonth).toBe('2025-06');
      expect(archive[1]?.yearMonth).toBe('2025-01');
      expect(archive[2]?.yearMonth).toBe('2024-01');
    });

    it('should sort articles within group by date descending', () => {
      const articles = [
        createArticle('first', '2025-01-01'),
        createArticle('last', '2025-01-31'),
        createArticle('middle', '2025-01-15'),
      ];

      const archive = ArchiveBuilder.buildArchive(articles);

      expect(archive[0]?.articles[0]?.slug).toBe('last');
      expect(archive[0]?.articles[1]?.slug).toBe('middle');
      expect(archive[0]?.articles[2]?.slug).toBe('first');
    });

    it('should include count for each group', () => {
      const articles = [
        createArticle('a', '2025-01-01'),
        createArticle('b', '2025-01-15'),
        createArticle('c', '2025-02-01'),
      ];

      const archive = ArchiveBuilder.buildArchive(articles);

      const jan2025 = archive.find((g) => g.yearMonth === '2025-01');
      expect(jan2025?.count).toBe(2);
    });

    it('should include formatted display name', () => {
      const articles = [createArticle('a', '2025-03-15')];

      const archive = ArchiveBuilder.buildArchive(articles);

      expect(archive[0]?.displayName).toBe('March 2025');
    });

    it('should handle empty array', () => {
      const archive = ArchiveBuilder.buildArchive([]);
      expect(archive).toEqual([]);
    });
  });

  describe('getArticlesByMonth', () => {
    it('should return articles for specific year-month', () => {
      const articles = [
        createArticle('a', '2025-01-15'),
        createArticle('b', '2025-01-20'),
        createArticle('c', '2025-02-10'),
      ];

      const result = ArchiveBuilder.getArticlesByMonth(articles, 2025, 1);

      expect(result).toHaveLength(2);
      expect(result.map((a) => a.slug)).toContain('a');
      expect(result.map((a) => a.slug)).toContain('b');
    });

    it('should return empty array for month with no articles', () => {
      const articles = [createArticle('a', '2025-01-15')];

      const result = ArchiveBuilder.getArticlesByMonth(articles, 2025, 6);

      expect(result).toEqual([]);
    });
  });

  describe('getYears', () => {
    it('should return list of years with articles', () => {
      const articles = [
        createArticle('a', '2023-01-01'),
        createArticle('b', '2024-06-01'),
        createArticle('c', '2025-01-01'),
      ];

      const years = ArchiveBuilder.getYears(articles);

      expect(years).toEqual([2025, 2024, 2023]);
    });

    it('should not have duplicate years', () => {
      const articles = [
        createArticle('a', '2025-01-01'),
        createArticle('b', '2025-06-01'),
        createArticle('c', '2025-12-01'),
      ];

      const years = ArchiveBuilder.getYears(articles);

      expect(years).toEqual([2025]);
    });
  });
});
