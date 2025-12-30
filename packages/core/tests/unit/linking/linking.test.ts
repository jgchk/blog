import { describe, it, expect } from 'vitest';
import {
  ArticleIndex,
  CrossLinkResolver,
  Slug,
  type Article,
} from '../../../src/linking/index.js';
import { createTag } from '../../../src/publishing/index.js';

describe('Linking Bounded Context', () => {
  describe('exports', () => {
    it('should export ArticleIndex', () => {
      expect(ArticleIndex).toBeDefined();
      expect(typeof ArticleIndex.buildFromArticles).toBe('function');
    });

    it('should export CrossLinkResolver', () => {
      expect(CrossLinkResolver).toBeDefined();
      expect(typeof CrossLinkResolver.prototype.resolve).toBe('function');
    });

    it('should export Slug for cross-link resolution', () => {
      expect(Slug).toBeDefined();
      expect(typeof Slug.normalizeForMatching).toBe('function');
    });
  });

  describe('ArticleIndex', () => {
    it('should build index from articles', () => {
      const articles: Article[] = [
        {
          slug: Slug.create('test-article')!,
          title: 'Test Article',
          date: new Date('2024-01-15'),
          html: '<p>Test</p>',
          excerpt: 'Test',
          tags: [createTag('test')],
          draft: false,
          aliases: ['my-alias'],
        },
      ];

      const index = ArticleIndex.buildFromArticles(articles);

      expect(index.count).toBe(1);
      expect(index.getBySlug('test-article')).toBeDefined();
    });

    it('should resolve by slug', () => {
      const articles: Article[] = [
        {
          slug: Slug.create('my-article')!,
          title: 'My Article',
          date: new Date('2024-01-15'),
          html: '<p>Test</p>',
          excerpt: 'Test',
          tags: [],
          draft: false,
          aliases: [],
        },
      ];

      const index = ArticleIndex.buildFromArticles(articles);
      const result = index.resolve('my-article');

      expect(result).not.toBeNull();
      expect(result?.slug).toBe('my-article');
      expect(result?.resolvedBy).toBe('slug');
    });

    it('should resolve by title', () => {
      const articles: Article[] = [
        {
          slug: Slug.create('slug-name')!,
          title: 'The Article Title',
          date: new Date('2024-01-15'),
          html: '<p>Test</p>',
          excerpt: 'Test',
          tags: [],
          draft: false,
          aliases: [],
        },
      ];

      const index = ArticleIndex.buildFromArticles(articles);
      const result = index.resolve('The Article Title');

      expect(result).not.toBeNull();
      expect(result?.slug).toBe('slug-name');
      expect(result?.resolvedBy).toBe('title');
    });
  });

  describe('CrossLinkResolver', () => {
    it('should resolve cross-links using ArticleIndex', () => {
      const articles: Article[] = [
        {
          slug: Slug.create('target')!,
          title: 'Target Article',
          date: new Date('2024-01-15'),
          html: '<p>Target</p>',
          excerpt: 'Target',
          tags: [],
          draft: false,
          aliases: [],
        },
      ];

      const index = ArticleIndex.buildFromArticles(articles);
      const resolver = new CrossLinkResolver(index);

      const resolution = resolver.resolve('target');

      expect(resolution.link.isResolved).toBe(true);
      expect(resolution.targetSlug).toBe('target');
      expect(resolution.resolvedBy).toBe('slug');
    });

    it('should return unresolved for broken links', () => {
      const index = ArticleIndex.buildFromArticles([]);
      const resolver = new CrossLinkResolver(index);

      const resolution = resolver.resolve('non-existent');

      expect(resolution.link.isResolved).toBe(false);
      expect(resolution.targetSlug).toBeNull();
    });
  });
});
