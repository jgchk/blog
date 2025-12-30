import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  validateConfig,
  createDefaultConfig,
  ensureDirectories,
  resolveConfigPaths,
} from '../../src/config.js';
import type { DevServerConfig } from '../../src/types.js';

describe('validateConfig', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'dev-server-test-'));
    mkdirSync(join(testDir, 'posts'));
    mkdirSync(join(testDir, 'packages/site'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should validate a valid config', () => {
    const config: DevServerConfig = {
      port: 3000,
      rootDir: testDir,
      postsDir: 'posts',
      siteDir: 'packages/site',
      open: true,
      debounceMs: 100,
    };

    const result = validateConfig(config);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject port below 1024', () => {
    const config: DevServerConfig = {
      port: 80,
      rootDir: testDir,
      postsDir: 'posts',
      siteDir: 'packages/site',
      open: true,
      debounceMs: 100,
    };

    const result = validateConfig(config);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Invalid port: 80. Port must be between 1024 and 65535.'
    );
  });

  it('should reject port above 65535', () => {
    const config: DevServerConfig = {
      port: 70000,
      rootDir: testDir,
      postsDir: 'posts',
      siteDir: 'packages/site',
      open: true,
      debounceMs: 100,
    };

    const result = validateConfig(config);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Invalid port'))).toBe(true);
  });

  it('should reject non-existent root directory', () => {
    const config: DevServerConfig = {
      port: 3000,
      rootDir: '/nonexistent/directory',
      postsDir: 'posts',
      siteDir: 'packages/site',
      open: true,
      debounceMs: 100,
    };

    const result = validateConfig(config);

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes('Root directory not found'))
    ).toBe(true);
  });

  it('should warn about missing posts directory', () => {
    rmSync(join(testDir, 'posts'), { recursive: true });

    const config: DevServerConfig = {
      port: 3000,
      rootDir: testDir,
      postsDir: 'posts',
      siteDir: 'packages/site',
      open: true,
      debounceMs: 100,
    };

    const result = validateConfig(config);

    expect(result.valid).toBe(true);
    expect(
      result.warnings.some((w) => w.includes('Posts directory not found'))
    ).toBe(true);
  });

  it('should reject negative debounce', () => {
    const config: DevServerConfig = {
      port: 3000,
      rootDir: testDir,
      postsDir: 'posts',
      siteDir: 'packages/site',
      open: true,
      debounceMs: -100,
    };

    const result = validateConfig(config);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Invalid debounce'))).toBe(
      true
    );
  });
});

describe('createDefaultConfig', () => {
  it('should create config with defaults', () => {
    const config = createDefaultConfig();

    expect(config.port).toBe(3000);
    expect(config.postsDir).toBe('posts');
    expect(config.siteDir).toBe('packages/site');
    expect(config.open).toBe(true);
    expect(config.debounceMs).toBe(100);
  });

  it('should allow overriding defaults', () => {
    const config = createDefaultConfig({
      port: 8080,
      open: false,
    });

    expect(config.port).toBe(8080);
    expect(config.open).toBe(false);
    expect(config.postsDir).toBe('posts'); // Default preserved
  });
});

describe('ensureDirectories', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'dev-server-test-'));
    mkdirSync(join(testDir, 'packages/site'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should create missing posts directory', () => {
    const config: DevServerConfig = {
      port: 3000,
      rootDir: testDir,
      postsDir: 'posts',
      siteDir: 'packages/site',
      open: true,
      debounceMs: 100,
    };

    const result = ensureDirectories(config);

    expect(result.success).toBe(true);
    expect(result.created).toContain(join(testDir, 'posts'));
    expect(result.errors).toHaveLength(0);
  });

  it('should not recreate existing directory', () => {
    mkdirSync(join(testDir, 'posts'));

    const config: DevServerConfig = {
      port: 3000,
      rootDir: testDir,
      postsDir: 'posts',
      siteDir: 'packages/site',
      open: true,
      debounceMs: 100,
    };

    const result = ensureDirectories(config);

    expect(result.success).toBe(true);
    expect(result.created).toHaveLength(0);
  });
});

describe('resolveConfigPaths', () => {
  it('should resolve all paths correctly', () => {
    const config: DevServerConfig = {
      port: 3000,
      rootDir: '/home/user/blog',
      postsDir: 'posts',
      siteDir: 'packages/site',
      open: true,
      debounceMs: 100,
    };

    const paths = resolveConfigPaths(config);

    expect(paths.rootDir).toBe('/home/user/blog');
    expect(paths.postsDir).toBe('/home/user/blog/posts');
    expect(paths.siteDir).toBe('/home/user/blog/packages/site');
    expect(paths.templatesDir).toBe('/home/user/blog/packages/site/src/templates');
    expect(paths.stylesDir).toBe('/home/user/blog/packages/site/src/styles');
  });

  it('should resolve fontsDir path', () => {
    const config: DevServerConfig = {
      port: 3000,
      rootDir: '/home/user/blog',
      postsDir: 'posts',
      siteDir: 'packages/site',
      open: true,
      debounceMs: 100,
    };

    const paths = resolveConfigPaths(config);

    expect(paths.fontsDir).toBe('/home/user/blog/packages/site/src/fonts');
  });
});
