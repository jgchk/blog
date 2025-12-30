import * as esbuild from 'esbuild';

// Build pipeline CLI
// Per 007-pipeline-rendering: Lambda handlers have been removed.
// The pipeline CLI is the only entry point needed.
await esbuild.build({
  entryPoints: ['src/pipeline.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/pipeline.mjs',
  minify: false, // Keep readable for debugging
  sourcemap: true,
  external: ['@aws-sdk/*'],
  banner: {
    js: `
      import { createRequire } from 'module';
      const require = createRequire(import.meta.url);
    `,
  },
});

console.log('Build complete: dist/pipeline.mjs');
