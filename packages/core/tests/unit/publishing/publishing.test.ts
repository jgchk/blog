import { describe, it, expect } from 'vitest';
import {
  Slug,
  createTag,
  type Article,
  type ParsedArticle,
  ArticleValidator,
  TagIndex,
  ArticleSorter,
  ArticleFactory,
  ArchiveBuilder,
  PostScanner,
} from '../../../src/publishing/index.js';

describe('Publishing Bounded Context', () => {
  describe('exports', () => {
    it('should export Slug value object', () => {
      expect(Slug).toBeDefined();
      expect(typeof Slug.create).toBe('function');
    });

    it('should export createTag factory', () => {
      expect(createTag).toBeDefined();
      expect(typeof createTag).toBe('function');
    });

    it('should export ArticleValidator', () => {
      expect(ArticleValidator).toBeDefined();
      expect(typeof ArticleValidator.prototype.validate).toBe('function');
    });

    it('should export TagIndex', () => {
      expect(TagIndex).toBeDefined();
      expect(typeof TagIndex.buildFromArticles).toBe('function');
    });

    it('should export ArticleSorter', () => {
      expect(ArticleSorter).toBeDefined();
      expect(typeof ArticleSorter.sortByDate).toBe('function');
    });

    it('should export ArticleFactory', () => {
      expect(ArticleFactory).toBeDefined();
      expect(typeof ArticleFactory.prototype.createParsedArticle).toBe('function');
    });

    it('should export ArchiveBuilder', () => {
      expect(ArchiveBuilder).toBeDefined();
      expect(typeof ArchiveBuilder.buildArchive).toBe('function');
    });

    it('should export PostScanner', () => {
      expect(PostScanner).toBeDefined();
      expect(typeof PostScanner.prototype.isValidPostPath).toBe('function');
    });
  });

  describe('Slug value object', () => {
    it('should create slug from valid input', () => {
      const slug = Slug.create('Hello World');
      expect(slug).not.toBeNull();
      expect(slug?.value).toBe('hello-world');
    });
  });

  describe('createTag factory', () => {
    it('should create tag with name and slug', () => {
      const tag = createTag('TypeScript');
      expect(tag.name).toBe('TypeScript');
      expect(tag.slug).toBe('typescript');
    });
  });

  describe('ArticleValidator', () => {
    it('should validate articles', () => {
      const validator = new ArticleValidator();
      const article: ParsedArticle = {
        slug: Slug.create('test-article')!,
        title: 'Test Article',
        date: new Date('2024-01-15'),
        content: '# Hello',
        tags: [createTag('test')],
        draft: false,
        aliases: [],
      };
      const result = validator.validate(article);
      expect(result.valid).toBe(true);
    });
  });

  describe('TagIndex', () => {
    it('should build from articles', () => {
      const articles: Article[] = [
        {
          slug: Slug.create('test')!,
          title: 'Test',
          date: new Date('2024-01-15'),
          html: '<p>Test</p>',
          excerpt: 'Test',
          tags: [createTag('typescript')],
          draft: false,
          aliases: [],
        },
      ];
      const index = TagIndex.buildFromArticles(articles);
      expect(index.getAllTags()).toHaveLength(1);
    });
  });
});
