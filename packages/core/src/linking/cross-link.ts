/**
 * Represents an Obsidian-style [[wikilink]] in content.
 * Per data-model.md specification.
 */
export interface CrossLink {
  /** Original text inside [[ ]] */
  originalText: string;

  /** Normalized text for matching */
  normalizedText: string;

  /** Resolved target article slug (null if broken) */
  targetSlug: string | null;

  /** Whether link resolution succeeded */
  isResolved: boolean;

  /** Position in source content */
  position: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

/**
 * Result of cross-link resolution attempt
 */
export interface CrossLinkResolution {
  /** The original link */
  link: CrossLink;

  /** How the link was resolved (or null if broken) */
  resolvedBy: 'slug' | 'title' | 'alias' | null;

  /** Target article slug if resolved */
  targetSlug: string | null;
}
