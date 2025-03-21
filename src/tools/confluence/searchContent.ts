import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import axios, { AxiosError } from 'axios';
import { z } from 'zod';
import { ConfluenceMcpConfig } from '../../types/config';
import { McpTool } from '../types';

interface ConfluenceErrorResponse {
  message?: string;
}

interface SearchResult {
  id: string;
  type: string;
  title: string;
  space: {
    key: string;
    name: string;
  };
  version: number;
  lastModified: string;
  url: string;
  content?: string;
}

export class SearchContentTool implements McpTool {
  name = 'search_confluence';
  description = 'Search for content in Confluence using CQL';

  // Default space to search in
  private readonly DEFAULT_SPACE_KEY: string;

  constructor() {
    const spaceKey = process.env.CONFLUENCE_DEFAULT_SPACE_KEY;
    if (!spaceKey) {
      throw new Error(
        'CONFLUENCE_DEFAULT_SPACE_KEY environment variable is required',
      );
    }
    this.DEFAULT_SPACE_KEY = spaceKey;
  }

  register(server: McpServer, config: ConfluenceMcpConfig): void {
    server.tool(
      this.name,
      {
        cql: z.string().describe('The CQL query to search with'),
        spaceKey: z
          .string()
          .optional()
          .describe('Optional space key to limit search to'),
        limit: z
          .number()
          .optional()
          .describe('Maximum number of results to return (default: 25)'),
        includeContent: z
          .boolean()
          .optional()
          .describe(
            'Whether to include the content body in results (default: false)',
          ),
      },
      async (args) => {
        try {
          // Build the CQL query
          let cqlQuery = args.cql;

          // Use the specified space key or default to environment variable
          const spaceKey = args.spaceKey || this.DEFAULT_SPACE_KEY;
          cqlQuery = `space = "${spaceKey}" AND ${cqlQuery}`;

          const response = await axios.get(
            `${config.confluence.baseUrl}/wiki/rest/api/content/search`,
            {
              params: {
                cql: cqlQuery,
                limit: args.limit || 10,
                expand: args.includeContent
                  ? 'body.storage,version,space'
                  : 'version,space',
              },
              auth: {
                username: config.confluence.username,
                password: config.confluence.apiToken,
              },
            },
          );

          const results = response.data.results.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (content: any) => {
              const result: SearchResult = {
                id: content.id,
                type: content.type,
                title: content.title,
                space: {
                  key: content.space?.key,
                  name: content.space?.name,
                },
                version: content.version?.number,
                lastModified: content.version?.when,
                url: `${config.confluence.baseUrl}${content._links?.webui}`,
              };

              if (args.includeContent && content.body?.storage?.value) {
                return {
                  ...result,
                  content: content.body.storage.value,
                };
              }

              return result;
            },
          );

          return {
            content: [
              {
                type: 'text',
                text: `Found ${results.length} results:\n\n${results
                  .map(
                    (r: SearchResult) =>
                      `## ${r.title}\n` +
                      `**Type**: ${r.type}\n` +
                      `**Space**: ${r.space.name} (${r.space.key})\n` +
                      `**Last Modified**: ${r.lastModified}\n` +
                      `**URL**: ${r.url}\n` +
                      (r.content ? `\n${r.content}\n` : ''),
                  )
                  .join('\n---\n')}`,
              },
            ],
          };
        } catch (error) {
          if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError<ConfluenceErrorResponse>;
            throw new Error(
              `Failed to search Confluence content: ${axiosError.response?.data?.message || axiosError.message}`,
            );
          }
          throw error;
        }
      },
    );
  }
}
