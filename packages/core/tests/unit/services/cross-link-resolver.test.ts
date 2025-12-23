import { describe, it, expect } from 'vitest';
import { CrossLinkResolver } from '../../../src/services/cross-link-resolver.js';
import { ArticleIndex } from '../../../src/services/article-index.js';
import type { Article } from '../../../src/models/article.js';

describe('CrossLinkResolver', () => {
  const createArticle = (slug: string, title: string, aliases: string[] = []): Article => ({
    slug,
    title,
    date: new Date('2025-01-15'),
    content: 'Test content',
    html: '<p>Test content</p>',
    tags: [],
    aliases,
    draft: false,
    excerpt: 'Test excerpt',
    sourcePath: `posts/${slug}/index.md`,
    updatedAt: new Date(),
  });

  describe('resolve', () => {
    it('should resolve by slug first', () => {
      const articles = [
        createArticle('target-slug', 'Different Title'),
        createArticle('other', 'target-slug'),
      ];
      const index = ArticleIndex.buildFromArticles(articles);
      const resolver = new CrossLinkResolver(index);

      const result = resolver.resolve('target-slug');

      expect(result.targetSlug).toBe('target-slug');
      expect(result.resolvedBy).toBe('slug');
    });

    it('should resolve by title when slug not found', () => {
      const articles = [createArticle('my-slug', 'Target Title')];
      const index = ArticleIndex.buildFromArticles(articles);
      const resolver = new CrossLinkResolver(index);

      const result = resolver.resolve('Target Title');

      expect(result.targetSlug).toBe('my-slug');
      expect(result.resolvedBy).toBe('title');
    });

    it('should resolve by alias when slug and title not found', () => {
      const articles = [createArticle('my-slug', 'My Title', ['Target Alias'])];
      const index = ArticleIndex.buildFromArticles(articles);
      const resolver = new CrossLinkResolver(index);

      const result = resolver.resolve('Target Alias');

      expect(result.targetSlug).toBe('my-slug');
      expect(result.resolvedBy).toBe('alias');
    });

    it('should return null when nothing matches', () => {
      const articles = [createArticle('my-slug', 'My Title')];
      const index = ArticleIndex.buildFromArticles(articles);
      const resolver = new CrossLinkResolver(index);

      const result = resolver.resolve('nonexistent');

      expect(result.targetSlug).toBeNull();
      expect(result.resolvedBy).toBeNull();
    });

    it('should be case-insensitive', () => {
      const articles = [createArticle('my-article', 'My Article Title')];
      const index = ArticleIndex.buildFromArticles(articles);
      const resolver = new CrossLinkResolver(index);

      const result = resolver.resolve('MY ARTICLE TITLE');

      expect(result.targetSlug).toBe('my-article');
    });

    it('should normalize query before matching', () => {
      const articles = [createArticle('my-article', 'My Article')];
      const index = ArticleIndex.buildFromArticles(articles);
      const resolver = new CrossLinkResolver(index);

      // Underscores should normalize to hyphens
      const result = resolver.resolve('my_article');

      expect(result.targetSlug).toBe('my-article');
      expect(result.resolvedBy).toBe('slug');
    });
  });

  describe('priority order verification', () => {
    it('should follow priority: slug > title > alias when all match different articles', () => {
      const articles = [
        createArticle('target', 'Slug Match'),
        createArticle('other-1', 'target'),
        createArticle('other-2', 'Something', ['target']),
      ];
      const index = ArticleIndex.buildFromArticles(articles);
      const resolver = new CrossLinkResolver(index);

      const result = resolver.resolve('target');

      expect(result.targetSlug).toBe('target');
      expect(result.resolvedBy).toBe('slug');
    });

    it('should follow priority: title > alias when only title and alias match', () => {
      const articles = [
        createArticle('article-1', 'Shared Name'),
        createArticle('article-2', 'Different', ['Shared Name']),
      ];
      const index = ArticleIndex.buildFromArticles(articles);
      const resolver = new CrossLinkResolver(index);

      const result = resolver.resolve('Shared Name');

      expect(result.targetSlug).toBe('article-1');
      expect(result.resolvedBy).toBe('title');
    });
  });
});
