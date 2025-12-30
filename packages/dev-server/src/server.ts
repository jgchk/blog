import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import type { DevServerConfig, ServerMessage } from './types.js';
import { resolveConfigPaths } from './config.js';
import { Slug } from '@blog/core/publishing';
import { DevServerState } from './state.js';
import { getClientScript, injectClientScript } from './client.js';
import {
  renderIndex,
  renderArchive,
  renderTagPage,
  renderAllTags,
  getAllTags,
  scanAndRenderAll,
} from './renderer.js';

/**
 * MIME types for common file extensions.
 */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
};

/**
 * Get MIME type for a file extension.
 */
function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

/**
 * Add dev server headers to response.
 * Per http-api.md specification.
 */
function addDevHeaders(reply: FastifyReply): void {
  reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  reply.header('X-Dev-Server', 'blog-dev/1.0');
}

/**
 * Send HTML response with client script injection.
 */
function sendHtml(reply: FastifyReply, html: string): FastifyReply {
  addDevHeaders(reply);
  return reply
    .type('text/html; charset=utf-8')
    .send(injectClientScript(html));
}

/**
 * Render 404 error page.
 */
function render404(resource: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>404 Not Found</title></head>
<body>
  <h1>404 Not Found</h1>
  <p>${resource} not found</p>
  <a href="/">← Back to home</a>
</body>
</html>`;
}

/**
 * Render 500 error page.
 */
function render500(error: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>500 Error</title></head>
<body>
  <h1>Rendering Error</h1>
  <pre>${error}</pre>
  <p>Check the console for details.</p>
</body>
</html>`;
}

/**
 * Create and configure Fastify server.
 */
