import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { MarkdownParser, FrontMatterParser, ArticleIndex } from '@blog/core';
import { renderArticle } from '../../src/renderer.js';
import { createDefaultConfig } from '../../src/config.js';
import type { DevServerConfig } from '../../src/types.js';

describe('Rendering Parity', () => {
  let testDir: string;
  let config: DevServerConfig;

  beforeEach(() => {
    // Create test directory structure
    testDir = mkdtempSync(join(tmpdir(), 'dev-server-test-'));
    mkdirSync(join(testDir, 'posts', 'test-article'), { recursive: true });
    mkdirSync(join(testDir, 'packages', 'site', 'src', 'templates'), {
      recursive: true,
    });
    mkdirSync(join(testDir, 'packages', 'site', 'src', 'styles'), {
      recursive: true,
    });

    // Create article template (use triple braces for unescaped HTML content)
    writeFileSync(
      join(testDir, 'packages', 'site', 'src', 'templates', 'article.html'),
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{{title}}</title>
</head>
<body>
  <article>
    <header>
      <h1>{{title}}</h1>
      <time datetime="{{dateIso}}">{{dateFormatted}}</time>
    </header>
    <div class="content">
      {{{content}}}
    </div>
  </article>
</body>
</html>`
    );

    // Create test article
    writeFileSync(
      join(testDir, 'posts', 'test-article', 'index.md'),
      `---
title: Test Article Title
date: 2025-01-15
tags:
  - testing
  - demo
---

# Main Heading

This is a paragraph with **bold** and *italic* text.

## Subheading

- List item 1
- List item 2
- List item 3

\`\`\`javascript
const hello = "world";
\`\`\`
`
    );

    config = createDefaultConfig({
      rootDir: testDir,
      open: false,
    });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should render article using same markdown parser as @blog/core', async () => {
    // Read the markdown file
    const markdownPath = join(testDir, 'posts', 'test-article', 'index.md');
    const markdownContent = `---
title: Test Article Title
date: 2025-01-15
---

# Main Heading

This is **bold** text.`;

    writeFileSync(markdownPath, markdownContent);

    // Parse with FrontMatterParser
    const fmParser = new FrontMatterParser();
    const fmResult = fmParser.parse(markdownContent);
    expect(fmResult.success).toBe(true);

    if (!fmResult.success) return;

    // Parse with MarkdownParser from @blog/core
    const mdParser = new MarkdownParser();
    const coreHtml = await mdParser.parse(fmResult.content);

    // Render with dev-server
    const result = await renderArticle(config, markdownPath);
    expect('article' in result).toBe(true);

    if (!('article' in result)) return;

    // Both should contain the same semantic content
    expect(result.article.html).toContain('<h1');
    expect(result.article.html).toContain('Main Heading');
    expect(result.article.html).toContain('<strong>bold</strong>');

    // Parse both as DOM and compare structure
    const devDom = new JSDOM(result.article.html);
    const coreDom = new JSDOM(`<div>${coreHtml}</div>`);

    // The dev server wraps in template, core is just content
    // Compare the content section
    const devContent = devDom.window.document.querySelector('.content');
    expect(devContent).not.toBeNull();
    expect(devContent?.innerHTML).toContain('<h1');
    expect(devContent?.innerHTML).toContain('<strong>bold</strong>');

    // Core html should have same structure
    expect(coreHtml).toContain('<h1');
    expect(coreHtml).toContain('<strong>bold</strong>');
  });

  it('should render GFM features correctly', async () => {
    const markdown = `---
title: GFM Test
date: 2025-01-15
---

This has ~~strikethrough~~ text.

| Column A | Column B |
|----------|----------|
| Cell 1   | Cell 2   |

- [x] Checked item
- [ ] Unchecked item
`;

    writeFileSync(join(testDir, 'posts', 'test-article', 'index.md'), markdown);

    const result = await renderArticle(
      config,
      join(testDir, 'posts', 'test-article', 'index.md')
    );

    expect('article' in result).toBe(true);
    if (!('article' in result)) return;

    // Check for GFM features
    expect(result.article.html).toContain('<del>strikethrough</del>');
    expect(result.article.html).toContain('<table>');
    expect(result.article.html).toContain('checked');
  });

  it('should rewrite local asset paths correctly', async () => {
    const markdown = `---
title: Asset Test
date: 2025-01-15
---

![Hero Image](hero.png)
`;

    writeFileSync(join(testDir, 'posts', 'test-article', 'index.md'), markdown);
    writeFileSync(join(testDir, 'posts', 'test-article', 'hero.png'), 'PNG');

    const result = await renderArticle(
      config,
      join(testDir, 'posts', 'test-article', 'index.md')
    );

    expect('article' in result).toBe(true);
    if (!('article' in result)) return;

    // The image src should reference the asset
    expect(result.article.html).toContain('hero.png');
    expect(result.article.assets).toContain('hero.png');
  });

  it('should handle code syntax highlighting', async () => {
    const markdown = `---
title: Code Test
date: 2025-01-15
---

\`\`\`javascript
function hello() {
  return "world";
}
\`\`\`
`;

    writeFileSync(join(testDir, 'posts', 'test-article', 'index.md'), markdown);

    const result = await renderArticle(
      config,
      join(testDir, 'posts', 'test-article', 'index.md')
    );

    expect('article' in result).toBe(true);
    if (!('article' in result)) return;

    // Should have syntax highlighting classes
    expect(result.article.html).toContain('<code');
    expect(result.article.html).toContain('function');
    // rehype-highlight adds hljs classes
    expect(result.article.html).toMatch(/class="[^"]*hljs[^"]*"/);
  });
});
