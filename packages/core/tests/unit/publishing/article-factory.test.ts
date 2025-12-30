import { describe, it, expect } from 'vitest';
import { ArticleFactory } from '../../../src/publishing/article-factory.js';
import { Slug } from '../../../src/publishing/slug.js';
import type { FrontMatter } from '../../../src/authoring/front-matter.js';

describe('ArticleFactory', () => {
  const factory = new ArticleFactory();

  describe('createParsedArticle', () => {
    it('should create a ParsedArticle from valid inputs', () => {
      const frontMatter: FrontMatter = {
        title: 'Test Article',
        date: '2025-01-15',
        tags: ['TypeScript', 'Testing'],
        aliases: ['Test'],
        draft: false,
        excerpt: 'Custom excerpt',
      };
      const content = '# Hello World\n\nThis is content.';
      const slug = Slug.fromNormalized('test-article');
      const sourcePath = 'test-article/index.md';

      const result = factory.createParsedArticle({
        frontMatter,
        content,
        slug,
        sourcePath,
      });

      expect(result.slug.toString()).toBe('test-article');
      expect(result.title).toBe('Test Article');
      expect(result.date).toEqual(new Date('2025-01-15'));
      expect(result.content).toBe(content);
      expect(result.tags).toHaveLength(2);
      expect(result.tags[0]?.name).toBe('TypeScript');
      expect(result.tags[0]?.slug).toBe('typescript');
      expect(result.tags[1]?.name).toBe('Testing');
      expect(result.aliases).toEqual(['Test']);
      expect(result.draft).toBe(false);
      expect(result.excerpt).toBe('Custom excerpt');
      expect(result.sourcePath).toBe(sourcePath);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should use empty array for missing tags', () => {
      const frontMatter: FrontMatter = {
        title: 'No Tags',
        date: '2025-01-15',
      };
      const content = 'Content';
      const slug = Slug.fromNormalized('no-tags');
      const sourcePath = 'no-tags/index.md';

      const result = factory.createParsedArticle({
        frontMatter,
        content,
        slug,
        sourcePath,
      });

      expect(result.tags).toEqual([]);
    });

    it('should use empty array for missing aliases', () => {
      const frontMatter: FrontMatter = {
        title: 'No Aliases',
        date: '2025-01-15',
      };
      const content = 'Content';
      const slug = Slug.fromNormalized('no-aliases');
      const sourcePath = 'no-aliases/index.md';

      const result = factory.createParsedArticle({
        frontMatter,
        content,
        slug,
        sourcePath,
      });

      expect(result.aliases).toEqual([]);
    });

    it('should default draft to false when not specified', () => {
      const frontMatter: FrontMatter = {
        title: 'Not Draft',
        date: '2025-01-15',
      };
      const content = 'Content';
      const slug = Slug.fromNormalized('not-draft');
      const sourcePath = 'not-draft/index.md';

      const result = factory.createParsedArticle({
        frontMatter,
        content,
        slug,
        sourcePath,
      });

      expect(result.draft).toBe(false);
    });

    it('should generate excerpt from content when not provided', () => {
      const frontMatter: FrontMatter = {
        title: 'Auto Excerpt',
        date: '2025-01-15',
      };
      const content = 'This is some content that should be used as the excerpt.';
      const slug = Slug.fromNormalized('auto-excerpt');
      const sourcePath = 'auto-excerpt/index.md';

      const result = factory.createParsedArticle({
        frontMatter,
        content,
        slug,
        sourcePath,
      });

      expect(result.excerpt).toBe('This is some content that should be used as the excerpt.');
    });

    it('should truncate auto-generated excerpt to 160 characters', () => {
      const frontMatter: FrontMatter = {
        title: 'Long Content',
        date: '2025-01-15',
      };
      const content = 'A'.repeat(200);
      const slug = Slug.fromNormalized('long-content');
      const sourcePath = 'long-content/index.md';

      const result = factory.createParsedArticle({
        frontMatter,
        content,
        slug,
        sourcePath,
      });

      expect(result.excerpt.length).toBeLessThanOrEqual(163); // 160 + '...'
      expect(result.excerpt).toMatch(/\.\.\.$/);
    });

    it('should use custom updatedAt when provided', () => {
      const frontMatter: FrontMatter = {
        title: 'Custom Date',
        date: '2025-01-15',
      };
      const content = 'Content';
      const slug = Slug.fromNormalized('custom-date');
      const sourcePath = 'custom-date/index.md';
      const updatedAt = new Date('2025-06-01');

      const result = factory.createParsedArticle({
        frontMatter,
        content,
        slug,
        sourcePath,
        updatedAt,
      });

      expect(result.updatedAt).toEqual(updatedAt);
    });

    it('should handle tags with special characters (C++)', () => {
      const frontMatter: FrontMatter = {
        title: 'C++ Article',
        date: '2025-01-15',
        tags: ['C++', 'Programming'],
      };
      const content = 'Content about C++';
      const slug = Slug.fromNormalized('cpp-article');
      const sourcePath = 'cpp-article/index.md';

      const result = factory.createParsedArticle({
        frontMatter,
        content,
        slug,
        sourcePath,
      });

      expect(result.tags[0]?.name).toBe('C++');
      expect(result.tags[0]?.slug).toBe('c-plus-plus');
    });
  });

  describe('createArticle', () => {
    it('should create an Article from ParsedArticle and HTML', () => {
      const frontMatter: FrontMatter = {
        title: 'Test Article',
        date: '2025-01-15',
        tags: ['TypeScript'],
        aliases: ['Test'],
        draft: false,
        excerpt: 'Custom excerpt',
      };
      const content = '# Hello World';
      const slug = Slug.fromNormalized('test-article');
      const sourcePath = 'test-article/index.md';

      const parsedArticle = factory.createParsedArticle({
        frontMatter,
        content,
        slug,
        sourcePath,
      });

      const html = '<h1>Hello World</h1>';
      const article = factory.createArticle(parsedArticle, html);

      expect(article.slug.toString()).toBe('test-article');
      expect(article.title).toBe('Test Article');
      expect(article.date).toEqual(new Date('2025-01-15'));
      expect(article.html).toBe(html);
      expect(article.tags).toHaveLength(1);
      expect(article.tags[0]?.name).toBe('TypeScript');
      expect(article.aliases).toEqual(['Test']);
      expect(article.draft).toBe(false);
      expect(article.excerpt).toBe('Custom excerpt');
      expect(article.sourcePath).toBe(sourcePath);
      // Article should not have content property (that's only in ParsedArticle)
      expect('content' in article).toBe(false);
    });

    it('should preserve all metadata from ParsedArticle', () => {
      const frontMatter: FrontMatter = {
        title: 'Full Metadata',
        date: '2025-01-15',
        tags: ['A', 'B', 'C'],
        aliases: ['Alias1', 'Alias2'],
        draft: true,
        excerpt: 'My excerpt',
      };
      const content = 'Content';
      const slug = Slug.fromNormalized('full-metadata');
      const sourcePath = 'full-metadata/index.md';
      const updatedAt = new Date('2025-06-15');

      const parsedArticle = factory.createParsedArticle({
        frontMatter,
        content,
        slug,
        sourcePath,
        updatedAt,
      });

      const article = factory.createArticle(parsedArticle, '<p>Content</p>');

      expect(article.title).toBe('Full Metadata');
      expect(article.tags).toHaveLength(3);
      expect(article.aliases).toEqual(['Alias1', 'Alias2']);
      expect(article.draft).toBe(true);
      expect(article.excerpt).toBe('My excerpt');
      expect(article.updatedAt).toEqual(updatedAt);
    });
  });
});
