import { describe, it, expect } from 'vitest';
import type { Article, ParsedArticle } from '../../../src/models/article.js';
import { Slug } from '../../../src/models/slug.js';

describe('Article Model', () => {
  describe('slug property', () => {
    it('should accept a Slug value object', () => {
      const slug = Slug.create('test-article')!;

      const article: Article = {
        slug, // This should be Slug, not string
        title: 'Test Article',
        date: new Date('2025-01-15'),
        content: '# Test Content',
        html: '<h1>Test Content</h1>',
        tags: ['test'],
        aliases: [],
        draft: false,
        excerpt: 'Test excerpt',
        sourcePath: 'posts/test-article/index.md',
        updatedAt: new Date(),
      };

      expect(article.slug).toBeInstanceOf(Slug);
      expect(article.slug.toString()).toBe('test-article');
    });

    it('should allow Slug comparison methods', () => {
      const slug = Slug.create('test-article')!;

      const article: Article = {
        slug,
        title: 'Test Article',
        date: new Date('2025-01-15'),
        content: '# Test Content',
        html: '<h1>Test Content</h1>',
        tags: ['test'],
        aliases: [],
        draft: false,
        excerpt: 'Test excerpt',
        sourcePath: 'posts/test-article/index.md',
        updatedAt: new Date(),
      };

      expect(article.slug.equals('test-article')).toBe(true);
      expect(article.slug.equals('Test Article')).toBe(true);
      expect(article.slug.equals('other')).toBe(false);
    });

    it('should serialize slug to string in JSON', () => {
      const slug = Slug.create('test-article')!;

      const article: Article = {
        slug,
        title: 'Test Article',
        date: new Date('2025-01-15'),
        content: '# Test Content',
        html: '<h1>Test Content</h1>',
        tags: ['test'],
        aliases: [],
        draft: false,
        excerpt: 'Test excerpt',
        sourcePath: 'posts/test-article/index.md',
        updatedAt: new Date(),
      };

      const json = JSON.parse(JSON.stringify(article));
      expect(json.slug).toBe('test-article');
    });
  });

  describe('ParsedArticle', () => {
    it('should also use Slug value object', () => {
      const slug = Slug.create('parsed-article')!;

      const article: ParsedArticle = {
        slug,
        title: 'Parsed Article',
        date: new Date('2025-01-15'),
        content: '# Content',
        tags: ['test'],
        aliases: [],
        draft: false,
        excerpt: 'Excerpt',
        sourcePath: 'posts/parsed-article/index.md',
        updatedAt: new Date(),
      };

      expect(article.slug).toBeInstanceOf(Slug);
      expect(article.slug.toString()).toBe('parsed-article');
    });
  });
});
