import { SearchContentTool } from './searchContent';

export { SearchContentTool };

/**
 * Get all Confluence tools
 *
 * @returns Array of Confluence tools
 */
export function getConfluenceTools() {
  return [new SearchContentTool()];
}
