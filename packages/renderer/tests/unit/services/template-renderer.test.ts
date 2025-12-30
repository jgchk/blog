import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { TemplateRenderer } from '../../../src/services/template-renderer.js';
import type { Article, TagWithStats } from '@blog/core';

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
    const createArticle = (overrides: Partial<Article> = {}): Article => ({
      slug: 'test-article',
      title: 'Test Article',
      date: new Date('2025-01-15'),
      content: '# Hello',
      html: '<h1>Hello</h1>',
      tags: ['TypeScript', 'Testing'],
      aliases: [],
      draft: false,
      excerpt: 'A test article',
      sourcePath: 'posts/test-article/index.md',
      updatedAt: new Date(),
      ...overrides,
    });

    it('should render an article with all fields', async () => {
      const article = createArticle();
      const html = await renderer.renderArticle(article);

      expect(html).toContain('Test Article');
      expect(html).toContain('<h1>Hello</h1>');
      expect(html).toContain('2025-01-15');
      expect(html).toContain('TypeScript');
      expect(html).toContain('Testing');
    });

    it('should include the current year', async () => {
      const article = createArticle();
      const html = await renderer.renderArticle(article);

      const currentYear = new Date().getFullYear();
      expect(html).toContain(`${currentYear}`);
    });

    it('should normalize tag slugs', async () => {
      const article = createArticle({ tags: ['Machine Learning'] });
      const html = await renderer.renderArticle(article);

      expect(html).toContain('/tags/machine-learning.html');
    });

    it('should handle articles with no tags', async () => {
      const article = createArticle({ tags: [] });
      const html = await renderer.renderArticle(article);

      expect(html).toContain('Test Article');
      expect(html).not.toContain('/tags/');
    });
  });

  describe('renderTagPage', () => {
    const createTag = (overrides: Partial<TagWithStats> = {}): TagWithStats => ({
      slug: 'typescript',
      name: 'TypeScript',
      count: 2,
      articles: ['article-1', 'article-2'],
      ...overrides,
    });

    const createArticle = (slug: string, title: string): Article => ({
      slug,
      title,
      date: new Date('2025-01-15'),
      content: 'Content',
      html: '<p>Content</p>',
      tags: ['TypeScript'],
      aliases: [],
      draft: false,
      excerpt: `Excerpt for ${title}`,
      sourcePath: `posts/${slug}/index.md`,
      updatedAt: new Date(),
    });

    it('should render a tag page with articles', async () => {
      const tag = createTag();
      const articles = [
        createArticle('article-1', 'First Article'),
        createArticle('article-2', 'Second Article'),
      ];

      const html = await renderer.renderTagPage(tag, articles);

      expect(html).toContain('TypeScript');
      expect(html).toContain('First Article');
      expect(html).toContain('Second Article');
      expect(html).toContain('2 articles');
    });

    it('should use singular for single article', async () => {
      const tag = createTag({ count: 1, articles: ['article-1'] });
      const articles = [createArticle('article-1', 'Single Article')];

      const html = await renderer.renderTagPage(tag, articles);

      expect(html).toContain('1 article');
      expect(html).not.toContain('1 articles');
    });

    it('should sort articles by date descending', async () => {
      const tag = createTag();
      const articles = [
        { ...createArticle('old', 'Old Article'), date: new Date('2024-01-01') },
        { ...createArticle('new', 'New Article'), date: new Date('2025-01-01') },
      ];

      const html = await renderer.renderTagPage(tag, articles);

      // New article should appear before old article
      const newIndex = html.indexOf('New Article');
      const oldIndex = html.indexOf('Old Article');
      expect(newIndex).toBeLessThan(oldIndex);
    });

    it('should handle empty articles list', async () => {
      const tag = createTag({ count: 0, articles: [] });
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
});
