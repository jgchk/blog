import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';

/**
 * E2E Test: Content Reload (T066)
 *
 * Verifies: start server → edit markdown file → browser receives reload within 3s
 * Per spec SC-001: Content changes visible in browser within 3 seconds
 */

let testDir: string;
let serverProcess: ChildProcess | null = null;

test.describe('Content Reload E2E', () => {
  test.beforeAll(async () => {
    // Create test directory structure
    testDir = mkdtempSync(join(tmpdir(), 'dev-server-e2e-content-'));
    mkdirSync(join(testDir, 'posts', 'test-article'), { recursive: true });
    mkdirSync(join(testDir, 'packages', 'site', 'src', 'templates'), {
      recursive: true,
    });
    mkdirSync(join(testDir, 'packages', 'site', 'src', 'styles'), {
      recursive: true,
    });

    // Create minimal templates
    writeFileSync(
      join(testDir, 'packages', 'site', 'src', 'templates', 'index.html'),
      `<!DOCTYPE html>
<html>
<head>
  <title>Blog</title>
  <link rel="stylesheet" href="/styles/main.css">
</head>
<body>
  <h1>Blog Index</h1>
  <div id="articles">
    {{#each articles}}
    <article data-slug="{{slug}}">
      <h2>{{title}}</h2>
      <p>{{excerpt}}</p>
    </article>
    {{/each}}
  </div>
</body>
</html>`
    );
    writeFileSync(
      join(testDir, 'packages', 'site', 'src', 'templates', 'article.html'),
      `<!DOCTYPE html>
<html>
<head>
  <title>{{title}}</title>
  <link rel="stylesheet" href="/styles/main.css">
</head>
<body>
  <article>
    <h1 id="article-title">{{title}}</h1>
    <div id="content">{{{content}}}</div>
  </article>
</body>
</html>`
    );
    writeFileSync(
      join(testDir, 'packages', 'site', 'src', 'templates', 'archive.html'),
      '<!DOCTYPE html><html><head><title>Archive</title></head><body>Archive</body></html>'
    );
    writeFileSync(
      join(testDir, 'packages', 'site', 'src', 'templates', 'tag.html'),
      '<!DOCTYPE html><html><head><title>Tag: {{tagName}}</title></head><body>Tag</body></html>'
    );

    // Create initial article
    writeFileSync(
      join(testDir, 'posts', 'test-article', 'index.md'),
      `---
title: Original Title
date: 2025-01-15
tags:
  - test
---

# Original Content

This is the original content.`
    );

    // Create styles
    writeFileSync(
      join(testDir, 'packages', 'site', 'src', 'styles', 'main.css'),
      'body { color: black; }'
    );

    // Start the dev server
    serverProcess = spawn('npx', ['tsx', 'src/cli.ts', '--port', '3456', '--no-open'], {
      cwd: join(process.cwd()),
      env: {
        ...process.env,
        // Override rootDir for the test
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Wait for server to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server start timeout')), 15000);

      serverProcess?.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        if (output.includes('Server ready') || output.includes('localhost:3456')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      serverProcess?.stderr?.on('data', (data: Buffer) => {
        console.error('Server stderr:', data.toString());
      });

      serverProcess?.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  });

  test.afterAll(async () => {
    // Kill server process
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        serverProcess?.on('exit', () => resolve());
        setTimeout(resolve, 2000);
      });
    }

    // Cleanup test directory
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should reload browser within 3 seconds when markdown file changes', async ({ page }) => {
    // Skip if server didn't start properly
    test.skip(!serverProcess, 'Server process not available');

    // Navigate to article page
    await page.goto('/articles/test-article');

    // Verify initial content
    await expect(page.locator('#article-title')).toContainText('Original Title');

    // Set up reload detection
    let reloadDetected = false;
    const reloadPromise = new Promise<number>((resolve) => {
      const startTime = Date.now();
      page.on('load', () => {
        reloadDetected = true;
        resolve(Date.now() - startTime);
      });
    });

    // Modify the markdown file
    writeFileSync(
      join(testDir, 'posts', 'test-article', 'index.md'),
      `---
title: Updated Title
date: 2025-01-15
tags:
  - test
---

# Updated Content

This content has been updated!`
    );

    // Wait for reload (max 3 seconds per SC-001)
    const reloadTime = await Promise.race([
      reloadPromise,
      new Promise<number>((_, reject) =>
        setTimeout(() => reject(new Error('Reload did not happen within 3 seconds')), 3500)
      ),
    ]);

    expect(reloadDetected).toBe(true);
    expect(reloadTime).toBeLessThan(3000);

    // Verify updated content
    await expect(page.locator('#article-title')).toContainText('Updated Title');
    await expect(page.locator('#content')).toContainText('This content has been updated!');
  });

  test('should update index page when new article is added', async ({ page }) => {
    test.skip(!serverProcess, 'Server process not available');

    // Navigate to index
    await page.goto('/');

    // Set up reload detection
    let reloadDetected = false;
    page.on('load', () => {
      reloadDetected = true;
    });

    // Add new article
    mkdirSync(join(testDir, 'posts', 'new-article'), { recursive: true });
    writeFileSync(
      join(testDir, 'posts', 'new-article', 'index.md'),
      `---
title: New Article
date: 2025-01-16
tags:
  - new
---

# New Article

This is a new article!`
    );

    // Wait for reload
    await page.waitForEvent('load', { timeout: 3500 });

    expect(reloadDetected).toBe(true);

    // Verify new article appears in index
    await expect(page.locator('[data-slug="new-article"]')).toBeVisible();
  });

  test('should update index page when article is deleted', async ({ page }) => {
    test.skip(!serverProcess, 'Server process not available');

    // Navigate to index
    await page.goto('/');

    // Verify article exists
    await expect(page.locator('[data-slug="new-article"]')).toBeVisible();

    // Set up reload detection
    page.on('load', () => {});

    // Delete article
    rmSync(join(testDir, 'posts', 'new-article'), { recursive: true, force: true });

    // Wait for reload
    await page.waitForEvent('load', { timeout: 3500 });

    // Verify article is removed
    await expect(page.locator('[data-slug="new-article"]')).not.toBeVisible();
  });
});
