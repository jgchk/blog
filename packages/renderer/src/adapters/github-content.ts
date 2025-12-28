/**
 * GitHubContentFetcher - Fetches content from GitHub repositories.
 * Per contracts/github-content.ts specification.
 */

/**
 * A file fetched from GitHub repository.
 */
export interface GitHubFile {
  /** File path relative to repository root */
  path: string;

  /** File content as buffer (supports text and binary) */
  content: Buffer;

  /** File size in bytes */
  size: number;

  /** SHA hash for cache validation (optional) */
  sha?: string;
}

/**
 * Entry in a GitHub directory listing.
 */
export interface GitHubDirectoryEntry {
  /** File or directory name */
  name: string;

  /** Full path from repository root */
  path: string;

  /** Type of entry */
  type: 'file' | 'dir';

  /** File size in bytes (0 for directories) */
  size: number;

  /** Download URL for files (null for directories) */
  downloadUrl: string | null;
}

/**
 * Repository reference for content fetching.
 */
export interface RepositoryRef {
  /** Repository owner */
  owner: string;

  /** Repository name */
  name: string;

  /** Git reference - branch name or commit SHA */
  ref: string;
}

/**
 * Options for content fetching.
 */
export interface FetchOptions {
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;

  /** Maximum file size to fetch in bytes (default: 10MB) */
  maxSize?: number;
}

/**
 * GitHub API directory entry response shape
 */
interface GitHubApiDirectoryEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  download_url: string | null;
  sha?: string;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Fetches content from GitHub repositories using raw content and API endpoints.
 */
export class GitHubContentFetcher {
  private rawBaseUrl = 'https://raw.githubusercontent.com';
  private apiBaseUrl = 'https://api.github.com';

  /**
   * Fetch a single file from the repository.
   * @param repo Repository reference
   * @param path File path relative to repo root
   * @param options Optional fetch configuration
   * @returns The file content, or null if not found
   */
  async fetchFile(
    repo: RepositoryRef,
    path: string,
    options?: FetchOptions
  ): Promise<GitHubFile | null> {
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
    const maxSize = options?.maxSize ?? DEFAULT_MAX_SIZE;

    const url = `${this.rawBaseUrl}/${repo.owner}/${repo.name}/${repo.ref}/${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }

      // Check Content-Length header for size limit
      const contentLength = response.headers.get('Content-Length');
      if (contentLength && parseInt(contentLength, 10) > maxSize) {
        throw new Error(`File exceeds maximum size of ${maxSize} bytes`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const content = Buffer.from(arrayBuffer);

      // Double-check size after fetching (Content-Length might not always be accurate)
      if (content.length > maxSize) {
        throw new Error(`File exceeds maximum size of ${maxSize} bytes`);
      }

      return {
        path,
        content,
        size: content.length,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * List contents of a directory in the repository.
   * @param repo Repository reference
   * @param path Directory path relative to repo root
   * @returns Array of directory entries
   */
  async listDirectory(repo: RepositoryRef, path: string): Promise<GitHubDirectoryEntry[]> {
    const url = `${this.apiBaseUrl}/repos/${repo.owner}/${repo.name}/contents/${path}?ref=${repo.ref}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (response.status === 404) {
        throw new Error(`Directory not found: ${path}`);
      }

      if (!response.ok) {
        throw new Error(`Failed to list directory: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as GitHubApiDirectoryEntry[];

      return data.map((entry) => ({
        name: entry.name,
        path: entry.path,
        type: entry.type,
        size: entry.size,
        downloadUrl: entry.download_url,
      }));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * List all post directories in the repository.
   * @param repo Repository reference
   * @returns Array of post directory names (slugs)
   */
  async listPostSlugs(repo: RepositoryRef): Promise<string[]> {
    const entries = await this.listDirectory(repo, 'posts');
    return entries.filter((entry) => entry.type === 'dir').map((entry) => entry.name);
  }

  /**
   * Fetch all files in a post directory (markdown and assets).
   * @param repo Repository reference
   * @param slug Post slug (directory name)
   * @param options Optional fetch configuration
   * @returns Array of files in the post directory
   */
  async fetchPostFiles(
    repo: RepositoryRef,
    slug: string,
    options?: FetchOptions
  ): Promise<GitHubFile[]> {
    const entries = await this.listDirectory(repo, `posts/${slug}`);
    const files: GitHubFile[] = [];

    for (const entry of entries) {
      // Skip directories (only fetch files)
      if (entry.type !== 'file') {
        continue;
      }

      try {
        const file = await this.fetchFile(repo, entry.path, options);
        if (file) {
          files.push(file);
        }
      } catch (error) {
        // Log warning but continue with other files
        console.warn(`Failed to fetch ${entry.path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return files;
  }
}
