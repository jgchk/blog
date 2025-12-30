#!/usr/bin/env npx tsx
/**
 * Performance Benchmark Script
 *
 * Generates 500 synthetic posts to measure render time against the 10-minute target (FR-009).
 *
 * Usage:
 *   npx tsx packages/renderer/scripts/generate-benchmark-posts.ts [--generate] [--cleanup] [--run]
 *
 * Options:
 *   --generate  Create synthetic posts in ./benchmark-posts/
 *   --cleanup   Remove the benchmark-posts directory
 *   --run       Generate, render, and report timing (default behavior with no args)
 */

import { mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const BENCHMARK_DIR = './benchmark-posts';
const OUTPUT_DIR = './benchmark-rendered';
const POST_COUNT = 500;
const WORDS_PER_POST = 500;
const TARGET_RENDER_TIME_MS = 10 * 60 * 1000; // 10 minutes

// Lorem ipsum text for generating post content
const LOREM_IPSUM = `Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur Excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum`.split(
  ' '
);

function generateLoremIpsum(wordCount: number): string {
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    words.push(LOREM_IPSUM[i % LOREM_IPSUM.length] ?? 'lorem');
  }

  // Split into paragraphs of ~50-100 words
  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];

  for (const word of words) {
    currentParagraph.push(word);
    if (currentParagraph.length >= 50 + Math.random() * 50) {
      paragraphs.push(currentParagraph.join(' '));
      currentParagraph = [];
    }
  }

  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join(' '));
  }

  return paragraphs.join('\n\n');
}

function generatePost(index: number): { slug: string; content: string } {
  const slug = `benchmark-post-${String(index).padStart(4, '0')}`;
  const tags = ['benchmark', `batch-${Math.floor(index / 100)}`];
  if (index % 3 === 0) tags.push('performance');
  if (index % 5 === 0) tags.push('testing');

  const date = new Date(2024, 0, 1 + (index % 365));
  const dateStr = date.toISOString().split('T')[0];

  const content = `---
title: Benchmark Post ${index}
date: ${dateStr}
tags:
  - ${tags.join('\n  - ')}
---

# Benchmark Post ${index}

This is a synthetic post generated for performance benchmarking.

${generateLoremIpsum(WORDS_PER_POST)}
`;

  return { slug, content };
}

async function generatePosts(): Promise<void> {
  console.log(`Generating ${POST_COUNT} synthetic posts...`);

  // Clean up existing benchmark posts
  if (existsSync(BENCHMARK_DIR)) {
    await rm(BENCHMARK_DIR, { recursive: true });
  }

  await mkdir(BENCHMARK_DIR, { recursive: true });

  const startTime = Date.now();

  for (let i = 0; i < POST_COUNT; i++) {
    const { slug, content } = generatePost(i);
    const postDir = join(BENCHMARK_DIR, slug);
    await mkdir(postDir, { recursive: true });
    await writeFile(join(postDir, 'index.md'), content);

    if ((i + 1) % 100 === 0) {
      console.log(`  Generated ${i + 1}/${POST_COUNT} posts`);
    }
  }

  const duration = Date.now() - startTime;
  console.log(`Generated ${POST_COUNT} posts in ${duration}ms`);
}

async function cleanup(): Promise<void> {
  console.log('Cleaning up benchmark directories...');

  if (existsSync(BENCHMARK_DIR)) {
    await rm(BENCHMARK_DIR, { recursive: true });
    console.log(`  Removed ${BENCHMARK_DIR}`);
  }

  if (existsSync(OUTPUT_DIR)) {
    await rm(OUTPUT_DIR, { recursive: true });
    console.log(`  Removed ${OUTPUT_DIR}`);
  }

  console.log('Cleanup complete');
}

async function runBenchmark(): Promise<void> {
  // Ensure posts exist
  if (!existsSync(BENCHMARK_DIR)) {
    await generatePosts();
  } else {
    const entries = await readdir(BENCHMARK_DIR);
    console.log(`Using existing ${entries.length} benchmark posts`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Running Pipeline Benchmark');
  console.log('='.repeat(60));

  const startTime = Date.now();

  // Run the pipeline renderer
  const result = await new Promise<{ exitCode: number; output: string }>(
    (resolve) => {
      const proc = spawn(
        'node',
        ['packages/renderer/dist/pipeline.mjs'],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            POSTS_DIR: BENCHMARK_DIR,
            OUTPUT_DIR: OUTPUT_DIR,
            TEMPLATES_DIR: './packages/site/src/templates',
          },
          stdio: ['inherit', 'pipe', 'pipe'],
        }
      );

      let output = '';
      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        process.stdout.write(text);
      });
      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        process.stderr.write(text);
      });

      proc.on('close', (code) => {
        resolve({ exitCode: code ?? 1, output });
      });
    }
  );

  const duration = Date.now() - startTime;

  console.log('\n' + '='.repeat(60));
  console.log('Benchmark Results');
  console.log('='.repeat(60));
  console.log(`Total time: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
  console.log(`Target: ${TARGET_RENDER_TIME_MS}ms (${TARGET_RENDER_TIME_MS / 1000 / 60} minutes)`);
  console.log(`Posts per second: ${((POST_COUNT / duration) * 1000).toFixed(2)}`);

  const percentOfTarget = ((duration / TARGET_RENDER_TIME_MS) * 100).toFixed(2);
  console.log(`Percent of target: ${percentOfTarget}%`);

  if (duration > TARGET_RENDER_TIME_MS) {
    console.log(`\nWARNING: Render time exceeds 10-minute target!`);
    process.exit(1);
  } else {
    console.log(`\nPASS: Render time within 10-minute target`);
    console.log(`Headroom: ${((TARGET_RENDER_TIME_MS - duration) / 1000 / 60).toFixed(2)} minutes`);
  }

  if (result.exitCode !== 0) {
    console.log(`\nWARNING: Pipeline exited with code ${result.exitCode}`);
    process.exit(result.exitCode);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--generate')) {
    await generatePosts();
  } else if (args.includes('--cleanup')) {
    await cleanup();
  } else {
    // Default: run full benchmark
    await runBenchmark();
    // Clean up after successful run
    console.log('\nCleaning up benchmark data...');
    await cleanup();
  }
}

main().catch((error) => {
  console.error('Benchmark error:', error);
  process.exit(1);
});
