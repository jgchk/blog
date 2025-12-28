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
const DEFAULT_MAX_RETRIES = 2; // 2 retries = 3 total attempts
const DEFAULT_RETRY_DELAY_MS = 1000; // 1 second initial delay

/**
 * Check if an error is transient and should be retried.
 * Transient errors include: 5xx server errors, network errors.
 * Non-transient errors (4xx except rate limit) should not be retried.
 */
function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    // Network errors (ECONNRESET, ETIMEDOUT, etc.)
    if (
      error.message.includes('ECONNRESET') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('network')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Check if an HTTP status code indicates a transient error.
 */
function isTransientStatusCode(status: number): boolean {
  // 5xx server errors are transient
  // 429 rate limit is transient
  return status >= 500 || status === 429;
}

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
   * Uses retry logic for transient GitHub API failures (5xx, network errors).
   * @param repo Repository reference
   * @param path Directory path relative to repo root
   * @returns Array of directory entries
   */
  async listDirectory(repo: RepositoryRef, path: string): Promise<GitHubDirectoryEntry[]> {
    const url = `${this.apiBaseUrl}/repos/${repo.owner}/${repo.name}/contents/${path}?ref=${repo.ref}`;

    let lastError: Error | null = null;
    const maxAttempts = DEFAULT_MAX_RETRIES + 1; // +1 for initial attempt

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
        });

        clearTimeout(timeoutId);

        // Non-transient errors should not be retried
        if (response.status === 404) {
          throw new Error(`Directory not found: ${path}`);
        }

        // Check for transient errors that should be retried
        if (!response.ok) {
          const error = new Error(
            `Failed to list directory: ${response.status} ${response.statusText}`
          );

          if (isTransientStatusCode(response.status)) {
            // Transient error - will be retried
            lastError = error;
            if (attempt < maxAttempts) {
              console.warn(`GitHub API retry attempt ${attempt} for ${path}: ${error.message}`);
              // Small delay before retry (exponential backoff would be better for production)
              await new Promise((resolve) => setTimeout(resolve, DEFAULT_RETRY_DELAY_MS * attempt));
              continue;
            }
          }
          // Non-transient error or exhausted retries
          throw error;
        }

        const data = (await response.json()) as GitHubApiDirectoryEntry[];

        return data.map((entry) => ({
          name: entry.name,
          path: entry.path,
          type: entry.type,
          size: entry.size,
          downloadUrl: entry.download_url,
        }));
      } catch (error) {
        clearTimeout(timeoutId);

        // Check if this is a network/transient error that should be retried
        if (isTransientError(error) && attempt < maxAttempts) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.warn(`GitHub API retry attempt ${attempt} for ${path}: ${lastError.message}`);
          await new Promise((resolve) => setTimeout(resolve, DEFAULT_RETRY_DELAY_MS * attempt));
          continue;
        }

        // Non-transient error or exhausted retries - rethrow
        throw error;
      }
    }

    // Should not reach here, but throw last error if we do
    throw lastError ?? new Error(`Failed to list directory: ${path}`);
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
