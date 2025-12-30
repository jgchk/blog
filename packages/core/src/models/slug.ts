/**
 * Value Object representing a URL-safe slug.
 * Encapsulates normalization logic and provides type safety.
 *
 * Per data-model.md normalization rules:
 * - Lowercase
 * - Spaces, dashes, underscores → hyphens
 * - Remove non-alphanumeric characters (except hyphens)
 * - Collapse multiple hyphens
 * - Trim leading/trailing hyphens
 */
export class Slug {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Create a Slug from an input string.
   * Returns null if the input normalizes to an empty string.
   */
  static create(input: string): Slug | null {
    const normalized = Slug.normalize(input);
    if (!normalized) {
      return null;
    }
    return new Slug(normalized);
  }

  /**
   * Create a Slug from an already-normalized string.
   * Use with caution - bypasses normalization.
   */
  static fromNormalized(value: string): Slug {
    return new Slug(value);
  }

  /**
   * Normalize a string to a URL-safe slug.
   */
  static normalize(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Normalize text for cross-link matching.
   * Alias for normalize() to maintain semantic clarity.
   */
  static normalizeForMatching(input: string): string {
    return Slug.normalize(input);
  }

  /**
   * Get the string value of this slug.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Get the string value of this slug.
   */
  valueOf(): string {
    return this.value;
  }

  /**
   * Check equality with another Slug or string.
   */
  equals(other: Slug | string): boolean {
    if (other instanceof Slug) {
      return this.value === other.value;
    }
    return this.value === Slug.normalize(other);
  }

  /**
   * Convert to JSON (returns string value).
   */
  toJSON(): string {
    return this.value;
  }
}
