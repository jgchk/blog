/**
 * YAML metadata at the top of markdown files.
 * Per data-model.md specification.
 */
export interface FrontMatter {
  /** Article title (required) */
  title: string;

  /** Publication date (required) - ISO 8601 format: YYYY-MM-DD */
  date: string;

  /** Tags for categorization (optional) */
  tags?: string[];

  /** Alternative titles for cross-link resolution (optional) */
  aliases?: string[];

  /** Exclude from publication (optional, default: false) */
  draft?: boolean;

  /** Custom excerpt override (optional) */
  excerpt?: string;
}

/**
 * Type guard to check if an object is valid FrontMatter
 */
export function isFrontMatter(obj: unknown): obj is FrontMatter {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const fm = obj as Record<string, unknown>;

  return (
    typeof fm.title === 'string' &&
    fm.title.length > 0 &&
    typeof fm.date === 'string' &&
    fm.date.length > 0
  );
}
