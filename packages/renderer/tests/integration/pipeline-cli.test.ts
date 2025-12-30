import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn } from 'node:child_process';

describe('Pipeline CLI', () => {
  let tempDir: string;
  let postsDir: string;
  let outputDir: string;
  let templatesDir: string;
  let siteDir: string;

  beforeEach(async () => {
    // Create temp directory structure
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pipeline-cli-test-'));
    postsDir = path.join(tempDir, 'posts');
    outputDir = path.join(tempDir, 'rendered');
    templatesDir = path.join(tempDir, 'templates');
    siteDir = path.join(tempDir, 'site');

    await fs.mkdir(postsDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.mkdir(path.join(siteDir, 'src', 'fonts'), { recursive: true });
    await fs.mkdir(path.join(siteDir, 'src', 'styles'), { recursive: true });

    // Create minimal templates
    const articleTemplate = `<!DOCTYPE html>
<html lang="en">
<head><title>{{title}}</title></head>
<body>
  <h1>{{title}}</h1>
  <div>{{{content}}}</div>
</body>
</html>`;

    const indexTemplate = `<!DOCTYPE html>
<html lang="en">
<head><title>Blog</title></head>
<body>
  <h1>Recent Articles</h1>
  {{#each articles}}
  <article><h2>{{title}}</h2></article>
  {{/each}}
</body>
</html>`;

    const tagTemplate = `<!DOCTYPE html>
<html lang="en">
<head><title>Tag: {{tagName}}</title></head>
<body><h1>Tag: {{tagName}}</h1></body>
</html>`;

    const tagsTemplate = `<!DOCTYPE html>
<html lang="en">
<head><title>All Tags</title></head>
<body><h1>All Tags</h1></body>
</html>`;

    const archiveTemplate = `<!DOCTYPE html>
<html lang="en">
<head><title>Archive</title></head>
<body><h1>Archive</h1></body>
</html>`;

    await fs.writeFile(path.join(templatesDir, 'article.html'), articleTemplate);
    await fs.writeFile(path.join(templatesDir, 'index.html'), indexTemplate);
    await fs.writeFile(path.join(templatesDir, 'tag.html'), tagTemplate);
    await fs.writeFile(path.join(templatesDir, 'tags.html'), tagsTemplate);
    await fs.writeFile(path.join(templatesDir, 'archive.html'), archiveTemplate);

    // Create a test post
    await fs.mkdir(path.join(postsDir, 'test-post'));
    await fs.writeFile(
      path.join(postsDir, 'test-post', 'index.md'),
      `---
title: Test Post
date: 2024-01-15
---
Content`
    );

    // Create site assets
    await fs.writeFile(
      path.join(siteDir, 'src', 'fonts', 'test.woff2'),
      Buffer.from([0x77, 0x4f, 0x46, 0x32])
    );
    await fs.writeFile(
      path.join(siteDir, 'src', 'styles', 'main.css'),
      'body { color: black; }'
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function runPipelineCli(env: Record<string, string>): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      // Use tsx to run TypeScript source directly (avoids build dependency)
      const cliPath = path.resolve(__dirname, '../../src/pipeline.ts');
      const child = spawn('npx', ['tsx', cliPath], {
        env: { ...process.env, ...env },
        cwd: tempDir,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });

      child.on('close', (code) => {
        resolve({ code: code ?? 1, stdout, stderr });
      });
    });
  }

  it('should copy site assets when SITE_DIR environment variable is set', async () => {
    const result = await runPipelineCli({
      POSTS_DIR: postsDir,
      OUTPUT_DIR: outputDir,
      TEMPLATES_DIR: templatesDir,
      SITE_DIR: siteDir,
    });

    expect(result.code).toBe(0);

    // Verify font was copied
    const fontExists = await fs.access(path.join(outputDir, 'fonts', 'test.woff2'))
      .then(() => true)
      .catch(() => false);
    expect(fontExists).toBe(true);

    // Verify CSS was copied
    const cssExists = await fs.access(path.join(outputDir, 'assets', 'styles', 'main.css'))
      .then(() => true)
      .catch(() => false);
    expect(cssExists).toBe(true);
  });

  it('should log site directory when SITE_DIR is set', async () => {
    const result = await runPipelineCli({
      POSTS_DIR: postsDir,
      OUTPUT_DIR: outputDir,
      TEMPLATES_DIR: templatesDir,
      SITE_DIR: siteDir,
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain(`Site directory: ${siteDir}`);
  });
});
