import { describe, it, expect } from 'vitest';
import {
  createRenderError,
  formatRenderError,
  articleToRendered,
} from '../../src/types.js';
import { Slug, type Article } from '@blog/core';

describe('createRenderError', () => {
  it('should create error from Error instance', () => {
    const err = new Error('Parse failed');
    err.stack = 'Error: Parse failed\n  at test.ts:10:5';

    const result = createRenderError('parse', '/path/to/file.md', err);

    expect(result.type).toBe('parse');
    expect(result.file).toBe('/path/to/file.md');
    expect(result.message).toBe('Parse failed');
    expect(result.stack).toContain('Parse failed');
  });

  it('should handle non-Error values', () => {
    const result = createRenderError('unknown', '/path/to/file.md', 'string error');

    expect(result.type).toBe('unknown');
    expect(result.message).toBe('Unknown error occurred');
    expect(result.stack).toBeUndefined();
  });

  it('should handle null/undefined', () => {
    const result = createRenderError('frontmatter', '/path/to/file.md', null);

    expect(result.type).toBe('frontmatter');
    expect(result.message).toBe('Unknown error occurred');
  });
});

describe('formatRenderError', () => {
  it('should format error without line info', () => {
    const error = {
      type: 'parse' as const,
      message: 'Invalid markdown syntax',
      file: '/posts/test/index.md',
    };

    const result = formatRenderError(error);

    expect(result).toBe(
      'Error in /posts/test/index.md:\n  Invalid markdown syntax'
    );
  });

  it('should format error with line number', () => {
    const error = {
      type: 'frontmatter' as const,
      message: 'Missing title field',
      file: '/posts/test/index.md',
      line: 5,
    };

    const result = formatRenderError(error);

    expect(result).toContain('(line 5)');
  });

  it('should format error with line and column', () => {
    const error = {
      type: 'template' as const,
      message: 'Unexpected token',
      file: '/templates/article.html',
      line: 10,
      column: 25,
    };

    const result = formatRenderError(error);

    expect(result).toContain('(line 10, column 25)');
  });
});

describe('articleToRendered', () => {
  it('should convert article to rendered format', () => {
    const article: Article = {
      slug: Slug.fromNormalized('test-post'),
      title: 'Test Post',
      date: new Date('2025-01-15'),
      content: '# Hello',
      html: '<h1>Hello</h1>',
      tags: ['test', 'demo'],
      aliases: [],
      draft: false,
      excerpt: 'A test post',
      sourcePath: '/posts/test-post/index.md',
      updatedAt: new Date('2025-01-16'),
    };

    const result = articleToRendered(article, '<article>...</article>', [
      'hero.png',
    ]);

    expect(result.slug).toBe('test-post');
    expect(result.html).toBe('<article>...</article>');
    expect(result.metadata.title).toBe('Test Post');
    expect(result.metadata.date).toEqual(article.date);
    expect(result.metadata.tags).toEqual(['test', 'demo']);
    expect(result.metadata.excerpt).toBe('A test post');
    expect(result.assets).toEqual(['hero.png']);
    expect(result.error).toBeNull();
    expect(result.renderedAt).toBeInstanceOf(Date);
  });
});
