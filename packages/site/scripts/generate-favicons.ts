#!/usr/bin/env npx tsx
/**
 * Favicon Generation Script
 *
 * Generates multiple favicon sizes from a source image using sharp.
 *
 * Usage:
 *   npx tsx packages/site/scripts/generate-favicons.ts [source-image]
 *
 * Default source: packages/site/src/images/creation-of-the-birds-remedios-varo-square.png
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = join(__dirname, '..');
const IMAGES_DIR = join(SITE_ROOT, 'src/images');
const FAVICONS_DIR = join(SITE_ROOT, 'src/favicons');

// Favicon sizes to generate
const FAVICON_SIZES = [
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 48, name: 'favicon-48x48.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 192, name: 'android-chrome-192x192.png' },
  { size: 512, name: 'android-chrome-512x512.png' },
];

async function generateFavicons(sourcePath: string): Promise<void> {
  console.log(`Generating favicons from: ${sourcePath}`);

  if (!existsSync(sourcePath)) {
    console.error(`Source image not found: ${sourcePath}`);
    process.exit(1);
  }

  // Ensure output directory exists
  if (!existsSync(FAVICONS_DIR)) {
    await mkdir(FAVICONS_DIR, { recursive: true });
  }

  const sourceImage = sharp(sourcePath);
  const metadata = await sourceImage.metadata();

  console.log(`Source image: ${metadata.width}x${metadata.height}`);

  for (const { size, name } of FAVICON_SIZES) {
    const outputPath = join(FAVICONS_DIR, name);

    await sharp(sourcePath)
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
      })
      .png({
        quality: 100,
        compressionLevel: 9,
      })
      .toFile(outputPath);

    console.log(`  Generated ${name} (${size}x${size})`);
  }

  // Generate ICO file (multi-resolution)
  // ICO contains 16x16, 32x32, and 48x48
  const icoPath = join(FAVICONS_DIR, 'favicon.ico');
  const ico16 = await sharp(sourcePath).resize(16, 16).png().toBuffer();
  const ico32 = await sharp(sourcePath).resize(32, 32).png().toBuffer();
  const ico48 = await sharp(sourcePath).resize(48, 48).png().toBuffer();

  // Create ICO file manually (ICO format)
  const icoBuffer = createIco([ico16, ico32, ico48], [16, 32, 48]);
  await writeFile(icoPath, icoBuffer);
  console.log(`  Generated favicon.ico (16x16, 32x32, 48x48)`);

  console.log('\nFavicon generation complete!');
  console.log('\nAdd these to your HTML <head>:');
  console.log(`
  <link rel="icon" type="image/x-icon" href="/assets/favicons/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicons/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/assets/favicons/favicon-16x16.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/favicons/apple-touch-icon.png">
`);
}

/**
 * Create an ICO file from multiple PNG buffers.
 * ICO format: https://en.wikipedia.org/wiki/ICO_(file_format)
 */
function createIco(pngBuffers: Buffer[], sizes: number[]): Buffer {
  const numImages = pngBuffers.length;

  // ICO Header: 6 bytes
  // - 2 bytes: Reserved (0)
  // - 2 bytes: Image type (1 = ICO)
  // - 2 bytes: Number of images
  const headerSize = 6;

  // Directory entry: 16 bytes per image
  // - 1 byte: Width (0 = 256)
  // - 1 byte: Height (0 = 256)
  // - 1 byte: Color palette size
  // - 1 byte: Reserved
  // - 2 bytes: Color planes
  // - 2 bytes: Bits per pixel
  // - 4 bytes: Image data size
  // - 4 bytes: Image data offset
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * numImages;

  // Calculate offsets
  let dataOffset = headerSize + dirSize;
  const offsets: number[] = [];
  for (const buffer of pngBuffers) {
    offsets.push(dataOffset);
    dataOffset += buffer.length;
  }

  // Total size
  const totalSize = dataOffset;
  const icoBuffer = Buffer.alloc(totalSize);

  // Write header
  icoBuffer.writeUInt16LE(0, 0); // Reserved
  icoBuffer.writeUInt16LE(1, 2); // Type: ICO
  icoBuffer.writeUInt16LE(numImages, 4); // Number of images

  // Write directory entries
  for (let i = 0; i < numImages; i++) {
    const entryOffset = headerSize + i * dirEntrySize;
    const size = sizes[i]!;
    const buffer = pngBuffers[i]!;

    icoBuffer.writeUInt8(size < 256 ? size : 0, entryOffset); // Width
    icoBuffer.writeUInt8(size < 256 ? size : 0, entryOffset + 1); // Height
    icoBuffer.writeUInt8(0, entryOffset + 2); // Color palette
    icoBuffer.writeUInt8(0, entryOffset + 3); // Reserved
    icoBuffer.writeUInt16LE(1, entryOffset + 4); // Color planes
    icoBuffer.writeUInt16LE(32, entryOffset + 6); // Bits per pixel
    icoBuffer.writeUInt32LE(buffer.length, entryOffset + 8); // Image size
    icoBuffer.writeUInt32LE(offsets[i]!, entryOffset + 12); // Image offset
  }

  // Write image data
  for (let i = 0; i < numImages; i++) {
    pngBuffers[i]!.copy(icoBuffer, offsets[i]!);
  }

  return icoBuffer;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Default source image
  const defaultSource = join(
    IMAGES_DIR,
    'creation-of-the-birds-remedios-varo-square.png'
  );

  const sourcePath = args[0] || defaultSource;

  await generateFavicons(sourcePath);
}

main().catch((error) => {
  console.error('Error generating favicons:', error);
  process.exit(1);
});
