import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { startServer } from '../../src/server.js';
import { DevServerState } from '../../src/state.js';
import { createDefaultConfig } from '../../src/config.js';
import { createWatcher } from '../../src/watcher.js';
import type { DevServerConfig } from '../../src/types.js';

describe('Graceful Shutdown', () => {
  let testDir: string;
  let config: DevServerConfig;
  let state: DevServerState;
  let server: FastifyInstance;
  let serverAddress: string;
  let serverPort: number;

  beforeEach(async () => {
    // Create test directory structure
    testDir = mkdtempSync(join(tmpdir(), 'dev-server-shutdown-test-'));
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

    // Create file watcher
    state.watcher = createWatcher(config, state);

    // Get the actual port
    const address = server.addresses()[0];
    if (address && typeof address === 'object') {
      serverPort = address.port;
      serverAddress = `ws://localhost:${serverPort}`;
    }
  });

  afterEach(async () => {
    // Clean up watcher if not already closed
    if (state.watcher) {
      await state.watcher.close();
    }
    if (server) {
      await server.close();
    }
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should close all connections on shutdown', async () => {
    // Connect a WebSocket client
    const ws = new WebSocket(`${serverAddress}/__dev/ws`);

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        setTimeout(resolve, 100);
      });
    });

    expect(state.clientCount).toBe(1);

    // Close file watcher
    if (state.watcher) {
      await state.watcher.close();
      state.watcher = null;
    }

    // Close WebSocket connections
    for (const client of state.clients) {
      client.close(1000, 'Server shutting down');
    }

    // Wait for close to be processed
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(state.clientCount).toBe(0);

    // Close server
    await server.close();

    // Verify server no longer accepts connections
    const newWs = new WebSocket(`${serverAddress}/__dev/ws`);

    await new Promise<void>((resolve) => {
      newWs.on('error', () => {
        resolve();
      });
      setTimeout(resolve, 500);
    });

    newWs.close();
  });

  it('should close file watcher on shutdown', async () => {
    expect(state.watcher).not.toBeNull();

    // Close watcher
    if (state.watcher) {
      await state.watcher.close();
      state.watcher = null;
    }

    expect(state.watcher).toBeNull();
  });

  it('should transition state to stopped', async () => {
    state.setStatus('running');
    expect(state.status).toBe('running');

    state.setStatus('stopping');
    expect(state.status).toBe('stopping');

    // Close watcher
    if (state.watcher) {
      await state.watcher.close();
      state.watcher = null;
    }

    // Close WebSocket clients
    for (const client of state.clients) {
      client.close(1000, 'Server shutting down');
    }

    // Close server
    await server.close();

    state.setStatus('stopped');
    expect(state.status).toBe('stopped');
  });

  it('should notify clients before closing', async () => {
    const ws = new WebSocket(`${serverAddress}/__dev/ws`);
    let closeCode: number | undefined;
    let closeReason: string | undefined;

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        setTimeout(resolve, 100);
      });
    });

    const closePromise = new Promise<void>((resolve) => {
      ws.on('close', (code, reason) => {
        closeCode = code;
        closeReason = reason.toString();
        resolve();
      });
    });

    // Close WebSocket clients with message
    for (const client of state.clients) {
      client.close(1000, 'Server shutting down');
    }

    await closePromise;

    expect(closeCode).toBe(1000);
    expect(closeReason).toBe('Server shutting down');
  });
});
