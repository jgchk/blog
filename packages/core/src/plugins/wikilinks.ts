import { visit } from 'unist-util-visit';
import type { ArticleIndex } from '../services/article-index.js';

// Type definitions inline to avoid mdast/vfile type issues
interface TextNode {
  type: 'text';
  value: string;
}

interface LinkNode {
  type: 'link';
  url: string;
  children: TextNode[];
}

interface RootNode {
  type: 'root';
  children: Array<{ children?: Array<TextNode | LinkNode> }>;
}

interface VFileData {
  data: { brokenLinks?: string[] };
}

interface WikilinksOptions {
  articleIndex: ArticleIndex;
}

/**
 * Remark plugin to transform [[wikilinks]] to HTML links.
 * Per research.md specification.
 */
export function remarkWikilinks(options: WikilinksOptions) {
  const { articleIndex } = options;

  return (tree: RootNode, file: VFileData) => {
    const brokenLinks: string[] = [];

    visit(tree, 'text', (node: TextNode, index: number | undefined, parent: { children: Array<TextNode | LinkNode> } | undefined) => {
      if (!parent || typeof index !== 'number') return;

      const regex = /\[\[([^\]]+)\]\]/g;
      let match;
      const segments: (TextNode | LinkNode)[] = [];
      let lastIndex = 0;

      while ((match = regex.exec(node.value)) !== null) {
        const linkText = match[1];
        const fullMatch = match[0];
        const startIndex = match.index;

        // Add text before the match
        if (startIndex > lastIndex) {
          segments.push({
            type: 'text',
            value: node.value.slice(lastIndex, startIndex),
          });
        }

        // Handle empty or whitespace-only links
        if (!linkText || !linkText.trim()) {
          segments.push({
            type: 'text',
            value: fullMatch,
          });
          lastIndex = startIndex + fullMatch.length;
          continue;
        }

        // Try to resolve the link
        const resolution = articleIndex.resolve(linkText);

        if (resolution) {
          // Create a link node
          segments.push({
            type: 'link',
            url: `/articles/${resolution.slug}/`,
            children: [
              {
                type: 'text',
                value: linkText,
              },
            ],
          });
        } else {
          // Broken link - keep as text with original brackets
          brokenLinks.push(linkText);
          segments.push({
            type: 'text',
            value: fullMatch,
          });
        }

        lastIndex = startIndex + fullMatch.length;
      }

      // If no matches, don't modify the tree
      if (segments.length === 0) return;

      // Add remaining text after last match
      if (lastIndex < node.value.length) {
        segments.push({
          type: 'text',
          value: node.value.slice(lastIndex),
        });
      }

      // Replace the current node with our segments
      parent.children.splice(index, 1, ...segments);
    });

    // Store broken links in file metadata
    file.data.brokenLinks = brokenLinks;
  };
}
