import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createServer, startServer } from '../../src/server.js';
import { DevServerState } from '../../src/state.js';
import { createDefaultConfig } from '../../src/config.js';
import type { DevServerConfig } from '../../src/types.js';

describe('Server Integration', () => {
  let testDir: string;
  let config: DevServerConfig;
  let state: DevServerState;
  let server: FastifyInstance;

  beforeEach(async () => {
    // Create test directory structure
    testDir = mkdtempSync(join(tmpdir(), 'dev-server-test-'));
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
      '<!DOCTYPE html><html><head><title>Index</title></head><body>{{#each articles}}<article>{{title}}</article>{{/each}}</body></html>'
    );
    writeFileSync(
      join(testDir, 'packages', 'site', 'src', 'templates', 'article.html'),
      '<!DOCTYPE html><html><head><title>{{title}}</title></head><body><article>{{content}}</article></body></html>'
    );
    writeFileSync(
      join(testDir, 'packages', 'site', 'src', 'templates', 'archive.html'),
      '<!DOCTYPE html><html><head><title>Archive</title></head><body>Archive</body></html>'
    );
    writeFileSync(
      join(testDir, 'packages', 'site', 'src', 'templates', 'tag.html'),
      '<!DOCTYPE html><html><head><title>Tag: {{tagName}}</title></head><body>Tag</body></html>'
    );

    // Create a test article
    writeFileSync(
      join(testDir, 'posts', 'test-article', 'index.md'),
      `---
title: Test Article
date: 2025-01-15
tags:
  - test
---

# Test Article

This is a test.`
    );

    // Create styles
    writeFileSync(
      join(testDir, 'packages', 'site', 'src', 'styles', 'main.css'),
      'body { color: black; }'
    );

    config = createDefaultConfig({
      port: 0, // Random port
      rootDir: testDir,
      open: false,
    });

    state = new DevServerState();
    server = await startServer(config, state);
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should start and respond to GET /', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('<!DOCTYPE html>');
  });

  it('should inject client.js script into HTML responses', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.body).toContain('/__dev/client.js');
  });

  it('should serve client.js at /__dev/client.js', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/__dev/client.js',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/javascript');
    expect(response.body).toContain('WebSocket');
  });

  it('should return 404 for nonexistent article', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/articles/nonexistent',
    });

    expect(response.statusCode).toBe(404);
    expect(response.body).toContain('404');
  });

  it('should serve existing article', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/articles/test-article',
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('Test Article');
  });

  it('should add Cache-Control header to responses', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.headers['cache-control']).toContain('no-cache');
  });

  it('should add X-Dev-Server header to responses', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.headers['x-dev-server']).toBe('blog-dev/1.0');
  });

  it('should serve archive page', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/archive',
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('Archive');
  });

  it('should show error with port number and suggestion when port is in use', async () => {
    // Get the port the first server is using
    const address = server.addresses()[0];
    const usedPort = typeof address === 'object' ? address.port : 3000;

    // Try to start another server on the same port
    const conflictConfig = createDefaultConfig({
      port: usedPort,
      rootDir: testDir,
      open: false,
    });
    const conflictState = new DevServerState();

    let errorThrown = false;
    let errorMessage = '';

    try {
      await startServer(conflictConfig, conflictState);
    } catch (err) {
      errorThrown = true;
      if (err instanceof Error) {
        errorMessage = err.message;
      }
    }

    expect(errorThrown).toBe(true);
    expect(errorMessage).toContain('EADDRINUSE');
  });
});
