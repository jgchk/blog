import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { StorageAdapter } from '@blog/core';

/**
 * Local filesystem adapter for reading and writing files.
 * Used by pipeline renderer for local rendering.
 */
export class LocalStorageAdapter implements StorageAdapter {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * Read content from local filesystem
   */
  async read(key: string): Promise<Buffer> {
    const filePath = path.join(this.basePath, key);
    return fs.readFile(filePath);
  }

  /**
   * Write content to local filesystem, creating directories as needed
   */
  async write(key: string, content: Buffer, _contentType?: string): Promise<void> {
    const filePath = path.join(this.basePath, key);
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content);
  }

  /**
   * Delete a file from local filesystem
   */
  async delete(key: string): Promise<void> {
    const filePath = path.join(this.basePath, key);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * List all files under a prefix (directory)
   */
  async list(prefix: string): Promise<string[]> {
    const dirPath = path.join(this.basePath, prefix);
    const results: string[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(prefix, entry.name);
        if (entry.isDirectory()) {
          // Recursively list subdirectories
          const subEntries = await this.list(entryPath);
          results.push(...subEntries);
        } else {
          results.push(entryPath);
        }
      }
    } catch (error) {
      // Return empty if directory doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return results;
  }

  /**
   * Check if a file exists
   */
  async exists(key: string): Promise<boolean> {
    const filePath = path.join(this.basePath, key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the base path for this adapter
   */
  getBasePath(): string {
    return this.basePath;
  }

  /**
   * Copy a file from source to destination
   */
  async copy(sourceKey: string, destKey: string): Promise<void> {
    const content = await this.read(sourceKey);
    await this.write(destKey, content);
  }

  /**
   * List directories under a prefix
   */
  async listDirectories(prefix: string = ''): Promise<string[]> {
    const dirPath = path.join(this.basePath, prefix);
    const results: string[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          results.push(entry.name);
        }
      }
    } catch (error) {
      // Return empty if directory doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return results;
  }
}
