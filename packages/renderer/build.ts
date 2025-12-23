import * as esbuild from 'esbuild';

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
