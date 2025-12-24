#!/usr/bin/env node

import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createDefaultConfig, validateConfig, ensureDirectories, resolveConfigPaths } from './config.js';
import { DevServerState } from './state.js';
import { startServer } from './server.js';
import { createWatcher } from './watcher.js';
import type { DevServerConfig } from './types.js';

/**
 * Find the repository root by looking for package.json with workspaces.
 */
function findRepoRoot(startDir: string = process.cwd()): string {
  let dir = startDir;

  while (dir !== '/') {
    const packageJsonPath = resolve(dir, 'package.json');
    const postsPath = resolve(dir, 'posts');

    // Check if this looks like the repo root (has both package.json and posts dir or packages)
    if (existsSync(packageJsonPath)) {
      const packagesPath = resolve(dir, 'packages');
      if (existsSync(packagesPath) || existsSync(postsPath)) {
        return dir;
      }
    }

    dir = dirname(dir);
  }

  // Fallback to cwd if nothing found
  return process.cwd();
}

/**
 * Parse CLI arguments.
 * Per cli-interface.md specification.
 */
function parseArgs(args: string[]): {
  port?: number;
  noOpen?: boolean;
  help?: boolean;
  error?: string;
} {
  const result: {
    port?: number;
    noOpen?: boolean;
    help?: boolean;
    error?: string;
  } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--no-open') {
      result.noOpen = true;
    } else if (arg === '--port' || arg === '-p') {
      const nextArg = args[i + 1];
      if (!nextArg || nextArg.startsWith('-')) {
        result.error = 'Missing value for --port';
        break;
      }
      const port = parseInt(nextArg, 10);
      if (isNaN(port)) {
        result.error = `Invalid port: ${nextArg}. Port must be a number between 1024 and 65535.`;
        break;
      }
      result.port = port;
      i++; // Skip next arg
    } else if (arg?.startsWith('-')) {
      result.error = `Unknown option: ${arg}`;
      break;
    }
  }

  return result;
}

/**
 * Show help message.
 */
function showHelp(): void {
  console.log(`
Blog Development Server

Usage: pnpm dev [options]

Options:
  -p, --port <port>  HTTP server port (default: 3000)
  --no-open          Don't open browser on start
  -h, --help         Show this help message

Examples:
  pnpm dev                Start with defaults
  pnpm dev -p 8080        Start on port 8080
  pnpm dev --no-open      Start without opening browser
`);
}

/**
 * Get local network IP address.
 */
function getNetworkAddress(): string | null {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return null;
}

/**
 * Open URL in default browser.
 */
function openBrowser(url: string): void {
  const platform = process.platform;
  let command: string;

  if (platform === 'darwin') {
    command = 'open';
  } else if (platform === 'win32') {
    command = 'start';
  } else {
    command = 'xdg-open';
  }

  spawn(command, [url], { detached: true, stdio: 'ignore' }).unref();
}

/**
 * Format startup time.
 */
function formatStartupTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Main CLI entry point.
 */
async function main(): Promise<void> {
  const startTime = Date.now();

  // Parse arguments
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  if (args.error) {
    console.error(`✗ ${args.error}`);
    console.error('\nRun "pnpm dev --help" for usage information.');
    process.exit(1);
  }

  // Find repo root and create config
  const rootDir = findRepoRoot();
  const config: DevServerConfig = createDefaultConfig({
    port: args.port ?? parseInt(process.env['PORT'] ?? '3000', 10),
    open: !args.noOpen,
    rootDir,
  });

  // Validate config
  const validation = validateConfig(config);

  for (const warning of validation.warnings) {
    console.warn(`⚠ ${warning}`);
  }

  if (!validation.valid) {
    for (const error of validation.errors) {
      console.error(`✗ ${error}`);
    }
    process.exit(1);
  }

  // Ensure directories exist
  const dirResult = ensureDirectories(config);
  for (const created of dirResult.created) {
    console.log(`  Created: ${created}`);
  }
  if (!dirResult.success) {
    for (const error of dirResult.errors) {
      console.error(`✗ ${error}`);
    }
    process.exit(1);
  }

  const paths = resolveConfigPaths(config);

  console.log('\n🚀 Blog dev server starting...\n');
  console.log('  Watching:');
  console.log(`    → ${paths.postsDir}`);
  console.log(`    → ${paths.stylesDir}`);
  console.log(`    → ${paths.templatesDir}`);
  console.log('');

  // Create state
  const state = new DevServerState();
  let server: FastifyInstance | null = null;

  try {
    // Start server
    server = await startServer(config, state);

    // Create file watcher
    state.watcher = createWatcher(config, state);

    const startupTime = Date.now() - startTime;
    const networkAddress = getNetworkAddress();

    console.log('');
    console.log(`✓ Server ready in ${formatStartupTime(startupTime)}`);
    console.log('');
    console.log(`  Local:   http://localhost:${config.port}`);
    if (networkAddress) {
      console.log(`  Network: http://${networkAddress}:${config.port}`);
    }
    console.log('');
    console.log('  Press Ctrl+C to stop');
    console.log('');

    // Open browser if configured
    if (config.open) {
      openBrowser(`http://localhost:${config.port}`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('EADDRINUSE')) {
      console.error(`\n✗ Port ${config.port} is already in use`);
      console.error('');
      console.error('  Try:');
      console.error(`    pnpm dev --port ${config.port + 1}`);
      console.error('');
      console.error('  Or find the process:');
      console.error(`    lsof -i :${config.port}`);
      process.exit(1);
    }

    console.error('\n✗ Failed to start server:', err);
    process.exit(1);
  }

  // Graceful shutdown handler
  async function shutdown(signal: string): Promise<void> {
    console.log(`\n${signal} received, shutting down...`);
    state.setStatus('stopping');

    // Close file watcher
    if (state.watcher) {
      await state.watcher.close();
      console.log('  ✓ Stopped file watcher');
    }

    // Close WebSocket connections
    const clientCount = state.clientCount;
    for (const client of state.clients) {
      client.close(1000, 'Server shutting down');
    }
    if (clientCount > 0) {
      console.log(`  ✓ Closed ${clientCount} browser connection${clientCount === 1 ? '' : 's'}`);
    }

    // Close HTTP server
    if (server) {
      await server.close();
      console.log('  ✓ HTTP server closed');
    }

    state.setStatus('stopped');
    console.log('\nGoodbye!');
    process.exit(0);
  }

  // Register signal handlers
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Run main
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
