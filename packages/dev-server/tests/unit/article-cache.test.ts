import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleCache } from '../../src/state/article-cache.js';
import type { RenderedArticle } from '../../src/types.js';

function createTestArticle(slug: string, title = 'Test Article'): RenderedArticle {
  return {
    slug,
    html: `<h1>${title}</h1>`,
    metadata: {
      title,
      date: new Date('2024-01-01'),
      tags: ['test'],
      excerpt: 'Test excerpt',
    },
    assets: [],
    renderedAt: new Date(),
    error: null,
  };
}

describe('ArticleCache', () => {
  let cache: ArticleCache;

  beforeEach(() => {
    cache = new ArticleCache();
  });

  describe('addArticle', () => {
    it('should add an article to the cache', () => {
      const article = createTestArticle('my-article');

      cache.addArticle(article);

      expect(cache.getArticle('my-article')).toBe(article);
    });

    it('should replace an existing article with the same slug', () => {
      const original = createTestArticle('my-article', 'Original');
      const updated = createTestArticle('my-article', 'Updated');

      cache.addArticle(original);
      cache.addArticle(updated);

      expect(cache.getArticle('my-article')).toBe(updated);
      expect(cache.articleCount).toBe(1);
    });

    it('should rebuild the article index after adding', () => {
      const article = createTestArticle('my-article');

      cache.addArticle(article);

      expect(cache.articleIndex).not.toBeNull();
    });
  });

  describe('removeArticle', () => {
    it('should remove an article from the cache', () => {
      const article = createTestArticle('my-article');
      cache.addArticle(article);

      cache.removeArticle('my-article');

      expect(cache.getArticle('my-article')).toBeUndefined();
    });

    it('should handle removing non-existent article gracefully', () => {
      expect(() => cache.removeArticle('non-existent')).not.toThrow();
    });

    it('should rebuild the article index after removing', () => {
      const article = createTestArticle('my-article');
      cache.addArticle(article);
      const indexBefore = cache.articleIndex;

      cache.removeArticle('my-article');

      expect(cache.articleIndex).not.toBe(indexBefore);
    });
  });

  describe('getArticle', () => {
    it('should return undefined for non-existent article', () => {
      expect(cache.getArticle('non-existent')).toBeUndefined();
    });

    it('should return the article if it exists', () => {
      const article = createTestArticle('my-article');
      cache.addArticle(article);

      expect(cache.getArticle('my-article')).toBe(article);
    });
  });

  describe('getAllArticles', () => {
    it('should return empty array when no articles', () => {
      expect(cache.getAllArticles()).toEqual([]);
    });

    it('should return all articles as an array', () => {
      const article1 = createTestArticle('article-1');
      const article2 = createTestArticle('article-2');
      cache.addArticle(article1);
      cache.addArticle(article2);

      const articles = cache.getAllArticles();

      expect(articles).toHaveLength(2);
      expect(articles).toContain(article1);
      expect(articles).toContain(article2);
    });
  });

  describe('articleCount', () => {
    it('should return 0 when empty', () => {
      expect(cache.articleCount).toBe(0);
    });

    it('should return the correct count', () => {
      cache.addArticle(createTestArticle('article-1'));
      cache.addArticle(createTestArticle('article-2'));

      expect(cache.articleCount).toBe(2);
    });
  });

  describe('articleIndex', () => {
    it('should be null when empty', () => {
      expect(cache.articleIndex).toBeNull();
    });

    it('should be built from articles without errors', () => {
      const article = createTestArticle('my-article');
      cache.addArticle(article);

      expect(cache.articleIndex).not.toBeNull();
      expect(cache.articleIndex!.getBySlug('my-article')).toBeDefined();
    });

    it('should not include articles with errors in the index', () => {
      const goodArticle = createTestArticle('good-article');
      const errorArticle: RenderedArticle = {
        ...createTestArticle('error-article'),
        error: { type: 'parse', message: 'Parse error', file: 'test.md' },
      };

      cache.addArticle(goodArticle);
      cache.addArticle(errorArticle);

      expect(cache.articleIndex!.getBySlug('good-article')).toBeDefined();
      expect(cache.articleIndex!.getBySlug('error-article')).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should remove all articles', () => {
      cache.addArticle(createTestArticle('article-1'));
      cache.addArticle(createTestArticle('article-2'));

      cache.clear();

      expect(cache.articleCount).toBe(0);
      expect(cache.getAllArticles()).toEqual([]);
    });

    it('should reset the article index to null', () => {
      cache.addArticle(createTestArticle('article-1'));

      cache.clear();

      expect(cache.articleIndex).toBeNull();
    });
  });
});
