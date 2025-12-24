import { describe, it, expect } from 'vitest';
import { categorizeFile, extractSlug } from '../../src/watcher.js';

describe('categorizeFile', () => {
  const postsDir = '/blog/posts';
  const stylesDir = '/blog/packages/site/src/styles';
  const templatesDir = '/blog/packages/site/src/templates';

  it('should categorize markdown files as markdown', () => {
    const result = categorizeFile(
      '/blog/posts/my-post/index.md',
      postsDir,
      stylesDir,
      templatesDir
    );
    expect(result).toBe('markdown');
  });

  it('should categorize any .md file in posts as markdown', () => {
    const result = categorizeFile(
      '/blog/posts/my-post/draft.md',
      postsDir,
      stylesDir,
      templatesDir
    );
    expect(result).toBe('markdown');
  });

  it('should categorize CSS files as css', () => {
    const result = categorizeFile(
      '/blog/packages/site/src/styles/main.css',
      postsDir,
      stylesDir,
      templatesDir
    );
    expect(result).toBe('css');
  });

  it('should categorize template files as template', () => {
    const result = categorizeFile(
      '/blog/packages/site/src/templates/article.html',
      postsDir,
      stylesDir,
      templatesDir
    );
    expect(result).toBe('template');
  });

  it('should categorize images in posts as asset', () => {
    const result = categorizeFile(
      '/blog/posts/my-post/hero.png',
      postsDir,
      stylesDir,
      templatesDir
    );
    expect(result).toBe('asset');
  });

  it('should categorize other files as asset', () => {
    const result = categorizeFile(
      '/blog/unknown/file.txt',
      postsDir,
      stylesDir,
      templatesDir
    );
    expect(result).toBe('asset');
  });
});

describe('extractSlug', () => {
  const postsDir = '/blog/posts';

  it('should extract slug from posts/{slug}/index.md', () => {
    const result = extractSlug('/blog/posts/my-post/index.md', postsDir);
    expect(result).toBe('my-post');
  });

  it('should extract slug from nested paths', () => {
    const result = extractSlug('/blog/posts/hello-world/index.md', postsDir);
    expect(result).toBe('hello-world');
  });

  it('should return undefined for paths outside posts', () => {
    const result = extractSlug('/blog/other/file.md', postsDir);
    expect(result).toBeUndefined();
  });

  it('should return undefined for non-index.md files', () => {
    const result = extractSlug('/blog/posts/my-post/draft.md', postsDir);
    expect(result).toBeUndefined();
  });

  it('should handle root-level .md files', () => {
    const result = extractSlug('/blog/posts/single-file.md', postsDir);
    expect(result).toBe('single-file');
  });
});
