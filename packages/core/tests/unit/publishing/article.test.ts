import { describe, it, expect } from 'vitest';
import type { Article, ParsedArticle } from '../../../src/publishing/article.js';
import { Slug } from '../../../src/publishing/slug.js';
import { createTag, type Tag } from '../../../src/publishing/tag.js';

describe('Article Model', () => {
  describe('ParsedArticle (parsing result - raw markdown, no HTML)', () => {
    it('should have content (raw markdown) but NOT html', () => {
      const slug = Slug.create('parsed-article')!;
      const tags: readonly Tag[] = [createTag('TypeScript'), createTag('TDD')];

      const article: ParsedArticle = {
        slug,
        title: 'Parsed Article',
        date: new Date('2025-01-15'),
        content: '# Raw Markdown Content',
        tags,
        aliases: [],
        draft: false,
        excerpt: 'Excerpt',
        sourcePath: 'posts/parsed-article/index.md',
        updatedAt: new Date(),
      };

      expect(article.content).toBe('# Raw Markdown Content');
      // ParsedArticle should NOT have html property
      expect('html' in article).toBe(false);
    });

    it('should use Tag[] instead of string[] for tags', () => {
      const slug = Slug.create('tag-test')!;
      const tags: readonly Tag[] = [createTag('TypeScript'), createTag('C++')];

      const article: ParsedArticle = {
        slug,
        title: 'Tag Test',
        date: new Date('2025-01-15'),
        content: '# Content',
        tags,
        aliases: [],
        draft: false,
        excerpt: 'Excerpt',
        sourcePath: 'posts/tag-test/index.md',
        updatedAt: new Date(),
      };

      expect(article.tags).toHaveLength(2);
      expect(article.tags[0]!.name).toBe('TypeScript');
      expect(article.tags[0]!.slug).toBe('typescript');
      expect(article.tags[1]!.name).toBe('C++');
      expect(article.tags[1]!.slug).toBe('c-plus-plus');
    });

    it('should use Slug value object for slug', () => {
      const slug = Slug.create('parsed-article')!;
      const tags: readonly Tag[] = [createTag('test')];

      const article: ParsedArticle = {
        slug,
        title: 'Parsed Article',
        date: new Date('2025-01-15'),
        content: '# Content',
        tags,
        aliases: [],
        draft: false,
        excerpt: 'Excerpt',
        sourcePath: 'posts/parsed-article/index.md',
        updatedAt: new Date(),
      };

      expect(article.slug).toBeInstanceOf(Slug);
      expect(article.slug.toString()).toBe('parsed-article');
      expect(article.slug.equals('Parsed Article')).toBe(true);
    });
  });

  describe('Article (publishing-ready - rendered HTML, no raw content)', () => {
    it('should have html but NOT content (raw markdown)', () => {
      const slug = Slug.create('rendered-article')!;
      const tags: readonly Tag[] = [createTag('TypeScript')];

      const article: Article = {
        slug,
        title: 'Rendered Article',
        date: new Date('2025-01-15'),
        html: '<h1>Rendered HTML Content</h1>',
        tags,
        aliases: [],
        draft: false,
        excerpt: 'Excerpt',
        sourcePath: 'posts/rendered-article/index.md',
        updatedAt: new Date(),
      };

      expect(article.html).toBe('<h1>Rendered HTML Content</h1>');
      // Article should NOT have content property
      expect('content' in article).toBe(false);
    });

    it('should use Tag[] instead of string[] for tags', () => {
      const slug = Slug.create('tag-test')!;
      const tags: readonly Tag[] = [createTag('DDD'), createTag('Architecture')];

      const article: Article = {
        slug,
        title: 'Tag Test',
        date: new Date('2025-01-15'),
        html: '<p>Content</p>',
        tags,
        aliases: [],
        draft: false,
        excerpt: 'Excerpt',
        sourcePath: 'posts/tag-test/index.md',
        updatedAt: new Date(),
      };

      expect(article.tags).toHaveLength(2);
      expect(article.tags[0]!.name).toBe('DDD');
      expect(article.tags[0]!.slug).toBe('ddd');
      expect(article.tags[1]!.name).toBe('Architecture');
      expect(article.tags[1]!.slug).toBe('architecture');
    });

    it('should use Slug value object for slug', () => {
      const slug = Slug.create('test-article')!;
      const tags: readonly Tag[] = [createTag('test')];

      const article: Article = {
        slug,
        title: 'Test Article',
        date: new Date('2025-01-15'),
        html: '<h1>Test Content</h1>',
        tags,
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
      const tags: readonly Tag[] = [createTag('test')];

      const article: Article = {
        slug,
        title: 'Test Article',
        date: new Date('2025-01-15'),
        html: '<h1>Test Content</h1>',
        tags,
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
      const tags: readonly Tag[] = [createTag('test')];

      const article: Article = {
        slug,
        title: 'Test Article',
        date: new Date('2025-01-15'),
        html: '<h1>Test Content</h1>',
        tags,
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
});
