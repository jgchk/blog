/**
 * Validation errors that can occur during article processing.
 * Per data-model.md specification.
 */
export type ValidationError =
  | { type: 'missing_title'; path: string }
  | { type: 'missing_date'; path: string }
  | { type: 'invalid_date'; path: string; value: string }
  | { type: 'invalid_yaml'; path: string; message: string }
  | { type: 'duplicate_slug'; slug: string; paths: string[] }
  | { type: 'broken_crosslink'; articleSlug: string; linkText: string };

/**
 * Create a descriptive error message for a validation error
 */
export function formatValidationError(error: ValidationError): string {
  switch (error.type) {
    case 'missing_title':
      return `Missing required 'title' field in front matter: ${error.path}`;
    case 'missing_date':
      return `Missing required 'date' field in front matter: ${error.path}`;
    case 'invalid_date':
      return `Invalid date format '${error.value}' in: ${error.path} (expected YYYY-MM-DD)`;
    case 'invalid_yaml':
      return `Invalid YAML in front matter: ${error.path} - ${error.message}`;
    case 'duplicate_slug':
      return `Duplicate article slug '${error.slug}' found in: ${error.paths.join(', ')}`;
    case 'broken_crosslink':
      return `Broken cross-link [[${error.linkText}]] in article: ${error.articleSlug}`;
  }
}

/**
 * Check if an error is recoverable (article can still be skipped)
 */
export function isRecoverableError(error: ValidationError): boolean {
  return error.type !== 'duplicate_slug';
}
