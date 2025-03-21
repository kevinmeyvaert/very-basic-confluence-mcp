import * as dotenv from 'dotenv';
import { join } from 'path';
import { ConfluenceServer } from './server';
import { SSEManager } from './sse-server';
import { ConfluenceMcpConfig } from './types/config';

// Load environment variables from project root
dotenv.config({ path: join(__dirname, '../.env') });

// Log version info
console.log('Confluence MCP Server - Starting up');
// Skip version logging to avoid linter errors
console.log('Starting server...');

// Create the server configuration from environment variables
const config: ConfluenceMcpConfig = {
  confluence: {
    baseUrl: process.env.CONFLUENCE_BASE_URL || '',
    username: process.env.CONFLUENCE_USERNAME || '',
    apiToken: process.env.CONFLUENCE_API_TOKEN || '',
  },
};

// Get server configuration
const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

// Validate the required configuration
if (!config.confluence.baseUrl) {
  console.error('Error: CONFLUENCE_BASE_URL environment variable is required');
  process.exit(1);
}

if (!config.confluence.username) {
  console.error('Error: CONFLUENCE_USERNAME environment variable is required');
  process.exit(1);
}

if (!config.confluence.apiToken) {
  console.error('Error: CONFLUENCE_API_TOKEN environment variable is required');
  process.exit(1);
}

// Create and initialize the server
const server = new ConfluenceServer(config);

// Run the server
async function runServer() {
  // Test the connection to Confluence
  const connectionSuccessful = await server.testConnection();

  if (!connectionSuccessful) {
    console.error('Error: Failed to connect to Confluence API');
    process.exit(1);
  }

  console.log('Successfully connected to Confluence API');
  console.log(`Base URL: ${config.confluence.baseUrl}`);

  // Create and start the SSE manager
  const sseManager = new SSEManager(server, port, host);
  await sseManager.start();

  console.log('Confluence MCP Server running with SSE');
  console.log(`Server is available at http://${host}:${port}`);
  console.log(
    `Connect to http://${host}:${port}/sse to establish an SSE connection`,
  );

  // Handle process termination
  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await sseManager.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await sseManager.stop();
    process.exit(0);
  });
}

// Start the server
runServer().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
