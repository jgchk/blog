# Research: Lightweight Markdown Blog

**Date**: 2025-12-23
**Status**: Complete
**Purpose**: Resolve NEEDS CLARIFICATION items from Technical Context

---

## 1. Language & Runtime

### Decision: TypeScript 5.3+ with ES2022 target on AWS Lambda Node.js 20.x

### Rationale
- TypeScript provides type safety that catches errors at compile time, reducing runtime bugs
- Lambda Node.js 20.x fully supports ES2022 features (top-level await, class fields, logical assignment)
- TypeScript's ecosystem has mature tooling for both Lambda and frontend development
- Aligns with "isomorphism" goal—same language for core logic, Lambda handlers, and frontend templates

### Alternatives Considered
- **Go**: Faster cold starts (~50-100ms vs 200-400ms), but less ecosystem for markdown processing; smaller community for web templating
- **Python**: Strong markdown libraries, but slower cold starts and less type safety
- **Rust**: Best performance, but steep learning curve and limited serverless tooling violates Minimal Complexity principle

### Configuration
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true
  }
}
```

---

## 2. Build Tooling

### Decision: esbuild for Lambda bundling

### Rationale
- 10-100x faster than webpack/tsc (sub-second builds enable rapid TDD iteration)
- Produces optimized single-file bundles with tree-shaking
- Native TypeScript support without additional loaders
- Minimal configuration aligns with Minimal Complexity principle

### Alternatives Considered
- **webpack**: More mature but requires significant configuration (30+ lines); overkill for Lambda's single-entry-point pattern
- **tsc alone**: Only transpiles, doesn't bundle; requires deploying node_modules (larger packages, slower cold starts)
- **SWC**: Fast but less mature ecosystem; esbuild is more widely adopted for Lambda

### Build Configuration
```typescript
// build.ts
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/handler.mjs',
  minify: true,
  sourcemap: true,
  external: ['@aws-sdk/*'] // AWS SDK v3 in Lambda runtime
});
```

---

## 3. Markdown Parser

### Decision: remark (unified ecosystem)

### Rationale
- **Extensible plugin architecture**: 200+ plugins available; custom wikilink plugin straightforward to implement
- **AST-based processing**: Enables precise transformations and comprehensive testing
- **Excellent TypeScript support**: Well-maintained type definitions
- **Ecosystem**: Used by Gatsby, Astro—battle-tested in production blogs

### Alternatives Considered
- **marked**: 2-3x faster, smaller bundle (~20KB), but lacks plugin ecosystem for wikilinks; requires post-processing for `[[link]]` syntax
- **markdown-it**: Good plugin ecosystem but weaker TypeScript support; configuration more complex than remark
- **micromark**: Low-level foundation for remark; requires more code for high-level features

### Pipeline Architecture
```typescript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import { remarkWikilinks } from './plugins/wikilinks';

const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkGfm)
  .use(remarkWikilinks)
  .use(remarkRehype)
  .use(rehypeHighlight)
  .use(rehypeStringify);
```

---

## 4. Front Matter Library

### Decision: gray-matter

### Rationale
- **De facto standard**: Used by Next.js, Astro, Eleventy
- **Simple API**: `matter(content)` → `{ data, content }`, zero configuration
- **Battle-tested**: 8+ years production use, handles edge cases (multiple formats, excerpts)
- **Lightweight**: ~10KB, no heavy dependencies

### Alternatives Considered
- **remark-frontmatter + remark-extract-frontmatter**: Can parse within remark pipeline, but adds complexity; gray-matter is simpler
- **js-yaml direct**: Would require implementing delimiter detection ourselves

---

## 5. Wikilink Handling

### Decision: Custom remark plugin

### Rationale
- **Testability**: Remark plugins are pure functions on AST—easy to unit test
- **Error reporting**: Can collect broken links and surface in admin dashboard (FR-013)
- **Maintainability**: Self-contained logic (~50-100 lines)

### Implementation Approach
```typescript
import { visit } from 'unist-util-visit';

