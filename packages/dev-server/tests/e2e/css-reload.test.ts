import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';

/**
 * E2E Test: CSS Reload (T067)
 *
 * Verifies: start server → edit CSS file → styles update without page reload
 * Per spec FR-009: CSS changes update browser without full page reload
 * Per spec SC-003: CSS changes visible within 2 seconds
 */

let testDir: string;
let serverProcess: ChildProcess | null = null;

test.describe('CSS Reload E2E', () => {
  test.beforeAll(async () => {
    // Create test directory structure
    testDir = mkdtempSync(join(tmpdir(), 'dev-server-e2e-css-'));
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
  <h1 id="heading">Blog Index</h1>
  <p id="test-text">Test content for styling</p>
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
    <h1>{{title}}</h1>
    <div>{{{content}}}</div>
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

    // Create test article
    writeFileSync(
      join(testDir, 'posts', 'test-article', 'index.md'),
      `---
title: Test Article
date: 2025-01-15
tags:
  - test
---

# Test Article

Test content.`
    );

    // Create initial styles with black text
    writeFileSync(
      join(testDir, 'packages', 'site', 'src', 'styles', 'main.css'),
      `body {
  color: black;
  background-color: white;
}

#heading {
  color: rgb(0, 0, 0);
}

#test-text {
  color: rgb(0, 0, 0);
}`
    );

    // Start the dev server
    serverProcess = spawn('npx', ['tsx', 'src/cli.ts', '--port', '3456', '--no-open'], {
      cwd: join(process.cwd()),
      env: {
        ...process.env,
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

  test('should update styles without page reload within 2 seconds', async ({ page }) => {
    test.skip(!serverProcess, 'Server process not available');

    // Navigate to index
    await page.goto('/');

    // Verify initial styles (black text)
    const initialColor = await page.locator('#test-text').evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    expect(initialColor).toBe('rgb(0, 0, 0)');

    // Track if full page reload happens
    let fullReloadOccurred = false;
    page.on('load', () => {
      fullReloadOccurred = true;
    });

    // Record scroll position to verify no reload
    await page.evaluate(() => {
      window.scrollTo(0, 100);
    });
    const initialScrollY = await page.evaluate(() => window.scrollY);

    // Set up style change detection
    const styleChangePromise = new Promise<number>((resolve) => {
      const startTime = Date.now();
      const interval = setInterval(async () => {
        try {
          const color = await page.locator('#test-text').evaluate((el) => {
            return window.getComputedStyle(el).color;
          });
          if (color === 'rgb(255, 0, 0)') {
            clearInterval(interval);
            resolve(Date.now() - startTime);
          }
        } catch {
          // Page might be navigating
        }
      }, 100);

      // Timeout after 2.5 seconds
      setTimeout(() => {
        clearInterval(interval);
      }, 2500);
    });

    // Modify CSS file to change text color to red
    writeFileSync(
      join(testDir, 'packages', 'site', 'src', 'styles', 'main.css'),
      `body {
  color: black;
  background-color: white;
}

#heading {
  color: rgb(0, 0, 0);
}

#test-text {
  color: rgb(255, 0, 0);
}`
    );

    // Wait for style change
    const changeTime = await Promise.race([
      styleChangePromise,
      new Promise<number>((_, reject) =>
        setTimeout(() => reject(new Error('CSS change not detected within 2 seconds')), 2500)
      ),
    ]);

    // Verify timing (within 2 seconds per SC-003)
    expect(changeTime).toBeLessThan(2000);

    // Verify style changed
    const updatedColor = await page.locator('#test-text').evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    expect(updatedColor).toBe('rgb(255, 0, 0)');

    // Verify NO full page reload occurred (preserves scroll position)
    expect(fullReloadOccurred).toBe(false);

    const finalScrollY = await page.evaluate(() => window.scrollY);
    expect(finalScrollY).toBe(initialScrollY);
  });

  test('should handle multiple rapid CSS changes', async ({ page }) => {
    test.skip(!serverProcess, 'Server process not available');

    // Navigate to index
    await page.goto('/');

    // Make multiple rapid changes
    const colors = ['rgb(0, 128, 0)', 'rgb(0, 0, 255)', 'rgb(255, 165, 0)'];

    for (const color of colors) {
      writeFileSync(
        join(testDir, 'packages', 'site', 'src', 'styles', 'main.css'),
        `body { color: black; }
#test-text { color: ${color}; }`
      );
      await page.waitForTimeout(200); // Allow debounce
    }

    // Wait for final style to apply
    await page.waitForTimeout(500);

    // Verify final color (orange)
    const finalColor = await page.locator('#test-text').evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    expect(finalColor).toBe('rgb(255, 165, 0)');
  });
});