export async function createServer(
  config: DevServerConfig,
  state: DevServerState
): Promise<FastifyInstance> {
  const paths = resolveConfigPaths(config);
  const fastify = Fastify({ logger: false, ignoreTrailingSlash: true });

  // Register WebSocket plugin
  await fastify.register(fastifyWebsocket);

  // Register static file serving for CSS
  await fastify.register(fastifyStatic, {
    root: paths.stylesDir,
    prefix: '/styles/',
    decorateReply: false,
  });

  // WebSocket handler on /__dev/ws for live reload
  fastify.get('/__dev/ws', { websocket: true }, (socket) => {
    state.addClient(socket);
    socket.send(JSON.stringify({ type: 'connected' } satisfies ServerMessage));

    socket.on('close', () => {
      state.removeClient(socket);
    });

    socket.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'ping') {
          // Heartbeat, no response needed
        }
      } catch {
        // Ignore invalid messages
      }
    });
  });

  // GET / - Index page
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!state.indexHtml) {
        const articles = state.getAllArticles();
        state.indexHtml = await renderIndex(config, articles);
      }
      return sendHtml(reply, state.indexHtml);
    } catch (err) {
      console.error('Error rendering index:', err);
      return sendHtml(reply.status(500), render500(String(err)));
    }
  });

  // GET /__dev/client.js - Live reload client script
  fastify.get('/__dev/client.js', (request: FastifyRequest, reply: FastifyReply) => {
    addDevHeaders(reply);
    return reply
      .type('application/javascript; charset=utf-8')
      .send(getClientScript());
  });

  // GET /articles/:slug - Article page
  fastify.get<{ Params: { slug: string } }>(
    '/articles/:slug',
    async (request, reply) => {
      const { slug } = request.params;
      const article = state.getArticle(slug);

      if (!article) {
        return sendHtml(reply.status(404), render404(`Article "${slug}"`));
      }

      if (article.error) {
        return sendHtml(reply.status(500), render500(article.error.message));
      }

      return sendHtml(reply, article.html);
    }
  );

  // GET /articles/:slug/:asset - Article assets
  fastify.get<{ Params: { slug: string; asset: string } }>(
    '/articles/:slug/:asset',
    (request, reply) => {
      const { slug, asset } = request.params;
      const assetPath = resolve(paths.postsDir, slug, asset);

      if (!existsSync(assetPath)) {
        addDevHeaders(reply);
        return reply.status(404).send(`Asset not found: ${asset}`);
      }

      try {
        const content = readFileSync(assetPath);
        addDevHeaders(reply);
        return reply.type(getMimeType(asset)).send(content);
      } catch (err) {
        console.error(`Error reading asset ${assetPath}:`, err);
        addDevHeaders(reply);
        return reply.status(500).send('Error reading asset');
      }
    }
  );

  // GET /archive and /archive.html - Archive page
  const archiveHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!state.archiveHtml) {
        const articles = state.getAllArticles();
        state.archiveHtml = await renderArchive(config, articles);
      }
      return sendHtml(reply, state.archiveHtml);
    } catch (err) {
      console.error('Error rendering archive:', err);
      return sendHtml(reply.status(500), render500(String(err)));
    }
  };
  fastify.get('/archive', archiveHandler);
  fastify.get('/archive.html', archiveHandler);

  // GET /tags - All tags page
  fastify.get('/tags', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!state.allTagsHtml) {
        const articles = state.getAllArticles();
        state.allTagsHtml = await renderAllTags(config, articles);
      }
      return sendHtml(reply, state.allTagsHtml);
    } catch (err) {
      console.error('Error rendering all tags:', err);
      return sendHtml(reply.status(500), render500(String(err)));
    }
  });

  // GET /tags/:tag - Tag page
  fastify.get<{ Params: { tag: string } }>(
    '/tags/:tag',
    async (request, reply) => {
      const { tag } = request.params;
      // Strip .html extension from URL parameter (e.g., "typescript.html" -> "typescript")
      const tagSlug = tag.replace(/\.html$/, '');
      const articles = state.getAllArticles();
      const allTags = getAllTags(articles);

      // Check if tag exists by comparing normalized slugs
      const matchedTag = allTags.find(
        (t) => Slug.normalizeTag(t) === tagSlug.toLowerCase()
      );

      if (!matchedTag) {
        return sendHtml(reply.status(404), render404(`Tag "${tagSlug}"`));
      }

      try {
        let tagHtml = state.tagPages.get(matchedTag);
        if (!tagHtml) {
          tagHtml = await renderTagPage(config, matchedTag, articles);
          state.tagPages.set(matchedTag, tagHtml);
        }
        return sendHtml(reply, tagHtml);
      } catch (err) {
        console.error(`Error rendering tag page for ${tag}:`, err);
        return sendHtml(reply.status(500), render500(String(err)));
      }
    }
  );

  // GET /styles/:file - CSS files (handled by fastify-static, but add headers)
  fastify.addHook('onSend', (request, reply, payload, done) => {
    if (request.url.startsWith('/styles/')) {
      addDevHeaders(reply);
    }
    done(null, payload);
  });

  return fastify;
}

/**
 * Start the server and perform initial rendering.
 */
export async function startServer(
  config: DevServerConfig,
  state: DevServerState
): Promise<FastifyInstance> {
  state.setStatus('starting');

  // Scan and render all articles
  console.log('  Scanning articles...');
  const startScan = Date.now();
  const { articles, errors } = await scanAndRenderAll(config);

  // Populate state
  for (const [, article] of articles) {
    state.addArticle(article);
  }

  // Log any render errors
  for (const error of errors) {
    console.error(`  ✗ ${error.file}: ${error.message}`);
  }

  console.log(`  Found ${state.articleCount} articles (${Date.now() - startScan}ms)`);

  // Pre-render index and archive
  console.log('  Rendering pages...');
  const articlesArray = state.getAllArticles();
  state.indexHtml = await renderIndex(config, articlesArray);
  state.archiveHtml = await renderArchive(config, articlesArray);

  // Create and start server
  const server = await createServer(config, state);

  await server.listen({ port: config.port, host: '0.0.0.0' });
  state.setStatus('running');

  return server;
}
