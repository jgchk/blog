import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RenderService } from '../../src/services/render-service.js';
import type { StorageAdapter } from '@blog/core';

describe('RenderService Integration', () => {
  let renderService: RenderService;
  let mockStorage: StorageAdapter;

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

  describe('renderArticle', () => {
    it('should parse front matter and render markdown to HTML', async () => {
      const markdown = `---
title: Test Article
date: 2025-01-15
tags:
  - Test
---

# Hello World

This is a test article.`;

      const result = await renderService.renderArticle(markdown, 'test-article');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.article.title).toBe('Test Article');
        expect(result.article.slug).toBe('test-article');
        expect(result.article.html).toContain('<h1>');
        expect(result.article.html).toContain('Hello World');
        expect(result.article.tags).toContain('Test');
      }
    });

    it('should return error for invalid front matter', async () => {
      const markdown = `---
date: 2025-01-15
---

# No Title`;

      const result = await renderService.renderArticle(markdown, 'no-title');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('missing_title');
      }
    });

    it('should generate excerpt from content', async () => {
      const markdown = `---
title: Article with Excerpt
date: 2025-01-15
---

This is the beginning of the article content that will be used for the excerpt.`;

      const result = await renderService.renderArticle(markdown, 'excerpt-test');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.article.excerpt).toContain('beginning of the article');
      }
    });

    it('should use custom excerpt from front matter if provided', async () => {
      const markdown = `---
title: Custom Excerpt Article
date: 2025-01-15
excerpt: This is a custom excerpt.
---

This content should not be used for the excerpt.`;

      const result = await renderService.renderArticle(markdown, 'custom-excerpt');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.article.excerpt).toBe('This is a custom excerpt.');
      }
    });

    it('should mark article as draft when draft: true', async () => {
      const markdown = `---
title: Draft Article
date: 2025-01-15
draft: true
---

This is a draft.`;

      const result = await renderService.renderArticle(markdown, 'draft-article');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.article.draft).toBe(true);
      }
    });
  });

  describe('publishArticle', () => {
    it('should write rendered HTML to storage', async () => {
      const markdown = `---
title: Published Article
date: 2025-01-15
---

# Content`;

      const renderResult = await renderService.renderArticle(markdown, 'published');
      if (!renderResult.success) throw new Error('Render failed');

      await renderService.publishArticle(renderResult.article);

      expect(mockStorage.write).toHaveBeenCalledWith(
        'articles/published/index.html',
        expect.any(Buffer),
        'text/html'
      );
    });
  });
});
