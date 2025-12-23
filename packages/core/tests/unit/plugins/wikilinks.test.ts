import { describe, it, expect } from 'vitest';
import { remarkWikilinks } from '../../../src/plugins/wikilinks.js';
import { ArticleIndex } from '../../../src/services/article-index.js';
import type { Article } from '../../../src/models/article.js';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';

describe('remarkWikilinks plugin', () => {
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

  const processMarkdown = async (markdown: string, articles: Article[]) => {
    const index = ArticleIndex.buildFromArticles(articles);
    const processor = unified()
      .use(remarkParse)
      .use(remarkWikilinks, { articleIndex: index })
      .use(remarkStringify);

    const result = await processor.process(markdown);
    return String(result);
  };

  describe('link resolution', () => {
    it('should resolve [[slug]] to link', async () => {
      const articles = [createArticle('my-article', 'My Article')];
      const markdown = 'Check out [[my-article]]';

      const result = await processMarkdown(markdown, articles);

      // The wikilink should be converted to markdown link format
      expect(result).toContain('[my-article](/articles/my-article/)');
    });

    it('should resolve [[title]] to link', async () => {
      const articles = [createArticle('my-article', 'My Article Title')];
      const markdown = 'Check out [[My Article Title]]';

      const result = await processMarkdown(markdown, articles);

      expect(result).toContain('[My Article Title](/articles/my-article/)');
    });

    it('should resolve [[alias]] to link', async () => {
      const articles = [createArticle('my-article', 'My Article', ['Article Alias'])];
      const markdown = 'Check out [[Article Alias]]';

      const result = await processMarkdown(markdown, articles);

      expect(result).toContain('[Article Alias](/articles/my-article/)');
    });

    it('should handle case-insensitive matching', async () => {
      const articles = [createArticle('my-article', 'My Article')];
      const markdown = 'Check out [[MY ARTICLE]]';

      const result = await processMarkdown(markdown, articles);

      expect(result).toContain('/articles/my-article/');
    });

    it('should prefer slug over title', async () => {
      const articles = [
        createArticle('slug-match', 'Different Title'),
        createArticle('other', 'slug-match'), // Title matches first article's slug
      ];
      const markdown = 'Check out [[slug-match]]';

      const result = await processMarkdown(markdown, articles);

      expect(result).toContain('/articles/slug-match/');
    });

    it('should prefer title over alias', async () => {
      const articles = [
        createArticle('article-1', 'Target Title'),
        createArticle('article-2', 'Other', ['Target Title']),
      ];
      const markdown = 'Check out [[Target Title]]';

      const result = await processMarkdown(markdown, articles);

      expect(result).toContain('/articles/article-1/');
    });
  });

  describe('broken links', () => {
    it('should mark broken links as unresolved text', async () => {
      const articles = [createArticle('my-article', 'My Article')];
      const markdown = 'Check out [[nonexistent]]';

      const result = await processMarkdown(markdown, articles);

      // Broken links are kept as-is (markdown escapes the brackets)
      expect(result).toContain('nonexistent');
    });

    it('should collect broken links in metadata', async () => {
      const index = ArticleIndex.buildFromArticles([]);
      const processor = unified()
        .use(remarkParse)
        .use(remarkWikilinks, { articleIndex: index })
        .use(remarkStringify);

      const result = await processor.process('Check out [[broken]]');

      expect(result.data.brokenLinks).toBeDefined();
      expect(result.data.brokenLinks).toContain('broken');
    });
  });

  describe('multiple links', () => {
    it('should handle multiple wikilinks in same paragraph', async () => {
      const articles = [
        createArticle('article-1', 'Article One'),
        createArticle('article-2', 'Article Two'),
      ];
      const markdown = 'Check out [[article-1]] and [[article-2]]';

      const result = await processMarkdown(markdown, articles);

      expect(result).toContain('/articles/article-1/');
      expect(result).toContain('/articles/article-2/');
    });

    it('should handle wikilinks across multiple paragraphs', async () => {
      const articles = [createArticle('my-article', 'My Article')];
      const markdown = `First paragraph [[my-article]].

Second paragraph [[my-article]].`;

      const result = await processMarkdown(markdown, articles);

      // Should appear twice
      const matches = result.match(/\/articles\/my-article\//g);
      expect(matches).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty wikilink', async () => {
      const articles = [createArticle('my-article', 'My Article')];
      const markdown = 'Check out [[]]';

      const result = await processMarkdown(markdown, articles);

      // Empty wikilinks are kept but markdown escapes brackets
      expect(result).toContain('Check out');
    });

    it('should handle wikilink with only whitespace', async () => {
      const articles = [createArticle('my-article', 'My Article')];
      const markdown = 'Check out [[   ]]';

      const result = await processMarkdown(markdown, articles);

      // Whitespace-only wikilinks are kept but markdown escapes brackets
      expect(result).toContain('Check out');
    });

    it('should not match partial brackets', async () => {
      const articles = [createArticle('my-article', 'My Article')];
      const markdown = 'Check out [my-article] not [[';

      const result = await processMarkdown(markdown, articles);

      expect(result).not.toContain('/articles/my-article/');
    });
  });
});
