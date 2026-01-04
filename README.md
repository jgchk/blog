# jake.cafe

A personal markdown blog with a focus on simplicity for both authors and readers.

## Architecture

This is a pnpm monorepo with five packages:

| Package            | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `@blog/core`       | Markdown parsing, rendering pipeline, and content models |
| `@blog/renderer`   | AWS Lambda handler and S3/CloudFront deployment adapter  |
| `@blog/dev-server` | Local development server with hot reload                 |
| `@blog/infra`      | AWS CDK infrastructure (S3, CloudFront, Route53)         |
| `@blog/site`       | Static assets, templates, and E2E tests                  |

## Prerequisites

- Node.js 20+
- pnpm 8.15+

## Getting Started

```bash
# Install dependencies
pnpm install

# Start the dev server
pnpm dev
```

The dev server watches `posts/` for markdown files and serves them at `http://localhost:3000` with live reload.

## Writing Posts

Create a markdown file in `posts/`:

```
posts/
  my-post/
    index.md
```

With front matter:

```yaml
---
title: My Post Title
date: 2025-01-04
tags:
  - example
draft: false
---
Your content here...
```

Posts with `draft: true` are excluded from production builds.

## Commands

| Command          | Description              |
| ---------------- | ------------------------ |
| `pnpm dev`       | Start development server |
| `pnpm build`     | Build all packages       |
| `pnpm test`      | Run all tests            |
| `pnpm test:e2e`  | Run E2E tests            |
| `pnpm lint`      | Lint codebase            |
| `pnpm typecheck` | Type check all packages  |

## Deployment

The site deploys automatically via GitHub Actions on push to `main`:

1. CI runs lint, typecheck, and tests
2. E2E tests run against the dev server
3. Content is rendered to static HTML
4. Assets deploy to S3 with CloudFront CDN
5. Smoke tests verify production

Infrastructure is managed with AWS CDK in `packages/infra`.

## Tech Stack

- **Runtime**: Node.js 20, TypeScript 5.3+
- **Markdown**: unified, remark, rehype
- **Server**: Fastify (dev), AWS Lambda (prod)
- **Templates**: Handlebars
- **Infrastructure**: AWS CDK, S3, CloudFront, Route53
- **Testing**: Vitest (unit), Playwright (E2E)

## License

Private
