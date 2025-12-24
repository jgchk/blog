import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { startServer } from '../../src/server.js';
import { DevServerState } from '../../src/state.js';
import { createDefaultConfig } from '../../src/config.js';
import { broadcast } from '../../src/watcher.js';
import type { DevServerConfig, ServerMessage } from '../../src/types.js';

describe('Live Reload Integration', () => {
  let testDir: string;
  let config: DevServerConfig;
  let state: DevServerState;
  let server: FastifyInstance;
  let serverAddress: string;

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

    // Get the actual port
    const address = server.addresses()[0];
    if (address && typeof address === 'object') {
      serverAddress = `ws://localhost:${address.port}`;
    }
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should send connected message on WebSocket connection', async () => {
    const ws = new WebSocket(`${serverAddress}/__dev/ws`);

    const message = await new Promise<ServerMessage>((resolve, reject) => {
      ws.on('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    expect(message.type).toBe('connected');
    ws.close();
  });

  it('should broadcast reload message to connected clients', async () => {
    const ws = new WebSocket(`${serverAddress}/__dev/ws`);
    const messages: ServerMessage[] = [];

    ws.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
    });

    // Wait for connection
    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    // Wait for connected message
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });

    // Broadcast reload
    broadcast(state, { type: 'reload' });

    // Wait for message
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });

    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages.some(m => m.type === 'reload')).toBe(true);

    ws.close();
  });

  it('should broadcast css message for style updates', async () => {
    const ws = new WebSocket(`${serverAddress}/__dev/ws`);
    const messages: ServerMessage[] = [];

    ws.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
    });

    // Wait for connection
    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    // Wait for connected message
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });

    // Broadcast CSS update
    broadcast(state, { type: 'css', path: 'main.css' });

    // Wait for message
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });

    expect(messages.length).toBeGreaterThanOrEqual(2);
    const cssMessage = messages.find(m => m.type === 'css');
    expect(cssMessage).toBeDefined();
    if (cssMessage?.type === 'css') {
      expect(cssMessage.path).toBe('main.css');
    }

    ws.close();
  });

  it('should track client count correctly', async () => {
    expect(state.clientCount).toBe(0);

    const ws = new WebSocket(`${serverAddress}/__dev/ws`);

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        // Give time for the server to register the client
        setTimeout(resolve, 100);
      });
    });

    expect(state.clientCount).toBe(1);

    ws.close();

    // Wait for close to be processed
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(state.clientCount).toBe(0);
  });
});
