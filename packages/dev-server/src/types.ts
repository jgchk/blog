import type { WebSocket } from 'ws';
import type { FSWatcher } from 'chokidar';
import type { ArticleIndex, Article } from '@blog/core';

/**
 * Configuration for the development server instance.
 * Per data-model.md specification.
 */
export interface DevServerConfig {
  /** HTTP server port (default: 3000) */
  port: number;

  /** Root directory of the blog repository */
  rootDir: string;

  /** Posts directory relative to rootDir (default: 'posts') */
  postsDir: string;

  /** Site package directory for templates/styles (default: 'packages/site') */
  siteDir: string;

  /** Whether to open browser on start (default: true) */
  open: boolean;

  /** Debounce delay for file changes in ms (default: 100) */
  debounceMs: number;
}

/**
 * Represents a file system change detected by the watcher.
 * Per data-model.md specification.
 */
export interface FileChangeEvent {
  /** Type of change */
  type: 'add' | 'change' | 'unlink';

  /** Absolute path to the changed file */
  path: string;

  /** File category for routing to appropriate handler */
  category: 'markdown' | 'css' | 'template' | 'asset';

  /** Extracted slug for markdown files (e.g., 'my-post') */
  slug?: string;

  /** Timestamp of the event */
  timestamp: Date;
}

/**
 * In-memory representation of a rendered article for serving.
 * Per data-model.md specification.
 */
export interface RenderedArticle {
  /** Article slug (URL path) */
  slug: string;

  /** Rendered HTML (article wrapped in template) */
  html: string;

  /** Article metadata from front matter */
  metadata: {
    title: string;
    date: Date;
    tags: string[];
    excerpt: string;
  };

  /** Assets associated with this article (images, etc.) */
  assets: string[];

  /** Last render timestamp */
  renderedAt: Date;

  /** Rendering errors (null if successful) */
  error: RenderError | null;
}

/**
 * Structured error for display in console and browser.
 * Per data-model.md specification.
 */
export interface RenderError {
  /** Error type for categorization */
  type: 'parse' | 'frontmatter' | 'template' | 'unknown';

  /** Human-readable error message */
  message: string;

  /** Source file path */
  file: string;

  /** Line number if available */
  line?: number;

  /** Column number if available */
  column?: number;

  /** Stack trace for debugging */
  stack?: string;
}

/**
 * Messages sent from server to client.
 * Per websocket-api.md specification.
 */
export type ServerMessage =
  | { type: 'reload' }
  | { type: 'css'; path: string }
  | { type: 'error'; error: RenderError }
  | { type: 'connected' };

/**
 * Messages sent from client to server.
 * Per websocket-api.md specification.
 */
export type ClientMessage = { type: 'ping' };

/**
 * Runtime state of the development server.
 * Per data-model.md specification.
 */
export interface DevServerStateData {
  /** Server status */
  status: 'starting' | 'running' | 'stopping' | 'stopped';

  /** All rendered articles keyed by slug */
  articles: Map<string, RenderedArticle>;

  /** Article index for wikilink resolution */
  articleIndex: ArticleIndex | null;

  /** Rendered index page HTML */
  indexHtml: string;

  /** Rendered archive page HTML */
  archiveHtml: string;

  /** Rendered tag pages keyed by tag slug */
  tagPages: Map<string, string>;

  /** Connected WebSocket clients */
  clients: Set<WebSocket>;

  /** Active file watcher */
  watcher: FSWatcher | null;

  /** Pending file changes (for debouncing) */
  pendingChanges: Map<string, FileChangeEvent>;

  /** Server start time */
  startedAt: Date | null;
}

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: DevServerConfig = {
  port: 3000,
  rootDir: process.cwd(),
  postsDir: 'posts',
  siteDir: 'packages/site',
  open: true,
  debounceMs: 100,
};

/**
 * Create a RenderError from an unknown error.
 */
export function createRenderError(
  type: RenderError['type'],
  file: string,
  error: unknown
): RenderError {
  const message =
    error instanceof Error ? error.message : 'Unknown error occurred';
  const stack = error instanceof Error ? error.stack : undefined;

  return {
    type,
    message,
    file,
    stack,
  };
}

/**
 * Format a RenderError for console output.
 */
export function formatRenderError(error: RenderError): string {
  let formatted = `Error in ${error.file}:\n  ${error.message}`;
  if (error.line !== undefined) {
    formatted += ` (line ${error.line}`;
    if (error.column !== undefined) {
      formatted += `, column ${error.column}`;
    }
    formatted += ')';
  }
  return formatted;
}

/**
 * Convert an Article from @blog/core to a RenderedArticle.
 */
export function articleToRendered(
  article: Article,
  html: string,
  assets: string[] = []
): RenderedArticle {
  return {
    slug: article.slug,
    html,
    metadata: {
      title: article.title,
      date: article.date,
      tags: article.tags,
      excerpt: article.excerpt,
    },
    assets,
    renderedAt: new Date(),
    error: null,
  };
}
