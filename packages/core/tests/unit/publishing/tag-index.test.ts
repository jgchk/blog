import { describe, it, expect } from 'vitest';
import { TagIndex } from '../../../src/publishing/tag-index.js';
import { Slug, createTag, type Article } from '../../../src/publishing/index.js';

describe('TagIndex', () => {
  const createArticle = (slugString: string, tagNames: string[]): Article => ({
    slug: Slug.fromNormalized(slugString),
    title: `Article ${slugString}`,
    date: new Date('2025-01-15'),
    html: '<p>Test content</p>',
    tags: tagNames.map(createTag),
    aliases: [],
    draft: false,
    excerpt: 'Test excerpt',
    sourcePath: `posts/${slugString}/index.md`,
    updatedAt: new Date(),
  });

  describe('buildFromArticles', () => {
    it('should create tag index from articles', () => {
      const articles = [
        createArticle('article-1', ['TypeScript', 'Testing']),
        createArticle('article-2', ['TypeScript', 'JavaScript']),
        createArticle('article-3', ['Testing']),
      ];

      const index = TagIndex.buildFromArticles(articles);

      expect(index.tags).toHaveLength(3);
      expect(index.totalTags).toBe(3);
    });

    it('should normalize tag slugs', () => {
      const articles = [createArticle('article-1', ['Machine Learning'])];

      const index = TagIndex.buildFromArticles(articles);

      const tag = index.getTagBySlug('machine-learning');
      expect(tag).toBeDefined();
      expect(tag?.name).toBe('Machine Learning');
    });

    it('should preserve original tag casing in name', () => {
      const articles = [
        createArticle('article-1', ['TypeScript']),
        createArticle('article-2', ['typescript']), // Different casing
      ];

      const index = TagIndex.buildFromArticles(articles);

      // First occurrence wins for display name
      const tag = index.getTagBySlug('typescript');
      expect(tag?.name).toBe('TypeScript');
    });

    it('should count articles correctly', () => {
      const articles = [
        createArticle('article-1', ['TypeScript', 'Testing']),
        createArticle('article-2', ['TypeScript']),
      ];

      const index = TagIndex.buildFromArticles(articles);

      // Use getTagWithStats to get count and articles
      const tsTag = index.getTagWithStats('typescript');
      expect(tsTag?.count).toBe(2);
      expect(tsTag?.articles).toEqual(['article-1', 'article-2']);

      const testTag = index.getTagWithStats('testing');
      expect(testTag?.count).toBe(1);
    });

    it('should return immutable Tag from getTagBySlug', () => {
      const articles = [
        createArticle('article-1', ['TypeScript']),
      ];

      const index = TagIndex.buildFromArticles(articles);

      // getTagBySlug returns Tag (without stats)
      const tag = index.getTagBySlug('typescript');
      expect(tag).toBeDefined();
      expect(tag?.slug).toBe('typescript');
      expect(tag?.name).toBe('TypeScript');
      // Tag interface no longer has count/articles
      expect((tag as Record<string, unknown>)['count']).toBeUndefined();
    });

    it('should identify most used tag', () => {
      const articles = [
        createArticle('article-1', ['TypeScript', 'Testing']),
        createArticle('article-2', ['TypeScript']),
        createArticle('article-3', ['TypeScript']),
      ];

      const index = TagIndex.buildFromArticles(articles);

      expect(index.mostUsed?.slug).toBe('typescript');
      expect(index.mostUsed?.count).toBe(3);
    });

    it('should return null for mostUsed when no articles', () => {
      const index = TagIndex.buildFromArticles([]);

      expect(index.mostUsed).toBeNull();
    });

    it('should handle articles with no tags', () => {
      const articles = [
        createArticle('article-1', []),
        createArticle('article-2', ['TypeScript']),
      ];

      const index = TagIndex.buildFromArticles(articles);

      expect(index.totalTags).toBe(1);
    });
  });

  describe('getTagBySlug', () => {
    it('should return tag by slug', () => {
      const articles = [createArticle('article-1', ['TypeScript'])];
      const index = TagIndex.buildFromArticles(articles);

      const tag = index.getTagBySlug('typescript');
      expect(tag?.name).toBe('TypeScript');
    });

    it('should return undefined for non-existent tag', () => {
      const articles = [createArticle('article-1', ['TypeScript'])];
      const index = TagIndex.buildFromArticles(articles);

      const tag = index.getTagBySlug('nonexistent');
      expect(tag).toBeUndefined();
    });
  });

  describe('getArticlesByTag', () => {
    it('should return article slugs for a tag', () => {
      const articles = [
        createArticle('article-1', ['TypeScript']),
        createArticle('article-2', ['TypeScript', 'JavaScript']),
        createArticle('article-3', ['JavaScript']),
      ];

      const index = TagIndex.buildFromArticles(articles);

      const tsArticles = index.getArticlesByTag('typescript');
      expect(tsArticles).toEqual(['article-1', 'article-2']);
    });

    it('should return empty array for non-existent tag', () => {
      const articles = [createArticle('article-1', ['TypeScript'])];
      const index = TagIndex.buildFromArticles(articles);

      const articles2 = index.getArticlesByTag('nonexistent');
      expect(articles2).toEqual([]);
    });
  });

  describe('getAllTags', () => {
    it('should return all tags sorted by count descending', () => {
      const articles = [
        createArticle('article-1', ['TypeScript', 'Testing']),
        createArticle('article-2', ['TypeScript']),
        createArticle('article-3', ['TypeScript']),
        createArticle('article-4', ['Testing']),
      ];

      const index = TagIndex.buildFromArticles(articles);
      const allTags = index.getAllTags();

      expect(allTags[0]?.slug).toBe('typescript');
      expect(allTags[0]?.count).toBe(3);
      expect(allTags[1]?.slug).toBe('testing');
      expect(allTags[1]?.count).toBe(2);
    });
  });

  describe('toJSON', () => {
    it('should serialize tag index to JSON', () => {
      const articles = [createArticle('article-1', ['TypeScript'])];
      const index = TagIndex.buildFromArticles(articles);

      const json = index.toJSON();

      expect(json).toHaveProperty('tags');
      expect(json).toHaveProperty('totalTags');
      expect(json.tags).toHaveLength(1);
    });
  });
});
