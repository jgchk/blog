import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { TemplateRenderer } from '../../../src/services/template-renderer.js';
import { Slug, createTag, type Article, type TagWithStats } from '@blog/core';

describe('TemplateRenderer', () => {
  let tempDir: string;
  let renderer: TemplateRenderer;

  // Create minimal test templates
  const articleTemplate = `<!DOCTYPE html>
<html>
<head><title>{{title}}</title></head>
<body>
<h1>{{title}}</h1>
<time datetime="{{dateIso}}">{{dateFormatted}}</time>
<div>{{{content}}}</div>
{{#each tags}}<a href="/tags/{{slug}}.html">{{name}}</a>{{/each}}
<footer>&copy; {{year}}</footer>
</body>
</html>`;

  const tagTemplate = `<!DOCTYPE html>
<html>
<head><title>Tag: {{tagName}}</title></head>
<body>
<h1>Tag: {{tagName}}</h1>
<p>{{articleCount}} {{#if isPlural}}articles{{else}}article{{/if}}</p>
{{#each articles}}
<article>
<h2><a href="/articles/{{slug}}/">{{title}}</a></h2>
<time datetime="{{dateIso}}">{{dateFormatted}}</time>
<p>{{excerpt}}</p>
</article>
{{/each}}
<footer>&copy; {{year}}</footer>
</body>
</html>`;

  const tagsTemplate = `<!DOCTYPE html>
<html>
<head><title>All Tags</title></head>
<body>
<h1>All Tags</h1>
{{#if tags.length}}
<p>Showing {{totalTags}} tags</p>
<ul>
{{#each tags}}
<li><a href="/tags/{{slug}}.html">{{name}} ({{count}})</a></li>
{{/each}}
</ul>
{{else}}
<p>No tags yet.</p>
{{/if}}
<footer>&copy; {{year}}</footer>
</body>
</html>`;

  beforeEach(async () => {
    // Create temp directory with test templates
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'template-renderer-test-'));

    await fs.writeFile(path.join(tempDir, 'article.html'), articleTemplate);
    await fs.writeFile(path.join(tempDir, 'tag.html'), tagTemplate);
    await fs.writeFile(path.join(tempDir, 'tags.html'), tagsTemplate);

    renderer = new TemplateRenderer(tempDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('loadTemplate', () => {
    it('should load and compile a template', async () => {
      const template = await renderer.loadTemplate('article');
      expect(template).toBeDefined();
      expect(typeof template).toBe('function');
    });

    it('should cache templates', async () => {
      const template1 = await renderer.loadTemplate('article');
      const template2 = await renderer.loadTemplate('article');
      expect(template1).toBe(template2);
    });

    it('should throw for non-existent template', async () => {
      await expect(renderer.loadTemplate('nonexistent')).rejects.toThrow();
    });
  });

  describe('clearCache', () => {
    it('should clear the template cache', async () => {
      await renderer.loadTemplate('article');
      renderer.clearCache();

      // Modify the template file
      await fs.writeFile(
        path.join(tempDir, 'article.html'),
        '<html><body>Modified</body></html>'
      );

      // Should load the new version
      const template = await renderer.loadTemplate('article');
      const result = template({});
      expect(result).toContain('Modified');
    });
  });

  describe('formatDate', () => {
    it('should format date to ISO and human-readable formats', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      const { dateIso, dateFormatted } = renderer.formatDate(date);

      expect(dateIso).toBe('2025-01-15');
      expect(dateFormatted).toContain('2025');
      expect(dateFormatted).toContain('January');
      expect(dateFormatted).toContain('15');
    });
  });

  describe('renderArticle', () => {
    const createTestArticle = (overrides: Partial<Article> & { tagNames?: string[] } = {}): Article => {
      const { tagNames = ['TypeScript', 'Testing'], ...rest } = overrides;
      return {
        slug: Slug.fromNormalized('test-article'),
        title: 'Test Article',
        date: new Date('2025-01-15'),
        html: '<h1>Hello</h1>',
        tags: tagNames.map(createTag),
        aliases: [],
        draft: false,
        excerpt: 'A test article',
        sourcePath: 'posts/test-article/index.md',
        updatedAt: new Date(),
        ...rest,
      };
    };

    it('should render an article with all fields', async () => {
      const article = createTestArticle();
      const html = await renderer.renderArticle(article);

      expect(html).toContain('Test Article');
      expect(html).toContain('<h1>Hello</h1>');
      expect(html).toContain('2025-01-15');
      expect(html).toContain('TypeScript');
      expect(html).toContain('Testing');
    });

    it('should include the current year', async () => {
      const article = createTestArticle();
      const html = await renderer.renderArticle(article);

      const currentYear = new Date().getFullYear();
      expect(html).toContain(`${currentYear}`);
    });

    it('should normalize tag slugs', async () => {
      const article = createTestArticle({ tagNames: ['Machine Learning'] });
      const html = await renderer.renderArticle(article);

      expect(html).toContain('/tags/machine-learning.html');
    });

    it('should handle articles with no tags', async () => {
      const article = createTestArticle({ tagNames: [] });
      const html = await renderer.renderArticle(article);

      expect(html).toContain('Test Article');
      expect(html).not.toContain('/tags/');
    });
  });

  describe('renderTagPage', () => {
    const createTagWithStats = (overrides: Partial<TagWithStats> = {}): TagWithStats => ({
      slug: 'typescript',
      name: 'TypeScript',
      count: 2,
      articles: ['article-1', 'article-2'],
      ...overrides,
    });

    const createTagPageArticle = (slugString: string, title: string): Article => ({
      slug: Slug.fromNormalized(slugString),
      title,
      date: new Date('2025-01-15'),
      html: '<p>Content</p>',
      tags: [createTag('TypeScript')],
      aliases: [],
      draft: false,
      excerpt: `Excerpt for ${title}`,
      sourcePath: `posts/${slugString}/index.md`,
      updatedAt: new Date(),
    });

    it('should render a tag page with articles', async () => {
      const tag = createTagWithStats();
      const articles = [
        createTagPageArticle('article-1', 'First Article'),
        createTagPageArticle('article-2', 'Second Article'),
      ];

      const html = await renderer.renderTagPage(tag, articles);

      expect(html).toContain('TypeScript');
      expect(html).toContain('First Article');
      expect(html).toContain('Second Article');
      expect(html).toContain('2 articles');
    });

    it('should use singular for single article', async () => {
      const tag = createTagWithStats({ count: 1, articles: ['article-1'] });
      const articles = [createTagPageArticle('article-1', 'Single Article')];

      const html = await renderer.renderTagPage(tag, articles);

      expect(html).toContain('1 article');
      expect(html).not.toContain('1 articles');
    });

    it('should sort articles by date descending', async () => {
      const tag = createTagWithStats();
      const articles = [
        { ...createTagPageArticle('old', 'Old Article'), date: new Date('2024-01-01') },
        { ...createTagPageArticle('new', 'New Article'), date: new Date('2025-01-01') },
      ];

      const html = await renderer.renderTagPage(tag, articles);

      // New article should appear before old article
      const newIndex = html.indexOf('New Article');
      const oldIndex = html.indexOf('Old Article');
      expect(newIndex).toBeLessThan(oldIndex);
    });

    it('should handle empty articles list', async () => {
      const tag = createTagWithStats({ count: 0, articles: [] });
      const html = await renderer.renderTagPage(tag, []);

      expect(html).toContain('0 articles');
    });
  });

  describe('renderAllTagsPage', () => {
    it('should render all tags page', async () => {
      const tags = [
        { name: 'TypeScript', slug: 'typescript', count: 5 },
        { name: 'JavaScript', slug: 'javascript', count: 3 },
        { name: 'Testing', slug: 'testing', count: 2 },
      ];

      const html = await renderer.renderAllTagsPage(tags);

      expect(html).toContain('TypeScript');
      expect(html).toContain('JavaScript');
      expect(html).toContain('Testing');
      expect(html).toContain('3 tags');
    });

    it('should sort tags alphabetically', async () => {
      const tags = [
        { name: 'Zebra', slug: 'zebra', count: 1 },
        { name: 'Alpha', slug: 'alpha', count: 1 },
        { name: 'Beta', slug: 'beta', count: 1 },
      ];

      const html = await renderer.renderAllTagsPage(tags);

      const alphaIndex = html.indexOf('Alpha');
      const betaIndex = html.indexOf('Beta');
      const zebraIndex = html.indexOf('Zebra');

      expect(alphaIndex).toBeLessThan(betaIndex);
      expect(betaIndex).toBeLessThan(zebraIndex);
    });

    it('should sort case-insensitively', async () => {
      const tags = [
        { name: 'zebra', slug: 'zebra', count: 1 },
        { name: 'Alpha', slug: 'alpha', count: 1 },
      ];

      const html = await renderer.renderAllTagsPage(tags);

      const alphaIndex = html.indexOf('Alpha');
      const zebraIndex = html.indexOf('zebra');

      expect(alphaIndex).toBeLessThan(zebraIndex);
    });

    it('should handle empty tags list', async () => {
      const html = await renderer.renderAllTagsPage([]);

      expect(html).toContain('No tags yet');
    });

    it('should include tag counts', async () => {
      const tags = [
        { name: 'TypeScript', slug: 'typescript', count: 5 },
      ];

      const html = await renderer.renderAllTagsPage(tags);

      expect(html).toContain('(5)');
    });
  });

  describe('escapeHtml', () => {
    it('should escape ampersand', () => {
      expect(renderer.escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape less than', () => {
      expect(renderer.escapeHtml('a < b')).toBe('a &lt; b');
    });

    it('should escape greater than', () => {
      expect(renderer.escapeHtml('a > b')).toBe('a &gt; b');
    });

    it('should escape double quotes', () => {
      expect(renderer.escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('should escape single quotes', () => {
      expect(renderer.escapeHtml("it's")).toBe('it&#039;s');
    });

    it('should escape multiple characters', () => {
      expect(renderer.escapeHtml('<script>"alert"</script>')).toBe(
        '&lt;script&gt;&quot;alert&quot;&lt;/script&gt;'
      );
    });
  });

  describe('renderHomePage', () => {
    const createHomePageArticle = (slugString: string, title: string, date: Date): Article => ({
      slug: Slug.fromNormalized(slugString),
      title,
      date,
      html: '<p>Content</p>',
      tags: [createTag('TypeScript')],
      aliases: [],
      draft: false,
      excerpt: `Excerpt for ${title}`,
      sourcePath: `posts/${slugString}/index.md`,
      updatedAt: new Date(),
    });

    beforeEach(async () => {
      // Add home page template (index.html)
      const homeTemplate = `<!DOCTYPE html>
<html>
<head><title>Blog</title></head>
<body>
<h1>Recent Articles</h1>
{{#each articles}}
<article>
<h2><a href="/articles/{{slug}}/">{{title}}</a></h2>
<time datetime="{{dateIso}}">{{dateFormatted}}</time>
<p>{{excerpt}}</p>
</article>
{{/each}}
{{#if hasMoreArticles}}<a href="/archive/">View all articles</a>{{/if}}
<footer>&copy; {{year}}</footer>
</body>
</html>`;
      await fs.writeFile(path.join(tempDir, 'index.html'), homeTemplate);
    });

    it('should render home page with articles', async () => {
      const articles = [
        createHomePageArticle('article-1', 'First Article', new Date('2025-01-15')),
        createHomePageArticle('article-2', 'Second Article', new Date('2025-01-10')),
      ];

      const html = await renderer.renderHomePage(articles);

      expect(html).toContain('Recent Articles');
      expect(html).toContain('First Article');
      expect(html).toContain('Second Article');
    });

    it('should show "View all articles" when hasMoreArticles is true', async () => {
      const articles = [
        createHomePageArticle('article-1', 'Article 1', new Date('2025-01-15')),
      ];

      const html = await renderer.renderHomePage(articles, true);

      expect(html).toContain('View all articles');
    });

    it('should not show "View all articles" when hasMoreArticles is false', async () => {
      const articles = [
        createHomePageArticle('article-1', 'Article 1', new Date('2025-01-15')),
      ];

      const html = await renderer.renderHomePage(articles, false);

      expect(html).not.toContain('View all articles');
    });

    it('should include current year in footer', async () => {
      const html = await renderer.renderHomePage([]);
      const currentYear = new Date().getFullYear();
      expect(html).toContain(`${currentYear}`);
    });
  });

  describe('renderArchivePage', () => {
    beforeEach(async () => {
      // Add archive page template
      const archiveTemplate = `<!DOCTYPE html>
<html>
<head><title>Archive</title></head>
<body>
<h1>Archive</h1>
<p>{{totalArticles}} {{#if isTotalPlural}}articles{{else}}article{{/if}} total</p>
{{#each archiveGroups}}
<section>
<h2>{{displayName}}</h2>
<p>{{count}} {{#if isPlural}}articles{{else}}article{{/if}}</p>
<ul>
{{#each articles}}
<li>
<time datetime="{{dateIso}}">{{dateFormatted}}</time>
<a href="/articles/{{slug}}/">{{title}}</a>
</li>
{{/each}}
</ul>
</section>
{{/each}}
<footer>&copy; {{year}}</footer>
</body>
</html>`;
      await fs.writeFile(path.join(tempDir, 'archive.html'), archiveTemplate);
    });

    it('should render archive page with grouped articles', async () => {
      const archiveGroups = [
        {
          yearMonth: '2025-01',
          displayName: 'January 2025',
          count: 2,
          articles: [
            { slug: 'article-1', title: 'Article 1', date: new Date('2025-01-15'), excerpt: 'Excerpt 1' },
            { slug: 'article-2', title: 'Article 2', date: new Date('2025-01-10'), excerpt: 'Excerpt 2' },
          ],
        },
      ];

      const html = await renderer.renderArchivePage(archiveGroups, 2);

      expect(html).toContain('Archive');
      expect(html).toContain('January 2025');
      expect(html).toContain('Article 1');
      expect(html).toContain('Article 2');
      expect(html).toContain('2 articles total');
    });

    it('should use singular "article" for single total', async () => {
      const archiveGroups = [
        {
          yearMonth: '2025-01',
          displayName: 'January 2025',
          count: 1,
          articles: [
            { slug: 'article-1', title: 'Article 1', date: new Date('2025-01-15'), excerpt: 'Excerpt' },
          ],
        },
      ];

      const html = await renderer.renderArchivePage(archiveGroups, 1);

      expect(html).toContain('1 article total');
      expect(html).not.toContain('1 articles total');
    });

    it('should use singular "article" for single article in group', async () => {
      const archiveGroups = [
        {
          yearMonth: '2025-01',
          displayName: 'January 2025',
          count: 1,
          articles: [
            { slug: 'article-1', title: 'Article 1', date: new Date('2025-01-15'), excerpt: 'Excerpt' },
          ],
        },
      ];

      const html = await renderer.renderArchivePage(archiveGroups, 1);

      // Should show "1 article" (singular) for the group
      const groupSection = html.substring(html.indexOf('January 2025'));
      expect(groupSection).toContain('1 article');
    });

    it('should include current year in footer', async () => {
      const html = await renderer.renderArchivePage([], 0);
      const currentYear = new Date().getFullYear();
      expect(html).toContain(`${currentYear}`);
    });
  });
});
