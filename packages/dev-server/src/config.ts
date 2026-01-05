import { existsSync, mkdirSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import type { DevServerConfig } from './types.js';
import { DEFAULT_CONFIG } from './types.js';

/**
 * Validation result for config.
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a DevServerConfig.
 * Per data-model.md validation rules.
 */
export function validateConfig(
  config: DevServerConfig
): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate port range (1024-65535 for non-privileged ports)
  if (config.port < 1024 || config.port > 65535) {
    errors.push(
      `Invalid port: ${config.port}. Port must be between 1024 and 65535.`
    );
  }

  // Validate rootDir exists
  const rootDir = isAbsolute(config.rootDir)
    ? config.rootDir
    : resolve(process.cwd(), config.rootDir);

  if (!existsSync(rootDir)) {
    errors.push(`Root directory not found: ${rootDir}`);
  }

  // Validate/create postsDir
  const postsDir = resolve(rootDir, config.postsDir);
  if (!existsSync(postsDir)) {
    warnings.push(
      `Posts directory not found: ${postsDir}. It will be created.`
    );
  }

  // Validate siteDir exists
  const siteDir = resolve(rootDir, config.siteDir);
  if (!existsSync(siteDir)) {
    errors.push(`Site directory not found: ${siteDir}`);
  }

  // Validate debounceMs is positive
  if (config.debounceMs < 0) {
    errors.push(`Invalid debounce: ${config.debounceMs}. Must be >= 0.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Create a config with defaults filled in.
 */
export function createDefaultConfig(
  overrides: Partial<DevServerConfig> = {}
): DevServerConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
  };
}

/**
 * Ensure required directories exist, creating them if needed.
 * Returns true if successful, false if creation failed.
 */
export function ensureDirectories(config: DevServerConfig): {
  success: boolean;
  created: string[];
  errors: string[];
} {
  const created: string[] = [];
  const errors: string[] = [];

  const rootDir = isAbsolute(config.rootDir)
    ? config.rootDir
    : resolve(process.cwd(), config.rootDir);

  const postsDir = resolve(rootDir, config.postsDir);

  // Create posts directory if it doesn't exist
  if (!existsSync(postsDir)) {
    try {
      mkdirSync(postsDir, { recursive: true });
      created.push(postsDir);
    } catch (err) {
      errors.push(
        `Failed to create posts directory: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }

  return {
    success: errors.length === 0,
    created,
    errors,
  };
}

/**
 * Resolve all paths in config to absolute paths.
 */
export function resolveConfigPaths(config: DevServerConfig): {
  rootDir: string;
  postsDir: string;
  siteDir: string;
  templatesDir: string;
  stylesDir: string;
  fontsDir: string;
  imagesDir: string;
  faviconsDir: string;
} {
  const rootDir = isAbsolute(config.rootDir)
    ? config.rootDir
    : resolve(process.cwd(), config.rootDir);

  const postsDir = resolve(rootDir, config.postsDir);
  const siteDir = resolve(rootDir, config.siteDir);
  const templatesDir = resolve(siteDir, 'src/templates');
  const stylesDir = resolve(siteDir, 'src/styles');
  const fontsDir = resolve(siteDir, 'src/fonts');
  const imagesDir = resolve(siteDir, 'src/images');
  const faviconsDir = resolve(siteDir, 'src/favicons');

  return {
    rootDir,
    postsDir,
    siteDir,
    templatesDir,
    stylesDir,
    fontsDir,
    imagesDir,
    faviconsDir,
  };
}
