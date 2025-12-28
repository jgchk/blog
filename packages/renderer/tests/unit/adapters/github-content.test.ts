import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubContentFetcher } from '../../../src/adapters/github-content.js';
import type { RepositoryRef, FetchOptions } from '../../../src/adapters/github-content.js';

describe('GitHubContentFetcher', () => {
  let fetcher: GitHubContentFetcher;
  const mockRepo: RepositoryRef = {
    owner: 'test-owner',
    name: 'test-repo',
    ref: 'main',
  };

  beforeEach(() => {
    fetcher = new GitHubContentFetcher();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('fetchFile', () => {
    it('should fetch a file successfully', async () => {
      const content = '# Hello World\n\nThis is a test.';
      const mockResponse = new Response(content, {
        status: 200,
        headers: { 'Content-Length': content.length.toString() },
      });
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      const result = await fetcher.fetchFile(mockRepo, 'posts/hello-world/index.md');

      expect(result).not.toBeNull();
      expect(result!.path).toBe('posts/hello-world/index.md');
      expect(result!.content.toString()).toBe(content);
      expect(result!.size).toBe(content.length);
      expect(fetch).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/test-owner/test-repo/main/posts/hello-world/index.md',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should return null for 404 response', async () => {
      const mockResponse = new Response('Not Found', { status: 404 });
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      const result = await fetcher.fetchFile(mockRepo, 'posts/nonexistent/index.md');

      expect(result).toBeNull();
    });

    it('should throw error for other non-2xx responses', async () => {
      const mockResponse = new Response('Server Error', { status: 500 });
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      await expect(fetcher.fetchFile(mockRepo, 'posts/test/index.md')).rejects.toThrow(
        'Failed to fetch file'
      );
    });

    it('should handle binary content', async () => {
      const binaryContent = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
      const mockResponse = new Response(binaryContent, {
        status: 200,
        headers: { 'Content-Length': binaryContent.length.toString() },
      });
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      const result = await fetcher.fetchFile(mockRepo, 'posts/test/image.png');

      expect(result).not.toBeNull();
      expect(result!.content).toBeInstanceOf(Buffer);
      expect(result!.content[0]).toBe(0x89);
    });

    it('should respect timeout option', async () => {
      const mockResponse = new Response('test', { status: 200 });
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      const options: FetchOptions = { timeout: 5000 };
      await fetcher.fetchFile(mockRepo, 'test.md', options);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should reject files exceeding maxSize', async () => {
      const largeContent = 'x'.repeat(1024 * 1024 * 15); // 15MB
      const mockResponse = new Response(largeContent, {
        status: 200,
        headers: { 'Content-Length': largeContent.length.toString() },
      });
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      const options: FetchOptions = { maxSize: 10 * 1024 * 1024 }; // 10MB limit
      await expect(fetcher.fetchFile(mockRepo, 'large-file.zip', options)).rejects.toThrow(
        'exceeds maximum size'
      );
    });
  });

  describe('listDirectory', () => {
    it('should list directory contents', async () => {
      const mockApiResponse = [
        {
          name: 'hello-world',
          path: 'posts/hello-world',
          type: 'dir',
          size: 0,
          download_url: null,
        },
        {
          name: 'another-post',
          path: 'posts/another-post',
          type: 'dir',
          size: 0,
          download_url: null,
        },
      ];
      const mockResponse = new Response(JSON.stringify(mockApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      const result = await fetcher.listDirectory(mockRepo, 'posts');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'hello-world',
        path: 'posts/hello-world',
        type: 'dir',
        size: 0,
        downloadUrl: null,
      });
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test-owner/test-repo/contents/posts?ref=main',
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/vnd.github.v3+json',
          }),
        })
      );
    });

    it('should handle files in directory listing', async () => {
      const mockApiResponse = [
        {
          name: 'index.md',
          path: 'posts/hello-world/index.md',
          type: 'file',
          size: 1234,
          download_url: 'https://raw.githubusercontent.com/test-owner/test-repo/main/posts/hello-world/index.md',
        },
        {
          name: 'hero.jpg',
          path: 'posts/hello-world/hero.jpg',
          type: 'file',
          size: 50000,
          download_url: 'https://raw.githubusercontent.com/test-owner/test-repo/main/posts/hello-world/hero.jpg',
        },
      ];
      const mockResponse = new Response(JSON.stringify(mockApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      const result = await fetcher.listDirectory(mockRepo, 'posts/hello-world');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'index.md',
        path: 'posts/hello-world/index.md',
        type: 'file',
        size: 1234,
        downloadUrl: 'https://raw.githubusercontent.com/test-owner/test-repo/main/posts/hello-world/index.md',
      });
    });

    it('should throw for non-existent directory', async () => {
      const mockResponse = new Response('Not Found', { status: 404 });
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      await expect(fetcher.listDirectory(mockRepo, 'nonexistent')).rejects.toThrow(
        'Directory not found'
      );
    });

    it('should throw for API errors', async () => {
      const mockResponse = new Response('Rate limit exceeded', { status: 403 });
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      await expect(fetcher.listDirectory(mockRepo, 'posts')).rejects.toThrow(
        'Failed to list directory'
      );
    });
  });

  describe('listPostSlugs', () => {
    it('should return list of post slugs', async () => {
      const mockApiResponse = [
        { name: 'hello-world', path: 'posts/hello-world', type: 'dir', size: 0, download_url: null },
        { name: 'another-post', path: 'posts/another-post', type: 'dir', size: 0, download_url: null },
        { name: '.gitkeep', path: 'posts/.gitkeep', type: 'file', size: 0, download_url: 'https://...' },
      ];
      const mockResponse = new Response(JSON.stringify(mockApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      const result = await fetcher.listPostSlugs(mockRepo);

      expect(result).toEqual(['hello-world', 'another-post']);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test-owner/test-repo/contents/posts?ref=main',
        expect.any(Object)
      );
    });

    it('should filter out non-directory entries', async () => {
      const mockApiResponse = [
        { name: 'hello-world', path: 'posts/hello-world', type: 'dir', size: 0, download_url: null },
        { name: 'README.md', path: 'posts/README.md', type: 'file', size: 100, download_url: 'https://...' },
      ];
      const mockResponse = new Response(JSON.stringify(mockApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      const result = await fetcher.listPostSlugs(mockRepo);

      expect(result).toEqual(['hello-world']);
    });

    it('should return empty array if posts directory is empty', async () => {
      const mockApiResponse: unknown[] = [];
      const mockResponse = new Response(JSON.stringify(mockApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      const result = await fetcher.listPostSlugs(mockRepo);

      expect(result).toEqual([]);
    });
  });

  describe('fetchPostFiles', () => {
    it('should fetch all files in a post directory', async () => {
      // First call: list directory
      const mockDirResponse = [
        {
          name: 'index.md',
          path: 'posts/hello-world/index.md',
          type: 'file',
          size: 100,
          download_url: 'https://raw.githubusercontent.com/test-owner/test-repo/main/posts/hello-world/index.md',
        },
        {
          name: 'hero.jpg',
          path: 'posts/hello-world/hero.jpg',
          type: 'file',
          size: 50000,
          download_url: 'https://raw.githubusercontent.com/test-owner/test-repo/main/posts/hello-world/hero.jpg',
        },
      ];
      const listResponse = new Response(JSON.stringify(mockDirResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      // Second call: fetch index.md
      const indexContent = '# Hello World';
      const indexResponse = new Response(indexContent, { status: 200 });

      // Third call: fetch hero.jpg
      const heroContent = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const heroResponse = new Response(heroContent, { status: 200 });

      vi.mocked(fetch)
        .mockResolvedValueOnce(listResponse)
        .mockResolvedValueOnce(indexResponse)
        .mockResolvedValueOnce(heroResponse);

      const result = await fetcher.fetchPostFiles(mockRepo, 'hello-world');

      expect(result).toHaveLength(2);
      expect(result[0].path).toBe('posts/hello-world/index.md');
      expect(result[0].content.toString()).toBe(indexContent);
      expect(result[1].path).toBe('posts/hello-world/hero.jpg');
    });

    it('should skip subdirectories', async () => {
      const mockDirResponse = [
        {
          name: 'index.md',
          path: 'posts/hello-world/index.md',
          type: 'file',
          size: 100,
          download_url: 'https://raw.githubusercontent.com/test-owner/test-repo/main/posts/hello-world/index.md',
        },
        {
          name: 'images',
          path: 'posts/hello-world/images',
          type: 'dir',
          size: 0,
          download_url: null,
        },
      ];
      const listResponse = new Response(JSON.stringify(mockDirResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      const indexContent = '# Hello World';
      const indexResponse = new Response(indexContent, { status: 200 });

      vi.mocked(fetch)
        .mockResolvedValueOnce(listResponse)
        .mockResolvedValueOnce(indexResponse);

      const result = await fetcher.fetchPostFiles(mockRepo, 'hello-world');

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('posts/hello-world/index.md');
    });

    it('should continue fetching if one file fails', async () => {
      const mockDirResponse = [
        {
          name: 'index.md',
          path: 'posts/hello-world/index.md',
          type: 'file',
          size: 100,
          download_url: 'https://raw.githubusercontent.com/test-owner/test-repo/main/posts/hello-world/index.md',
        },
        {
          name: 'broken.jpg',
          path: 'posts/hello-world/broken.jpg',
          type: 'file',
          size: 50000,
          download_url: 'https://raw.githubusercontent.com/test-owner/test-repo/main/posts/hello-world/broken.jpg',
        },
      ];
      const listResponse = new Response(JSON.stringify(mockDirResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      const indexContent = '# Hello World';
      const indexResponse = new Response(indexContent, { status: 200 });
      const brokenResponse = new Response('Not Found', { status: 404 });

      vi.mocked(fetch)
        .mockResolvedValueOnce(listResponse)
        .mockResolvedValueOnce(indexResponse)
        .mockResolvedValueOnce(brokenResponse);

      const result = await fetcher.fetchPostFiles(mockRepo, 'hello-world');

      // Should still return the successful file
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('posts/hello-world/index.md');
    });
  });
});
