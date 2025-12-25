# blog Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-23

## Active Technologies
- TypeScript 5.3+ targeting ES2022 on Node.js 20.x + Existing unified/remark stack, chokidar (file watching), ws (WebSocket), express or fastify (HTTP server) (002-local-dev-server)
- Local filesystem (posts/, packages/site/src/) (002-local-dev-server)
- TypeScript 5.3+ targeting ES2022 on Node.js 20.x + Fastify (HTTP), Handlebars (templates), @blog/core (TagIndex, models) (003-all-tags-page)
- In-memory cache (dev-server), static HTML files (production) (003-all-tags-page)

- TypeScript 5.3+ targeting ES2022 on AWS Lambda Node.js 20.x + unified/remark (markdown), gray-matter (front matter), AWS SDK v3 (001-markdown-blog)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.3+ targeting ES2022 on AWS Lambda Node.js 20.x: Follow standard conventions

## Recent Changes
- 003-all-tags-page: Added TypeScript 5.3+ targeting ES2022 on Node.js 20.x + Fastify (HTTP), Handlebars (templates), @blog/core (TagIndex, models)
- 002-local-dev-server: Added TypeScript 5.3+ targeting ES2022 on Node.js 20.x + Existing unified/remark stack, chokidar (file watching), ws (WebSocket), express or fastify (HTTP server)

- 001-markdown-blog: Added TypeScript 5.3+ targeting ES2022 on AWS Lambda Node.js 20.x + unified/remark (markdown), gray-matter (front matter), AWS SDK v3

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
