import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RenderService } from '../../src/services/render-service.js';
import type { StorageAdapter } from '@blog/core';

/**
 * Integration tests for image/asset path resolution.
 * Per T093: Verify edge cases like spaces in filenames, subdirectories.
 */
describe('Asset Path Resolution', () => {
  let mockStorage: StorageAdapter;
  let mockSourceStorage: StorageAdapter;
  let renderService: RenderService;

  beforeEach(() => {
    mockStorage = {
      read: vi.fn(),
      write: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
      list: vi.fn(),
      exists: vi.fn(),
    };

    mockSourceStorage = {
      read: vi.fn().mockResolvedValue(Buffer.from('test content')),
      write: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      exists: vi.fn(),
    };

    renderService = new RenderService(mockStorage, {
      sourceStorage: mockSourceStorage,
    });
  });

  describe('copyAssets', () => {
    it('copies simple image files', async () => {
      vi.mocked(mockSourceStorage.list).mockResolvedValue([
        'posts/my-post/index.md',
        'posts/my-post/image.png',
      ]);

      const result = await renderService.copyAssets('my-post');

      expect(result.copied).toContain('image.png');
      expect(mockStorage.write).toHaveBeenCalledWith(
        'articles/my-post/image.png',
        expect.any(Buffer),
        'image/png'
      );
    });

    it('handles spaces in filenames', async () => {
      vi.mocked(mockSourceStorage.list).mockResolvedValue([
        'posts/my-post/index.md',
        'posts/my-post/my image.png',
        'posts/my-post/screenshot 2024.jpg',
      ]);

      const result = await renderService.copyAssets('my-post');

      expect(result.copied).toContain('my image.png');
      expect(result.copied).toContain('screenshot 2024.jpg');
      expect(mockStorage.write).toHaveBeenCalledWith(
        'articles/my-post/my image.png',
        expect.any(Buffer),
        'image/png'
      );
    });

    it('handles subdirectories within post folder', async () => {
      vi.mocked(mockSourceStorage.list).mockResolvedValue([
        'posts/my-post/index.md',
        'posts/my-post/images/photo.jpg',
        'posts/my-post/assets/diagram.svg',
      ]);

      const result = await renderService.copyAssets('my-post');

      expect(result.copied).toContain('images/photo.jpg');
      expect(result.copied).toContain('assets/diagram.svg');
      expect(mockStorage.write).toHaveBeenCalledWith(
        'articles/my-post/images/photo.jpg',
        expect.any(Buffer),
        'image/jpeg'
      );
      expect(mockStorage.write).toHaveBeenCalledWith(
        'articles/my-post/assets/diagram.svg',
        expect.any(Buffer),
        'image/svg+xml'
      );
    });

    it('handles special characters in filenames', async () => {
      vi.mocked(mockSourceStorage.list).mockResolvedValue([
        'posts/my-post/index.md',
        'posts/my-post/image-v2.png',
        'posts/my-post/photo_final.jpg',
        'posts/my-post/diagram (1).png',
      ]);

      const result = await renderService.copyAssets('my-post');

      expect(result.copied).toContain('image-v2.png');
      expect(result.copied).toContain('photo_final.jpg');
      expect(result.copied).toContain('diagram (1).png');
    });

    it('correctly determines content types', async () => {
      vi.mocked(mockSourceStorage.list).mockResolvedValue([
        'posts/my-post/index.md',
        'posts/my-post/photo.jpg',
        'posts/my-post/photo.jpeg',
        'posts/my-post/image.png',
        'posts/my-post/animation.gif',
        'posts/my-post/modern.webp',
        'posts/my-post/diagram.svg',
        'posts/my-post/document.pdf',
        'posts/my-post/data.json',
      ]);

      await renderService.copyAssets('my-post');

      expect(mockStorage.write).toHaveBeenCalledWith(
        expect.stringContaining('.jpg'),
        expect.any(Buffer),
        'image/jpeg'
      );
      expect(mockStorage.write).toHaveBeenCalledWith(
        expect.stringContaining('.jpeg'),
        expect.any(Buffer),
        'image/jpeg'
      );
      expect(mockStorage.write).toHaveBeenCalledWith(
        expect.stringContaining('.png'),
        expect.any(Buffer),
        'image/png'
      );
      expect(mockStorage.write).toHaveBeenCalledWith(
        expect.stringContaining('.gif'),
        expect.any(Buffer),
        'image/gif'
      );
      expect(mockStorage.write).toHaveBeenCalledWith(
        expect.stringContaining('.webp'),
        expect.any(Buffer),
        'image/webp'
      );
      expect(mockStorage.write).toHaveBeenCalledWith(
        expect.stringContaining('.svg'),
        expect.any(Buffer),
        'image/svg+xml'
      );
      expect(mockStorage.write).toHaveBeenCalledWith(
        expect.stringContaining('.pdf'),
        expect.any(Buffer),
        'application/pdf'
      );
      expect(mockStorage.write).toHaveBeenCalledWith(
        expect.stringContaining('.json'),
        expect.any(Buffer),
        'application/json'
      );
    });

    it('uses octet-stream for unknown extensions', async () => {
      vi.mocked(mockSourceStorage.list).mockResolvedValue([
        'posts/my-post/index.md',
        'posts/my-post/data.xyz',
      ]);

      await renderService.copyAssets('my-post');

      expect(mockStorage.write).toHaveBeenCalledWith(
        'articles/my-post/data.xyz',
        expect.any(Buffer),
        'application/octet-stream'
      );
    });

    it('skips markdown files', async () => {
      vi.mocked(mockSourceStorage.list).mockResolvedValue([
        'posts/my-post/index.md',
        'posts/my-post/notes.md',
        'posts/my-post/draft.md',
        'posts/my-post/image.png',
      ]);

      const result = await renderService.copyAssets('my-post');

      expect(result.copied).not.toContain('index.md');
      expect(result.copied).not.toContain('notes.md');
      expect(result.copied).not.toContain('draft.md');
      expect(result.copied).toContain('image.png');
    });

    it('handles nested subdirectories', async () => {
      vi.mocked(mockSourceStorage.list).mockResolvedValue([
        'posts/my-post/index.md',
        'posts/my-post/images/2024/january/photo.jpg',
        'posts/my-post/assets/icons/logo.svg',
      ]);

      const result = await renderService.copyAssets('my-post');

      expect(result.copied).toContain('images/2024/january/photo.jpg');
      expect(result.copied).toContain('assets/icons/logo.svg');
      expect(mockStorage.write).toHaveBeenCalledWith(
        'articles/my-post/images/2024/january/photo.jpg',
        expect.any(Buffer),
        'image/jpeg'
      );
    });

    it('returns empty result when no source storage', async () => {
      const serviceWithoutSource = new RenderService(mockStorage);

      const result = await serviceWithoutSource.copyAssets('my-post');

      expect(result.copied).toEqual([]);
      expect(result.failed).toEqual([]);
    });

    it('handles read errors gracefully', async () => {
      vi.mocked(mockSourceStorage.list).mockResolvedValue([
        'posts/my-post/index.md',
        'posts/my-post/good.png',
        'posts/my-post/bad.png',
      ]);

      vi.mocked(mockSourceStorage.read)
        .mockResolvedValueOnce(Buffer.from('good'))
        .mockRejectedValueOnce(new Error('Read failed'));

      const result = await renderService.copyAssets('my-post');

      expect(result.copied).toContain('good.png');
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].path).toBe('bad.png');
      expect(result.failed[0].error).toBe('Read failed');
    });

    it('handles write errors gracefully', async () => {
      vi.mocked(mockSourceStorage.list).mockResolvedValue([
        'posts/my-post/index.md',
        'posts/my-post/image.png',
      ]);

      vi.mocked(mockStorage.write).mockRejectedValue(new Error('Write failed'));

      const result = await renderService.copyAssets('my-post');

      expect(result.copied).toEqual([]);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toBe('Write failed');
    });

    it('handles list errors gracefully', async () => {
      vi.mocked(mockSourceStorage.list).mockRejectedValue(new Error('List failed'));

      const result = await renderService.copyAssets('my-post');

      // Should return empty result, not throw
      expect(result.copied).toEqual([]);
      expect(result.failed).toEqual([]);
    });

    it('handles empty post folders', async () => {
      vi.mocked(mockSourceStorage.list).mockResolvedValue([
        'posts/my-post/index.md',
      ]);

      const result = await renderService.copyAssets('my-post');

      expect(result.copied).toEqual([]);
      expect(result.failed).toEqual([]);
    });
  });
});
