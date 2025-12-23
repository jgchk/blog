/**
 * Storage abstraction for rendered content.
 * Per research.md - enables cloud-agnostic core logic.
 */
export interface StorageAdapter {
  /**
   * Read content from storage
   * @param key - The storage key/path
   * @returns The content as a Buffer
   * @throws If the key does not exist
   */
  read(key: string): Promise<Buffer>;

  /**
   * Write content to storage
   * @param key - The storage key/path
   * @param content - The content to store
   * @param contentType - Optional MIME type for the content
   */
  write(key: string, content: Buffer, contentType?: string): Promise<void>;

  /**
   * Delete content from storage
   * @param key - The storage key/path
   */
  delete(key: string): Promise<void>;

  /**
   * List all keys with a given prefix
   * @param prefix - The prefix to filter by
   * @returns Array of matching keys
   */
  list(prefix: string): Promise<string[]>;

  /**
   * Check if a key exists
   * @param key - The storage key/path
   */
  exists(key: string): Promise<boolean>;
}
