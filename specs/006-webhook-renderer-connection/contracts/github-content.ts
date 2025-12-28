/**
 * GitHubContentFetcher Interface Contract
 *
 * Defines the contract for fetching content from GitHub repositories.
 * Used by SyncOrchestrator to retrieve posts and assets.
 */

/**
 * A file fetched from GitHub repository.
 */
export interface GitHubFile {
  /** File path relative to repository root (e.g., "posts/hello-world/index.md") */
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
  /** Repository owner (e.g., "owner") */
  owner: string;

  /** Repository name (e.g., "blog-content") */
  name: string;

  /** Git reference - branch name or commit SHA (e.g., "main") */
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
 * Interface for fetching content from GitHub.
 * Implementation should use raw.githubusercontent.com for files
 * and api.github.com for directory listings.
 */
export interface GitHubContentFetcher {
  /**
   * Fetch a single file from the repository.
   *
   * @param repo - Repository reference (owner, name, ref)
   * @param path - File path relative to repo root
   * @param options - Optional fetch configuration
   * @returns The file content, or null if not found
   * @throws Error if fetch fails (network, size limit, etc.)
   */
  fetchFile(
    repo: RepositoryRef,
    path: string,
    options?: FetchOptions
  ): Promise<GitHubFile | null>;

  /**
   * List contents of a directory in the repository.
   *
   * @param repo - Repository reference (owner, name, ref)
   * @param path - Directory path relative to repo root
   * @returns Array of directory entries
   * @throws Error if directory doesn't exist or fetch fails
   */
  listDirectory(
    repo: RepositoryRef,
    path: string
  ): Promise<GitHubDirectoryEntry[]>;

  /**
   * List all post directories in the repository.
   * Convenience method that lists contents of "posts/" directory.
   *
   * @param repo - Repository reference (owner, name, ref)
   * @returns Array of post directory names (slugs)
   */
  listPostSlugs(repo: RepositoryRef): Promise<string[]>;

  /**
   * Fetch all files in a post directory (markdown and assets).
   *
   * @param repo - Repository reference (owner, name, ref)
   * @param slug - Post slug (directory name)
   * @returns Array of files in the post directory
   */
  fetchPostFiles(
    repo: RepositoryRef,
    slug: string,
    options?: FetchOptions
  ): Promise<GitHubFile[]>;
}
