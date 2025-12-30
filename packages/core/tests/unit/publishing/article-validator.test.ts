import { describe, it, expect } from 'vitest';
import { ArticleValidator } from '../../../src/publishing/article-validator.js';
import { Slug, type ParsedArticle, createTag } from '../../../src/publishing/index.js';

describe('ArticleValidator', () => {
  const validator = new ArticleValidator();

  const createValidArticle = (overrides: Partial<ParsedArticle> = {}): ParsedArticle => ({
    slug: Slug.fromNormalized('test-article'),
    title: 'Test Article',
    date: new Date('2025-01-15'),
    content: '# Test Content',
    tags: [createTag('test')],
    aliases: [],
    draft: false,
    excerpt: 'Test excerpt',
    sourcePath: 'posts/test-article/index.md',
    updatedAt: new Date(),
    ...overrides,
  });

  describe('validate', () => {
    it('should validate a correct article', () => {
      const article = createValidArticle();
      const result = validator.validate(article);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject article with empty slug', () => {
      const article = createValidArticle({ slug: null as unknown as Slug });
      const result = validator.validate(article);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ type: 'missing_title' })
      );
    });

    it('should reject article with empty title', () => {
      const article = createValidArticle({ title: '' });
      const result = validator.validate(article);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ type: 'missing_title' })
      );
    });

    it('should reject article with invalid date', () => {
      const article = createValidArticle({ date: new Date('invalid') });
      const result = validator.validate(article);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ type: 'invalid_date' })
      );
    });

    it('should accept article with draft: true', () => {
      const article = createValidArticle({ draft: true });
      const result = validator.validate(article);

      expect(result.valid).toBe(true);
    });

    it('should normalize tags during validation', () => {
      const article = createValidArticle({ tags: [createTag('TypeScript'), createTag('Machine Learning')] });
      const result = validator.validate(article);

      expect(result.valid).toBe(true);
      // Tags should remain unchanged (normalization happens in TagIndex)
      expect(result.normalizedArticle?.tags).toHaveLength(2);
    });
  });

  describe('detectDuplicates', () => {
    it('should detect duplicate slugs', () => {
      const articles = [
        createValidArticle({ slug: Slug.fromNormalized('same-slug'), sourcePath: 'posts/a/index.md' }),
        createValidArticle({ slug: Slug.fromNormalized('same-slug'), sourcePath: 'posts/b/index.md' }),
      ];

      const errors = validator.detectDuplicates(articles);

      expect(errors).toHaveLength(1);
      expect(errors[0]?.type).toBe('duplicate_slug');
      if (errors[0]?.type === 'duplicate_slug') {
        expect(errors[0].slug).toBe('same-slug');
        expect(errors[0].paths).toContain('posts/a/index.md');
        expect(errors[0].paths).toContain('posts/b/index.md');
      }
    });

    it('should not flag unique slugs as duplicates', () => {
      const articles = [
        createValidArticle({ slug: Slug.fromNormalized('article-one') }),
        createValidArticle({ slug: Slug.fromNormalized('article-two') }),
      ];

      const errors = validator.detectDuplicates(articles);

      expect(errors).toHaveLength(0);
    });
  });

  describe('filterDrafts', () => {
    it('should filter out draft articles', () => {
      const articles = [
        createValidArticle({ slug: Slug.fromNormalized('published'), draft: false }),
        createValidArticle({ slug: Slug.fromNormalized('draft'), draft: true }),
      ];

      const result = validator.filterDrafts(articles);

      expect(result).toHaveLength(1);
      expect(result[0]?.slug.toString()).toBe('published');
    });

    it('should keep all published articles', () => {
      const articles = [
        createValidArticle({ slug: Slug.fromNormalized('a'), draft: false }),
        createValidArticle({ slug: Slug.fromNormalized('b'), draft: false }),
      ];

      const result = validator.filterDrafts(articles);

      expect(result).toHaveLength(2);
    });
  });
});
