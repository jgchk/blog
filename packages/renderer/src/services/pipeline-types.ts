import type { Article } from '@blog/core';
import type { TagIndex } from '@blog/core';

/**
 * Result of rendering a single post for the pipeline.
 * Per data-model.md specification.
 */
export interface PipelineRenderResult {
  /** Post slug */
  slug: string;
  /** Whether rendering succeeded */
  success: boolean;
  /** Output path for HTML file */
  htmlPath: string;
  /** Output paths for copied assets */
  assetPaths: string[];
  /** Error if rendering failed */
  error?: Error;
  /** Render time in milliseconds */
  duration: number;
}

/**
 * Configuration and state for a pipeline render run.
 * Per data-model.md specification.
 */
export interface PipelineContext {
  /** Source posts directory (default: ./posts) */
  postsDir: string;
  /** Local render output directory (default: ./rendered) */
  outputDir: string;
  /** Target S3 bucket (for CI/CD deployment) */
  s3Bucket?: string;
  /** CloudFront distribution ID (for cache invalidation) */
  cloudfrontId?: string;
  /** Templates directory (default: packages/site/src/templates) */
  templatesDir: string;

  /** Pipeline start timestamp */
  startTime: Date;
  /** All parsed articles */
  articles: Article[];
  /** Render results per post */
  results: PipelineRenderResult[];
  /** Built tag index */
  tagIndex: TagIndex | null;

  /** Metrics */
  totalPosts: number;
  renderedPosts: number;
  failedPosts: number;
  totalAssets: number;
}

/**
 * Final output of pipeline execution.
 * Per data-model.md specification.
 */
export interface PipelineOutput {
  /** Overall success (true if no failures) */
  success: boolean;
  /** Total execution time in milliseconds */
  duration: number;
  /** Number of successfully rendered posts */
  postsRendered: number;
  /** Number of failed posts (should be 0 on success) */
  postsFailed: number;
  /** Total assets copied */
  assetsUploaded: number;
  /** Number of tag pages generated */
  tagPagesGenerated: number;
  /** CloudFront invalidation ID (if applicable) */
  invalidationId: string | null;
  /** Error details for failed posts */
  errors: Array<{
    slug: string;
    message: string;
  }>;
}

/**
 * Options for initializing PipelineRenderer.
 */
export interface PipelineOptions {
  /** Source posts directory (default: ./posts) */
  postsDir?: string;
  /** Local render output directory (default: ./rendered) */
  outputDir?: string;
  /** Templates directory (default: packages/site/src/templates) */
  templatesDir?: string;
  /** S3 bucket for deployment */
  s3Bucket?: string;
  /** CloudFront distribution ID */
  cloudfrontId?: string;
  /** Logger function (default: console.log) */
  logger?: (message: string) => void;
}

/**
 * Pipeline execution state for progress tracking.
 */
export type PipelineState =
  | 'INIT'
  | 'READING'
  | 'RENDERING'
  | 'UPLOADING'
  | 'INVALIDATING'
  | 'COMPLETE'
  | 'FAILED';
