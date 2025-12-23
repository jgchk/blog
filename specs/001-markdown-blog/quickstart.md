# Quickstart: Lightweight Markdown Blog

**Date**: 2025-12-23
**Purpose**: Get started developing the markdown blog system

---

## Prerequisites

- Node.js 20.x (LTS)
- pnpm 8.x+ (`npm install -g pnpm`)
- AWS CLI v2 (configured with credentials)
- Git

## Initial Setup

```bash
# Clone the repository
git clone <repo-url>
cd blog

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your AWS configuration
```

## Project Structure

```
blog/
├── packages/
│   ├── core/                   # Cloud-agnostic business logic
│   │   ├── src/
│   │   │   ├── models/         # Article, Tag, FrontMatter types
│   │   │   ├── services/       # MarkdownParser, CrossLinkResolver, TagIndex
│   │   │   └── interfaces/     # Storage, Notification abstractions
│   │   └── tests/unit/
│   │
│   ├── renderer/               # Markdown → HTML rendering Lambda
│   │   ├── src/
│   │   │   ├── handlers/       # Lambda entry points
│   │   │   └── adapters/       # AWS S3, Git implementations
│   │   └── tests/
│   │
│   ├── site/                   # Static frontend templates
│   │   ├── src/
│   │   │   ├── templates/      # HTML page templates
│   │   │   └── styles/         # CSS (themeable)
│   │   └── tests/e2e/
│   │
│   └── infra/                  # AWS CDK infrastructure
│       └── lib/
│
├── posts/                      # Your markdown articles
│   └── example-post/
│       ├── index.md
│       └── image.png
│
└── specs/                      # Feature specifications
```

## Development Workflow

### 1. Run Tests (TDD)

```bash
# Unit tests in watch mode
pnpm --filter @blog/core test:watch

# All unit tests
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# Full test suite
pnpm test
```

### 2. Local Development

```bash
# Start local development server
pnpm dev

# Build all packages
pnpm build

# Type check
pnpm typecheck

# Lint
pnpm lint
```

### 3. Test Lambda Locally

```bash
# Using AWS SAM CLI
cd packages/renderer
sam local invoke RenderFunction -e events/push.json

# Or start local API
sam local start-api
```

## Writing Articles

### Create a New Article

```bash
# Create article folder
mkdir -p posts/my-new-article

# Create article file
touch posts/my-new-article/index.md
```

### Front Matter Format

```yaml
---
title: My Article Title
date: 2025-01-15
tags:
  - TypeScript
  - Tutorial
aliases:
  - My Article
  - TS Tutorial
draft: false
---

Your markdown content here...
```

### Cross-Linking

Link to other articles using Obsidian-style wikilinks:

```markdown
Check out [[Another Article Title]] for more info.

Or use an alias: [[TS Tutorial]]
```

### Images

Co-locate images in your article folder:

```
posts/my-article/
├── index.md
└── diagram.png
```

Reference with relative paths:

```markdown
![Architecture Diagram](./diagram.png)
```

## Deployment

### Deploy Infrastructure (First Time)

```bash
cd packages/infra
pnpm cdk bootstrap    # One-time setup
pnpm cdk deploy
```

### Deploy Content

Push to the main branch—the webhook triggers automatic rendering:

```bash
git add posts/
git commit -m "Add new article"
git push origin main
```

## Environment Variables

```bash
# .env.local
AWS_REGION=us-east-1
S3_BUCKET=blog-content-dev
CLOUDFRONT_DISTRIBUTION_ID=E1234567890
GITHUB_WEBHOOK_SECRET=your-secret
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:123456789:blog-alerts
```

## Package Scripts

### Root Level

| Script | Description |
|--------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm test:unit` | Run unit tests only |
| `pnpm test:e2e` | Run E2E tests only |
| `pnpm dev` | Start development server |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type check all packages |

### Package: @blog/core

| Script | Description |
|--------|-------------|
| `pnpm test` | Run unit tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm build` | Build package |

### Package: @blog/renderer

| Script | Description |
|--------|-------------|
| `pnpm build` | Build Lambda with esbuild |
| `pnpm test` | Run unit + integration tests |
| `pnpm deploy` | Deploy Lambda to AWS |

### Package: @blog/site

| Script | Description |
|--------|-------------|
| `pnpm test:e2e` | Run Playwright tests |
| `pnpm build` | Build static assets |

### Package: @blog/infra

| Script | Description |
|--------|-------------|
| `pnpm cdk synth` | Synthesize CloudFormation |
| `pnpm cdk diff` | Preview changes |
| `pnpm cdk deploy` | Deploy infrastructure |

## Common Tasks

### Add a New Dependency

```bash
# To a specific package
pnpm --filter @blog/core add lodash

# Dev dependency
pnpm --filter @blog/core add -D @types/lodash

# To root (tooling)
pnpm add -w -D vitest
```

### Create a New Lambda Handler

1. Add handler in `packages/renderer/src/handlers/`
2. Add tests in `packages/renderer/tests/`
3. Register in CDK stack (`packages/infra/lib/`)
4. Add event mapping in SAM template (for local testing)

### Debug CloudWatch Logs

```bash
# View recent logs
aws logs tail /aws/lambda/blog-render --follow

# Filter errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/blog-render \
  --filter-pattern "ERROR"
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Repository                        │
│                    (posts/ folder with markdown)                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │ Push Event
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway                               │
│                    (Webhook endpoint)                            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Render Lambda                                │
│  • Fetch changed files from Git                                  │
│  • Parse markdown + front matter                                 │
│  • Resolve cross-links                                           │
│  • Generate HTML                                                 │
│  • Store in S3                                                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        S3 Bucket                                 │
│              (Rendered HTML + assets)                            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       CloudFront CDN                             │
│                    (Cached at edge)                              │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
                         [ Readers ]
```

## Troubleshooting

### Tests Failing

```bash
# Clear test cache
pnpm test --clearCache

# Run specific test file
pnpm --filter @blog/core test src/services/parser.test.ts
```

### Lambda Cold Starts Slow

1. Check bundle size: `ls -la packages/renderer/dist/`
2. Target: <250KB
3. Ensure `@aws-sdk/*` is in externals

### CloudFront Not Updating

```bash
# Invalidate cache manually
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/*"
```

### Webhook Not Triggering

1. Check GitHub webhook delivery logs
2. Verify `GITHUB_WEBHOOK_SECRET` matches
3. Check CloudWatch logs for Lambda errors
