import * as esbuild from 'esbuild';

// Build Lambda handler
await esbuild.build({
  entryPoints: ['src/handlers/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/handler.mjs',
  minify: true,
  sourcemap: true,
  external: ['@aws-sdk/*'],
  banner: {
    js: `
      import { createRequire } from 'module';
      const require = createRequire(import.meta.url);
    `,
  },
});

console.log('Build complete: dist/handler.mjs');

// Build pipeline CLI
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
