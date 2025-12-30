import chokidar, { type FSWatcher } from 'chokidar';
import { join, relative } from 'node:path';
import type { DevServerConfig, FileChangeEvent, ServerMessage } from './types.js';
import { resolveConfigPaths } from './config.js';
import { DevServerState } from './state.js';
import { renderArticle, clearTemplateCache } from './renderer.js';

/**
 * Categorize a file change event.
 * Per data-model.md derivation rules.
 */
export function categorizeFile(
  path: string,
  postsDir: string,
  stylesDir: string,
  templatesDir: string
): FileChangeEvent['category'] {
  if (path.startsWith(postsDir)) {
    const relativePath = relative(postsDir, path);
    if (relativePath.endsWith('index.md') || relativePath.endsWith('.md')) {
      return 'markdown';
    }
    return 'asset';
  }

  if (path.startsWith(stylesDir) && path.endsWith('.css')) {
    return 'css';
  }

  if (path.startsWith(templatesDir) && path.endsWith('.html')) {
    return 'template';
  }

  return 'asset';
}

/**
 * Extract slug from a markdown file path.
 * posts/{slug}/index.md → slug
 */
export function extractSlug(path: string, postsDir: string): string | undefined {
  if (!path.startsWith(postsDir)) return undefined;

  const relativePath = relative(postsDir, path);
  const parts = relativePath.split('/');

  // Expect pattern: {slug}/index.md
  if (parts.length >= 2 && parts[1] === 'index.md') {
    return parts[0];
  }

  // Also handle {slug}.md at root level
  if (parts.length === 1 && parts[0]?.endsWith('.md')) {
    return parts[0].slice(0, -3);
  }

  return undefined;
}

/**
 * Format timestamp for console output.
 */
function formatTime(): string {
  const now = new Date();
  return `[${now.toLocaleTimeString('en-US', { hour12: false })}]`;
}

/**
 * Broadcast a message to all connected clients.
 */
export function broadcast(state: DevServerState, message: ServerMessage): void {
  const messageStr = JSON.stringify(message);
  for (const client of state.clients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(messageStr);
    }
  }
}

/**
 * Handle markdown file change.
 */
async function handleMarkdownChange(
  event: FileChangeEvent,
  config: DevServerConfig,
  state: DevServerState
): Promise<void> {
  const slug = event.slug;

  if (!slug) {
    console.warn(`${formatTime()} Could not extract slug from: ${event.path}`);
    return;
  }

  if (event.type === 'unlink') {
    // File deleted
    console.log(`${formatTime()} Deleted: ${event.path}`);
    state.removeArticle(slug);
    console.log(`${formatTime()} Removed: ${slug}`);

    // Clear cached pages
    state.indexHtml = '';
    state.archiveHtml = '';
    state.allTagsHtml = '';
    state.tagPages.clear();

    console.log(`${formatTime()} Reloading browsers...`);
    broadcast(state, { type: 'reload' });
    return;
  }

  // File added or changed
  console.log(`${formatTime()} ${event.type === 'add' ? 'Added' : 'Changed'}: ${event.path}`);

  const startRender = Date.now();
  const result = await renderArticle(config, event.path, state.articleIndex ?? undefined);

  if ('error' in result) {
    console.error(`${formatTime()} ✗ Error in ${result.error.file}:`);
    console.error(`           ${result.error.message}`);
    console.error('           Skipping article, other content still available.');
    broadcast(state, { type: 'error', error: result.error });
    return;
  }

  state.addArticle(result.article);
  console.log(`${formatTime()} Rendered: ${slug} (${Date.now() - startRender}ms)`);

  // Clear cached pages
  state.indexHtml = '';
  state.archiveHtml = '';
  state.allTagsHtml = '';
  state.tagPages.clear();

  console.log(`${formatTime()} Reloading browsers...`);
  broadcast(state, { type: 'reload' });
}

/**
 * Handle CSS file change.
 */
function handleCssChange(
  event: FileChangeEvent,
  config: DevServerConfig,
  state: DevServerState
): void {
  const paths = resolveConfigPaths(config);
  const relativePath = relative(paths.stylesDir, event.path);

  console.log(`${formatTime()} Changed: ${event.path}`);
  console.log(`${formatTime()} Updating CSS in browsers...`);

  broadcast(state, { type: 'css', path: relativePath });
}

