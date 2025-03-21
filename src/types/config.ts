export interface ConfluenceConfig {
  /**
   * The base URL of your Confluence instance
   */
  baseUrl: string;

  /**
   * The username for authentication
   */
  username: string;

  /**
   * The API token for authentication
   */
  apiToken: string;
}

/**
 * Main configuration type for the MCP server
 */
export interface ConfluenceMcpConfig {
  confluence: ConfluenceConfig;
}
