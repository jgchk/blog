/**
 * GitHub utility functions.
 */

import type { RepositoryRef } from '../adapters/github-content.js';

/**
 * Parse repository information from various formats.
 * @param input Can be "owner/repo" string, or an object with full_name property
 * @param ref Git reference (default: "main")
 */
export function parseRepository(
  input: string | { full_name: string },
  ref: string = 'main'
): RepositoryRef {
  const fullName = typeof input === 'string' ? input : input.full_name;
  const [owner, name] = fullName.split('/');

  if (!owner || !name) {
    throw new Error(`Invalid repository format: ${fullName}. Expected "owner/repo"`);
  }

  return { owner, name, ref };
}