/**
 * Handle template file change.
 */
async function handleTemplateChange(
  event: FileChangeEvent,
  config: DevServerConfig,
  state: DevServerState
): Promise<void> {
  console.log(`${formatTime()} Changed: ${event.path}`);
  console.log(`${formatTime()} Template changed, re-rendering all...`);

  // Clear template cache
  clearTemplateCache();

  // Re-render all articles
  const paths = resolveConfigPaths(config);
  const currentArticles = state.getAllArticles();
  for (const article of currentArticles) {
    const indexPath = join(paths.postsDir, article.slug, 'index.md');
    const result = await renderArticle(config, indexPath, state.articleIndex ?? undefined);
    if ('article' in result) {
      state.addArticle(result.article);
    }
  }

  // Clear cached pages (they'll be re-rendered on demand)
  state.indexHtml = '';
  state.archiveHtml = '';
  state.allTagsHtml = '';
  state.tagPages.clear();

  console.log(`${formatTime()} Reloading browsers...`);
  broadcast(state, { type: 'reload' });
}

/**
 * Handle asset file change (images, etc.).
 */
function handleAssetChange(
  event: FileChangeEvent,
  config: DevServerConfig,
  state: DevServerState
): void {
  console.log(`${formatTime()} ${event.type === 'add' ? 'Added' : event.type === 'unlink' ? 'Deleted' : 'Changed'}: ${event.path}`);
  console.log(`${formatTime()} Reloading browsers...`);

  broadcast(state, { type: 'reload' });
}

/**
 * Create file change event from chokidar event.
 */
function createFileChangeEvent(
  type: 'add' | 'change' | 'unlink',
  path: string,
  config: DevServerConfig
): FileChangeEvent {
  const paths = resolveConfigPaths(config);
  const category = categorizeFile(path, paths.postsDir, paths.stylesDir, paths.templatesDir);
  const slug = category === 'markdown' ? extractSlug(path, paths.postsDir) : undefined;

  return {
    type,
    path,
    category,
    slug,
    timestamp: new Date(),
  };
}

/**
 * Process a file change event.
 */
async function processChange(
  event: FileChangeEvent,
  config: DevServerConfig,
  state: DevServerState
): Promise<void> {
  switch (event.category) {
    case 'markdown':
      await handleMarkdownChange(event, config, state);
      break;
    case 'css':
      handleCssChange(event, config, state);
      break;
    case 'template':
      await handleTemplateChange(event, config, state);
      break;
    case 'asset':
      handleAssetChange(event, config, state);
      break;
  }
}

/**
 * Create file watcher.
 * Per research.md chokidar best practices.
 */
export function createWatcher(
  config: DevServerConfig,
  state: DevServerState
): FSWatcher {
  const paths = resolveConfigPaths(config);

  const watchPaths = [
    join(paths.postsDir, '**/*.md'),
    join(paths.stylesDir, '**/*.css'),
    join(paths.templatesDir, '**/*.html'),
    join(paths.postsDir, '**/*.{png,jpg,jpeg,gif,svg,webp,pdf}'),
  ];

  // Debounce timer
  let debounceTimer: NodeJS.Timeout | null = null;

  const watcher = chokidar.watch(watchPaths, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
    ],
  });

  // Handle file events with debouncing
  const handleEvent = (type: 'add' | 'change' | 'unlink', path: string) => {
    const event = createFileChangeEvent(type, path, config);
    state.addPendingChange(event);

    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Set new timer
    debounceTimer = setTimeout(async () => {
      const changes = state.flushPendingChanges();

      // Process changes, grouping by category for efficiency
      for (const change of changes) {
        await processChange(change, config, state);
      }
    }, config.debounceMs);
  };

  watcher.on('add', (path) => handleEvent('add', path));
  watcher.on('change', (path) => handleEvent('change', path));
  watcher.on('unlink', (path) => handleEvent('unlink', path));

  watcher.on('error', (error) => {
    console.error(`${formatTime()} Watcher error:`, error);
  });

  return watcher;
}
