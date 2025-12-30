/**
 * Authoring Bounded Context
 *
 * Handles raw parsing of markdown documents.
 * Concepts: Post, FrontMatter, Markdown, Draft
 * Boundary: Raw markdown files → ParsedArticle
 */

// Models
export type { FrontMatter } from './front-matter.js';
export { isFrontMatter } from './front-matter.js';
export type { ValidationError } from './validation-error.js';
export { formatValidationError, isRecoverableError } from './validation-error.js';

// Services
export { FrontMatterParser } from './front-matter-parser.js';
export type { ParseResult } from './front-matter-parser.js';

export { MarkdownParser } from './markdown-parser.js';
export type {
  MarkdownParserOptions,
  ParseResult as MarkdownParseResult,
} from './markdown-parser.js';
