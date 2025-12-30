import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RenderService } from '../../../src/services/render-service.js';
import { TagIndex, type StorageAdapter, type Article, type Tag } from '@blog/core';

describe('RenderService Tag Page Methods', () => {
  let renderService: RenderService;
  let mockStorage: StorageAdapter;

  const createMockArticle = (overrides: Partial<Article> = {}): Article => ({
    slug: 'test-article',
    title: 'Test Article',
    date: new Date('2025-01-15'),
    content: '# Test',
    html: '<h1>Test</h1>',
    tags: ['TypeScript'],
    aliases: [],
    draft: false,
    excerpt: 'Test excerpt',
    sourcePath: 'posts/test-article/index.md',
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockTag = (overrides: Partial<Tag> = {}): Tag => ({
    slug: 'typescript',
    name: 'TypeScript',
    count: 1,
    articles: ['test-article'],
    ...overrides,
  });

  beforeEach(() => {
    mockStorage = {
      read: vi.fn(),
      write: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      exists: vi.fn().mockResolvedValue(false),
    };

    renderService = new RenderService(mockStorage);
  });

  describe('renderTagPage', () => {
    it('should return valid HTML with correct TagPageContext fields', () => {
      const tag = createMockTag();
      const articles = [createMockArticle()];

      const html = renderService.renderTagPage(tag, articles);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Tag: TypeScript</title>');
      expect(html).toContain('Tag: TypeScript');
      expect(html).toContain('1 article');
      expect(html).toContain('Test Article');
      expect(html).toContain('Test excerpt');
    });

    it('should sort articles by date descending (newest first)', () => {
      const tag = createMockTag({ count: 3, articles: ['old', 'middle', 'new'] });
      const articles = [
        createMockArticle({ slug: 'old', title: 'Old Article', date: new Date('2025-01-01') }),
        createMockArticle({ slug: 'middle', title: 'Middle Article', date: new Date('2025-01-10') }),
        createMockArticle({ slug: 'new', title: 'New Article', date: new Date('2025-01-20') }),
      ];

      const html = renderService.renderTagPage(tag, articles);

      // New article should appear before old article in the HTML
      const newIndex = html.indexOf('New Article');
      const middleIndex = html.indexOf('Middle Article');
      const oldIndex = html.indexOf('Old Article');

      expect(newIndex).toBeLessThan(middleIndex);
      expect(middleIndex).toBeLessThan(oldIndex);
    });

    it('should handle plural article count correctly', () => {
      const tag = createMockTag({ count: 3 });
      const articles = [
        createMockArticle({ slug: 'a1' }),
        createMockArticle({ slug: 'a2' }),
        createMockArticle({ slug: 'a3' }),
      ];

      const html = renderService.renderTagPage(tag, articles);

      expect(html).toContain('3 articles');
    });

    it('should handle singular article count correctly', () => {
      const tag = createMockTag({ count: 1 });
      const articles = [createMockArticle()];

      const html = renderService.renderTagPage(tag, articles);

      expect(html).toContain('1 article');
      expect(html).not.toContain('1 articles');
    });

    it('should contain article links matching /articles/{slug}/ pattern (FR-008)', () => {
      const tag = createMockTag();
      const articles = [createMockArticle({ slug: 'my-test-article' })];

      const html = renderService.renderTagPage(tag, articles);

      expect(html).toContain('href="/articles/my-test-article/"');
    });

    it('should escape HTML in tag names and article content', () => {
      const tag = createMockTag({ name: '<script>alert("xss")</script>', slug: 'script' });
      const articles = [createMockArticle({ title: '<b>Bold</b>', excerpt: '<i>Italic</i>' })];

      const html = renderService.renderTagPage(tag, articles);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<b>Bold</b>');
      expect(html).toContain('&lt;b&gt;Bold&lt;/b&gt;');
    });
  });

  describe('publishTagPage', () => {
    it('should write to S3 key tags/{slug}.html', async () => {
      const tag = createMockTag({ slug: 'typescript' });
      const articles = [createMockArticle()];

      await renderService.publishTagPage(tag, articles);

      expect(mockStorage.write).toHaveBeenCalledWith(
        'tags/typescript.html',
        expect.any(Buffer),
        'text/html'
      );
    });

    it('should normalize tag slug to lowercase for S3 key (FR-005)', async () => {
      const tag = createMockTag({ slug: 'TypeScript', name: 'TypeScript' });
      const articles = [createMockArticle()];

      await renderService.publishTagPage(tag, articles);

      expect(mockStorage.write).toHaveBeenCalledWith(
        'tags/typescript.html',
        expect.any(Buffer),
        'text/html'
      );
    });

    it('should skip tags with zero articles and log warning', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const tag = createMockTag({ count: 0, articles: [] });
      const articles: Article[] = [];

      await renderService.publishTagPage(tag, articles);

      expect(mockStorage.write).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping tag'));
      consoleSpy.mockRestore();
    });
  });

  describe('publishAllTagPages', () => {
    it('should call publishTagPage for each tag from TagIndex', async () => {
      const articles = [
        createMockArticle({ slug: 'a1', tags: ['TypeScript'] }),
        createMockArticle({ slug: 'a2', tags: ['JavaScript'] }),
      ];
      const tagIndex = TagIndex.buildFromArticles(articles);

      await renderService.publishAllTagPages(tagIndex, articles);

      // Should write two tag pages
      expect(mockStorage.write).toHaveBeenCalledTimes(2);
      expect(mockStorage.write).toHaveBeenCalledWith(
        'tags/typescript.html',
        expect.any(Buffer),
        'text/html'
      );
      expect(mockStorage.write).toHaveBeenCalledWith(
        'tags/javascript.html',
        expect.any(Buffer),
        'text/html'
      );
    });

    it('should filter articles correctly for each tag', async () => {
      const articles = [
        createMockArticle({ slug: 'a1', title: 'TS Article', tags: ['TypeScript'] }),
        createMockArticle({ slug: 'a2', title: 'JS Article', tags: ['JavaScript'] }),
        createMockArticle({ slug: 'a3', title: 'Both Article', tags: ['TypeScript', 'JavaScript'] }),
      ];
      const tagIndex = TagIndex.buildFromArticles(articles);

      await renderService.publishAllTagPages(tagIndex, articles);

      // Get the calls to write
      const writeCalls = (mockStorage.write as ReturnType<typeof vi.fn>).mock.calls;

      // Find TypeScript page content
      const tsCall = writeCalls.find(
        (call: [string, Buffer, string]) => call[0] === 'tags/typescript.html'
      );
      const tsHtml = tsCall ? tsCall[1].toString() : '';

      // TypeScript page should have 2 articles (TS Article and Both Article)
      expect(tsHtml).toContain('TS Article');
      expect(tsHtml).toContain('Both Article');
      expect(tsHtml).not.toContain('JS Article');
    });
  });

  describe('renderAllTagsPage', () => {
    it('should contain tag links matching /tags/{slug}.html pattern (FR-008)', () => {
      const articles = [
        createMockArticle({ tags: ['TypeScript'] }),
        createMockArticle({ slug: 'a2', tags: ['JavaScript'] }),
      ];

      const html = renderService.renderAllTagsPage(articles);

      expect(html).toContain('href="/tags/typescript.html"');
      expect(html).toContain('href="/tags/javascript.html"');
    });

    it('should use clean URL /archive/ for archive navigation link', () => {
      const articles = [createMockArticle()];

      const html = renderService.renderAllTagsPage(articles);

      expect(html).toContain('href="/archive/"');
      expect(html).not.toContain('href="/archive.html"');
    });
  });

  describe('renderTagPage navigation links', () => {
    it('should use clean URL /archive/ for archive navigation link', () => {
      const tag = createMockTag();
      const articles = [createMockArticle()];

      const html = renderService.renderTagPage(tag, articles);

      expect(html).toContain('href="/archive/"');
      expect(html).not.toContain('href="/archive.html"');
    });
  });
});
