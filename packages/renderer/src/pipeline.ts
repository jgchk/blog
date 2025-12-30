#!/usr/bin/env node
import { PipelineRenderer } from './services/pipeline-renderer.js';

/**
 * Pipeline CLI entry point.
 * Renders all posts, tag pages, and home page to local filesystem.
 *
 * Usage:
 *   pnpm --filter @blog/renderer render:pipeline [--output <dir>]
 *
 * Environment variables:
 *   POSTS_DIR - Source posts directory (default: ./posts)
 *   OUTPUT_DIR - Output directory (default: ./rendered)
 *   TEMPLATES_DIR - Templates directory (default: ./packages/site/src/templates)
 *   SITE_DIR - Site assets directory for fonts/styles (default: ./packages/site/src)
 */
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Pipeline Renderer');
  console.log('='.repeat(60));

  // Parse command line arguments
  const args = process.argv.slice(2);
  let outputDir = process.env.OUTPUT_DIR ?? './rendered';

  for (let i = 0; i < args.length; i++) {
    const nextArg = args[i + 1];
    if (args[i] === '--output' && nextArg) {
      outputDir = nextArg;
      i++;
    }
  }

  const postsDir = process.env.POSTS_DIR ?? './posts';
  const templatesDir = process.env.TEMPLATES_DIR ?? './packages/site/src/templates';
  const siteDir = process.env.SITE_DIR ?? './packages/site/src';

  console.log(`Posts directory: ${postsDir}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Templates directory: ${templatesDir}`);
  console.log(`Site directory: ${siteDir}`);
  console.log('='.repeat(60));

  const renderer = new PipelineRenderer({
    postsDir,
    outputDir,
    templatesDir,
    siteDir,
  });

  const result = await renderer.execute();

  console.log('='.repeat(60));
  console.log('Pipeline Summary');
  console.log('='.repeat(60));
  console.log(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Duration: ${result.duration}ms`);
  console.log(`Posts rendered: ${result.postsRendered}`);
  console.log(`Posts failed: ${result.postsFailed}`);
  console.log(`Assets copied: ${result.assetsUploaded}`);
  console.log(`Tag pages: ${result.tagPagesGenerated}`);

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    for (const error of result.errors) {
      console.log(`  - ${error.slug}: ${error.message}`);
    }
  }

  console.log('='.repeat(60));

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
