# blog Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-23

## Active Technologies
- TypeScript 5.3+ targeting ES2022 on Node.js 20.x + Existing unified/remark stack, chokidar (file watching), ws (WebSocket), express or fastify (HTTP server) (002-local-dev-server)
- Local filesystem (posts/, packages/site/src/) (002-local-dev-server)
- TypeScript 5.3+ targeting ES2022 on Node.js 20.x + Fastify (HTTP), Handlebars (templates), @blog/core (TagIndex, models) (003-all-tags-page)
- In-memory cache (dev-server), static HTML files (production) (003-all-tags-page)
- TypeScript 5.3+ targeting ES2022 on Node.js 20.x + Fastify 4.28.0 (dev-server HTTP), Handlebars 4.7.8 (templates), @blog/core (TagIndex, models), AWS SDK v3 (production renderer) (004-fix-tag-pages)
- In-memory cache (dev-server), S3 static files (production) (004-fix-tag-pages)
- TypeScript 5.3+ targeting ES2022 on Node.js 20.x + GitHub Actions, AWS CDK 2.120.0, pnpm 8.15.0 (005-ci-cd-pipeline)
- N/A (workflow files stored in `.github/workflows/`) (005-ci-cd-pipeline)
- TypeScript 5.3+ targeting ES2022 on AWS Lambda Node.js 20.x + AWS SDK v3 (S3, SNS, CloudFront), unified/remark (markdown), gray-matter (front matter), octokit (GitHub API) (006-webhook-renderer-connection)
- S3 bucket (blog-content-{environment}-{account}) for rendered HTML and assets (006-webhook-renderer-connection)

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
- 006-webhook-renderer-connection: Added TypeScript 5.3+ targeting ES2022 on AWS Lambda Node.js 20.x + AWS SDK v3 (S3, SNS, CloudFront), unified/remark (markdown), gray-matter (front matter), octokit (GitHub API)
- 005-ci-cd-pipeline: Added TypeScript 5.3+ targeting ES2022 on Node.js 20.x + GitHub Actions, AWS CDK 2.120.0, pnpm 8.15.0
- 004-fix-tag-pages: Added TypeScript 5.3+ targeting ES2022 on Node.js 20.x + Fastify 4.28.0 (dev-server HTTP), Handlebars 4.7.8 (templates), @blog/core (TagIndex, models), AWS SDK v3 (production renderer)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