export const remarkWikilinks = (options: { articles: ArticleIndex }) => {
  return (tree: Node, file: VFile) => {
    visit(tree, 'text', (node, index, parent) => {
      // Match [[Title or Alias]]
      // Normalize: lowercase, trim, space ≈ dash ≈ underscore
      // Resolve against articles index
      // Replace with link node or mark broken
    });
  };
};
```

---

## 6. Testing Framework

### Decision: Vitest (unit/integration) + Playwright (E2E)

### Rationale

**Vitest for Unit/Integration:**
- 2-10x faster than Jest for TypeScript projects (native ESM, Vite pipeline)
- First-class TypeScript support without ts-jest configuration
- Jest-compatible APIs (describe, it, expect)—minimal learning curve
- Excellent watch mode for TDD workflow

**Playwright for E2E:**
- Written in TypeScript with excellent type definitions
- Auto-waiting eliminates flaky tests
- Cross-browser testing (Chromium, Firefox, WebKit) in parallel
- Built-in accessibility testing for WCAG 2.1 AA validation
- Trace viewer for visual debugging

### Alternatives Considered
- **Jest**: Requires ts-jest configuration; slower than Vitest
- **Cypress**: Single-tab limitation; runs inside browser (network control limitations); slower

### Testing Pyramid
| Level | Tool | Coverage |
|-------|------|----------|
| Unit | Vitest | Business logic, markdown parsing, cross-link resolution |
| Integration | Vitest + aws-sdk-client-mock | Lambda handlers with mocked AWS services |
| E2E | Playwright | Critical user journeys (publish, navigate, read) |

---

## 7. AWS Architecture

### Decision: Serverless event-driven with abstraction layer

### Components
1. **Git Integration**: GitHub webhook → API Gateway → Lambda
2. **Rendering Pipeline**: Lambda (render) → S3 (storage)
3. **CDN**: CloudFront → S3 origin
4. **Alerting**: Lambda → SNS → Email/Dashboard
5. **Admin**: API Gateway + IAM → Admin Lambda

### Abstraction Strategy (Portability)
```typescript
// packages/core/src/interfaces/storage.ts
export interface StorageAdapter {
  read(key: string): Promise<Buffer>;
  write(key: string, content: Buffer): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

// packages/renderer/src/adapters/s3-storage.ts
export class S3StorageAdapter implements StorageAdapter {
  // AWS S3 implementation
}

// packages/core/src/interfaces/notification.ts
export interface NotificationAdapter {
  send(message: NotificationMessage): Promise<void>;
}
```

### IaC Decision: AWS CDK

### Rationale
- TypeScript-native (consistent with codebase)
- Higher-level constructs than SAM reduce boilerplate
- Better for complex multi-service architectures
- Testing with CDK assertions

### Alternatives Considered
- **SAM**: Simpler for basic Lambda setups, but limited for complex architectures
- **Terraform**: More portable across clouds but requires learning HCL; adds cognitive overhead

### Caching Strategy
1. **CloudFront caching**: Pre-rendered HTML cached at edge (TTL: 1 day for articles, 1 hour for index pages)
2. **Cache invalidation**: On Git push, invalidate changed article paths only
3. **S3 versioning**: Optional for rollback capability

---

## 8. Package Manager & Monorepo

### Decision: pnpm with workspaces

### Rationale
- Disk-efficient (hard links, not copies)
- Strict dependency resolution (avoids phantom dependencies)
- Built-in workspace support (no Lerna/Nx overhead)
- Fast install times

### Workspace Structure
```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
```

---

## Dependency Summary

### Production Dependencies
```json
{
  "unified": "^11.0.4",
  "remark-parse": "^11.0.0",
  "remark-frontmatter": "^5.0.0",
  "remark-gfm": "^4.0.0",
  "remark-rehype": "^11.0.0",
  "rehype-highlight": "^7.0.0",
  "rehype-stringify": "^10.0.0",
  "gray-matter": "^4.0.3",
  "unist-util-visit": "^5.0.0"
}
```

### Dev Dependencies
```json
{
  "typescript": "^5.3.0",
  "esbuild": "^0.20.0",
  "vitest": "^1.0.0",
  "@playwright/test": "^1.40.0",
  "aws-sdk-client-mock": "^3.0.0",
  "aws-cdk-lib": "^2.120.0"
}
```

---

## Constitution Alignment Summary

| Principle | How Research Supports It |
|-----------|-------------------------|
| I. Author Simplicity | Git push triggers automated pipeline; gray-matter extracts front matter |
| II. Reader Simplicity | remark produces semantic HTML; Playwright tests WCAG compliance |
| III. Test Confidence | Vitest enables fast TDD; Playwright validates user journeys |
| IV. Minimal Complexity | esbuild (vs webpack), pnpm (vs Lerna), gray-matter (vs custom parsing) |
| V. Incremental Development | Package separation enables independent deployment |
