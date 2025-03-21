import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ConfluenceMcpConfig } from './types/config';
import { getAllTools } from './tools';
import type { ToolRegistry } from './tools';
import { version } from '../package.json';

/**
 * Confluence MCP Server
 *
 * Implements a Model Context Protocol server for Confluence
 */
export class ConfluenceServer {
  private server: McpServer;
  private config: ConfluenceMcpConfig;
  private serverInfo: { name: string; version: string };
  private toolRegistry: ToolRegistry;

  /**
   * Create a new Confluence MCP Server
   *
   * @param config The Confluence configuration
   */
  constructor(config: ConfluenceMcpConfig) {
    this.validateConfig(config);
    this.config = config;

    this.serverInfo = {
      name: 'confluence-mcp',
      version: version,
    };

    // Initialize the MCP server
    this.server = new McpServer({
      name: this.serverInfo.name,
      version: this.serverInfo.version,
    });

    // Initialize the tool registry
    this.toolRegistry = getAllTools();

    // Register the tools
    this.registerTools();
  }

  /**
   * Validate the Confluence configuration
   *
   * @param config Configuration to validate
   * @throws Error if configuration is invalid
   */
  private validateConfig(config: ConfluenceMcpConfig): void {
    if (!config.confluence) {
      throw new Error('Confluence configuration is required');
    }

    if (!config.confluence.baseUrl) {
      throw new Error('Confluence base URL is required');
    }

    if (!config.confluence.username) {
      throw new Error('Confluence username is required');
    }

    if (!config.confluence.apiToken) {
      throw new Error('Confluence API token is required');
    }

    // Validate base URL format
    try {
      const url = new URL(config.confluence.baseUrl);
      if (!url.hostname) {
        throw new Error('Invalid Confluence base URL');
      }
    } catch (error) {
      throw new Error('Invalid Confluence base URL format');
    }
  }

  /**
   * Register tools with the MCP server
   */
  private registerTools(): void {
    this.toolRegistry.registerAllTools(this.server, this.config);
  }

  /**
   * Test the connection to Confluence
   *
   * @returns A promise that resolves to true if the connection is successful
   */
  public async testConnection(): Promise<boolean> {
    try {
      // Make a simple request to test the connection
      const response = await fetch(
        `${this.config.confluence.baseUrl}/wiki/rest/api/space`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${this.config.confluence.username}:${this.config.confluence.apiToken}`,
            ).toString('base64')}`,
            Accept: 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await response.json(); // Just validate we can parse the response
      console.log('Connection test successful. Connected to Confluence.');
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get the name of the server
   *
   * @returns The server name
   */
  public getName(): string {
    return this.serverInfo.name;
  }

  /**
   * Get the version of the server
   *
   * @returns The server version
   */
  public getVersion(): string {
    return this.serverInfo.version;
  }

  /**
   * Get all registered tools
   *
   * @returns Array of registered tools
   */
  public getTools(): Array<{ name: string; description: string }> {
    return this.toolRegistry.getAllTools();
  }

  /**
   * Connect to a transport
   *
   * @param transport The transport to connect to
   * @returns A promise that resolves when the connection is established
   */
  public async connect(transport: any): Promise<void> {
    console.log('Connecting to transport...');
    await this.server.connect(transport);
    console.log('Connected to transport');
  }
}
