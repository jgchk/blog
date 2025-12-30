import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { PipelineRenderer } from '../../src/services/pipeline-renderer.js';

describe('PipelineRenderer', () => {
  let tempDir: string;
  let postsDir: string;
  let outputDir: string;
  let templatesDir: string;

  beforeEach(async () => {
    // Create temp directory structure
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pipeline-test-'));
    postsDir = path.join(tempDir, 'posts');
    outputDir = path.join(tempDir, 'rendered');
    templatesDir = path.join(tempDir, 'templates');

    await fs.mkdir(postsDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(templatesDir, { recursive: true });

    // Create minimal templates
    const articleTemplate = `<!DOCTYPE html>
<html lang="en">
<head><title>{{title}}</title></head>
<body>
  <h1>{{title}}</h1>
  <time datetime="{{dateIso}}">{{dateFormatted}}</time>
  <div>{{{content}}}</div>
</body>
</html>`;

    const indexTemplate = `<!DOCTYPE html>
<html lang="en">
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
</body>
</html>`;

    const tagTemplate = `<!DOCTYPE html>
<html lang="en">
<head><title>Tag: {{tagName}}</title></head>
<body>
  <h1>Tag: {{tagName}}</h1>
  <p>{{articleCount}} articles</p>
  {{#each articles}}
  <article>
    <h2><a href="/articles/{{slug}}/">{{title}}</a></h2>
  </article>
  {{/each}}
</body>
</html>`;

    const tagsTemplate = `<!DOCTYPE html>
<html lang="en">
<head><title>All Tags</title></head>
<body>
  <h1>All Tags</h1>
  <p>{{totalTags}} tags</p>
  {{#each tags}}
  <a href="/tags/{{slug}}.html">{{name}} ({{count}})</a>
  {{/each}}
</body>
</html>`;

    await fs.writeFile(path.join(templatesDir, 'article.html'), articleTemplate);
    await fs.writeFile(path.join(templatesDir, 'index.html'), indexTemplate);
    await fs.writeFile(path.join(templatesDir, 'tag.html'), tagTemplate);
    await fs.writeFile(path.join(templatesDir, 'tags.html'), tagsTemplate);
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('discoverPosts', () => {
    it('should discover posts with index.md files', async () => {
      // Create test posts
      await fs.mkdir(path.join(postsDir, 'post-1'));
      await fs.writeFile(
        path.join(postsDir, 'post-1', 'index.md'),
        `---
title: Post 1
date: 2024-01-01
---
Content`
      );

      await fs.mkdir(path.join(postsDir, 'post-2'));
      await fs.writeFile(
        path.join(postsDir, 'post-2', 'index.md'),
        `---
title: Post 2
date: 2024-01-02
---
Content`
      );

      const renderer = new PipelineRenderer({
        postsDir,
        outputDir,
        templatesDir,
        logger: () => {}, // Suppress logging in tests
      });

      const slugs = await renderer.discoverPosts();

      expect(slugs).toHaveLength(2);
      expect(slugs).toContain('post-1');
      expect(slugs).toContain('post-2');
    });

    it('should skip directories without index.md', async () => {
      // Create a valid post
      await fs.mkdir(path.join(postsDir, 'valid-post'));
      await fs.writeFile(
        path.join(postsDir, 'valid-post', 'index.md'),
        `---
title: Valid Post
date: 2024-01-01
---
Content`
      );

      // Create a directory without index.md
      await fs.mkdir(path.join(postsDir, 'invalid-post'));
      await fs.writeFile(
        path.join(postsDir, 'invalid-post', 'other.txt'),
        'Not a post'
      );

      const renderer = new PipelineRenderer({
        postsDir,
        outputDir,
        templatesDir,
        logger: () => {},
      });

      const slugs = await renderer.discoverPosts();

      expect(slugs).toHaveLength(1);
      expect(slugs).toContain('valid-post');
      expect(slugs).not.toContain('invalid-post');
    });

    it('should return empty array for empty posts directory', async () => {
      const renderer = new PipelineRenderer({
        postsDir,
        outputDir,
        templatesDir,
        logger: () => {},
      });

      const slugs = await renderer.discoverPosts();

      expect(slugs).toHaveLength(0);
    });
  });

  describe('readPost', () => {
    it('should parse a valid post', async () => {
      await fs.mkdir(path.join(postsDir, 'test-post'));
      await fs.writeFile(
        path.join(postsDir, 'test-post', 'index.md'),
        `---
title: Test Post
date: 2024-01-15
tags:
  - TypeScript
  - Testing
---
This is the content of the test post.`
      );

      const renderer = new PipelineRenderer({
        postsDir,
        outputDir,
        templatesDir,
        logger: () => {},
      });

      const article = await renderer.readPost('test-post');

      expect(article).not.toBeNull();
      expect(article!.slug).toBe('test-post');
      expect(article!.title).toBe('Test Post');
      expect(article!.tags).toEqual(['TypeScript', 'Testing']);
      expect(article!.html).toContain('This is the content');
    });

    it('should skip drafts', async () => {
      await fs.mkdir(path.join(postsDir, 'draft-post'));
      await fs.writeFile(
        path.join(postsDir, 'draft-post', 'index.md'),
        `---
title: Draft Post
date: 2024-01-15
draft: true
---
Draft content`
      );

      const renderer = new PipelineRenderer({
        postsDir,
        outputDir,
        templatesDir,
        logger: () => {},
      });

      const article = await renderer.readPost('draft-post');

      expect(article).toBeNull();
    });

    it('should return null for invalid front matter', async () => {
      await fs.mkdir(path.join(postsDir, 'invalid-post'));
      await fs.writeFile(
        path.join(postsDir, 'invalid-post', 'index.md'),
        `---
title: Missing Date
---
Content`
      );

      const renderer = new PipelineRenderer({
        postsDir,
        outputDir,
        templatesDir,
        logger: () => {},
      });

      const article = await renderer.readPost('invalid-post');

      expect(article).toBeNull();
    });
  });

  describe('readAllPosts', () => {
    it('should read and sort posts by date descending', async () => {
      // Create posts with different dates
      await fs.mkdir(path.join(postsDir, 'old-post'));
      await fs.writeFile(
        path.join(postsDir, 'old-post', 'index.md'),
        `---
title: Old Post
date: 2024-01-01
---
Content`
      );

      await fs.mkdir(path.join(postsDir, 'new-post'));
      await fs.writeFile(
        path.join(postsDir, 'new-post', 'index.md'),
        `---
title: New Post
date: 2024-12-01
---
Content`
      );

      await fs.mkdir(path.join(postsDir, 'middle-post'));
      await fs.writeFile(
        path.join(postsDir, 'middle-post', 'index.md'),
        `---
title: Middle Post
date: 2024-06-15
---
Content`
      );

      const renderer = new PipelineRenderer({
        postsDir,
        outputDir,
        templatesDir,
        logger: () => {},
      });

      const articles = await renderer.readAllPosts();

      expect(articles).toHaveLength(3);
      expect(articles[0].slug).toBe('new-post');
      expect(articles[1].slug).toBe('middle-post');
      expect(articles[2].slug).toBe('old-post');
    });
  });

  describe('execute', () => {
    it('should render posts and generate output files', async () => {
      await fs.mkdir(path.join(postsDir, 'test-post'));
      await fs.writeFile(
        path.join(postsDir, 'test-post', 'index.md'),
        `---
title: Test Post
date: 2024-01-15
tags:
  - JavaScript
---
Hello world!`
      );

      const renderer = new PipelineRenderer({
        postsDir,
        outputDir,
        templatesDir,
        logger: () => {},
      });

      const result = await renderer.execute();

      expect(result.success).toBe(true);
      expect(result.postsRendered).toBe(1);
      expect(result.tagPagesGenerated).toBe(1);

      // Verify output files
      const htmlPath = path.join(outputDir, 'posts', 'test-post', 'index.html');
      const htmlContent = await fs.readFile(htmlPath, 'utf-8');
      expect(htmlContent).toContain('Test Post');
      expect(htmlContent).toContain('Hello world!');

      // Verify tag page
      const tagPath = path.join(outputDir, 'tags', 'javascript.html');
      const tagContent = await fs.readFile(tagPath, 'utf-8');
      expect(tagContent).toContain('Tag: JavaScript');

      // Verify all tags page
      const tagsPath = path.join(outputDir, 'tags', 'index.html');
      const tagsContent = await fs.readFile(tagsPath, 'utf-8');
      expect(tagsContent).toContain('All Tags');

      // Verify home page
      const homePath = path.join(outputDir, 'index.html');
      const homeContent = await fs.readFile(homePath, 'utf-8');
      expect(homeContent).toContain('Test Post');
    });

    it('should copy co-located assets', async () => {
      await fs.mkdir(path.join(postsDir, 'post-with-image'));
      await fs.writeFile(
        path.join(postsDir, 'post-with-image', 'index.md'),
        `---
title: Post With Image
date: 2024-01-15
---
![Image](./image.png)`
      );
      await fs.writeFile(
        path.join(postsDir, 'post-with-image', 'image.png'),
        'fake image data'
      );

      const renderer = new PipelineRenderer({
        postsDir,
        outputDir,
        templatesDir,
        logger: () => {},
      });

      const result = await renderer.execute();

      expect(result.success).toBe(true);
      expect(result.assetsUploaded).toBe(1);

      // Verify asset was copied
      const assetPath = path.join(outputDir, 'posts', 'post-with-image', 'image.png');
      const assetExists = await fs.access(assetPath).then(() => true).catch(() => false);
      expect(assetExists).toBe(true);
    });

    it('should return success with zero posts for empty directory', async () => {
      const renderer = new PipelineRenderer({
        postsDir,
        outputDir,
        templatesDir,
        logger: () => {},
      });

      const result = await renderer.execute();

      expect(result.success).toBe(true);
      expect(result.postsRendered).toBe(0);
    });
  });

  describe('generateTagIndex', () => {
    it('should build tag index from articles', async () => {
      await fs.mkdir(path.join(postsDir, 'post-1'));
      await fs.writeFile(
        path.join(postsDir, 'post-1', 'index.md'),
        `---
title: Post 1
date: 2024-01-01
tags:
  - JavaScript
  - Testing
---
Content`
      );

      await fs.mkdir(path.join(postsDir, 'post-2'));
      await fs.writeFile(
        path.join(postsDir, 'post-2', 'index.md'),
        `---
title: Post 2
date: 2024-01-02
tags:
  - JavaScript
  - TypeScript
---
Content`
      );

      const renderer = new PipelineRenderer({
        postsDir,
        outputDir,
        templatesDir,
        logger: () => {},
      });

      const articles = await renderer.readAllPosts();
      const tagIndex = renderer.generateTagIndex(articles);

      const tags = tagIndex.getAllTags();
      expect(tags).toHaveLength(3);

      // JavaScript should have 2 articles
      const jsTag = tags.find(t => t.slug === 'javascript');
      expect(jsTag).toBeDefined();
      expect(jsTag!.count).toBe(2);
    });
  });
});
