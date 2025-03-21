import { createServer, IncomingMessage, ServerResponse } from 'http';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ConfluenceServer } from './server';

/**
 * Class that manages SSE connections for the Confluence MCP server
 */
export class SSEManager {
  private server: ConfluenceServer;
  private httpServer: ReturnType<typeof createServer>;
  private sessions: Map<string, SSEServerTransport> = new Map();
  private port: number;
  private host: string;

  /**
   * Create a new SSE manager
   *
   * @param server The Confluence server instance
   * @param port The port to listen on
   * @param host The host to listen on
   */
  constructor(
    server: ConfluenceServer,
    port: number = 3000,
    host: string = '0.0.0.0',
  ) {
    this.server = server;
    this.port = port;
    this.host = host;
    this.httpServer = createServer(this.handleRequest.bind(this));
  }

  /**
   * Start the SSE server
   */
  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.port, '0.0.0.0', () => {
        console.log(`SSE server listening on http://${this.host}:${this.port}`);
        console.log(
          `Connect to http://${this.host}:${this.port}/sse to establish an SSE connection`,
        );
        resolve();
      });
    });
  }

  /**
   * Add CORS headers to the response
   *
   * @param res The server response
   */
  private addCorsHeaders(res: ServerResponse): void {
    // Allow requests from any origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Allow these HTTP methods
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, OPTIONS, PUT, DELETE, PATCH, HEAD',
    );
    // Allow all headers
    res.setHeader('Access-Control-Allow-Headers', '*');
    // Allow credentials
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    // Cache preflight response for 1 hour (3600 seconds)
    res.setHeader('Access-Control-Max-Age', '3600');
    // Expose all headers
    res.setHeader('Access-Control-Expose-Headers', '*');
  }

  /**
   * Handle an incoming HTTP request
   *
   * @param req The incoming request
   * @param res The server response
   */
  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const url = new URL(
      req.url || '',
      `http://${req.headers.host || 'localhost'}`,
    );
    const pathname = url.pathname;

    // Add CORS headers to all responses
    this.addCorsHeaders(res);

    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
      console.log('Received OPTIONS preflight request');
      res.writeHead(204);
      res.end();
      return;
    }

    // Handle SSE connection request
    if (pathname === '/sse' && req.method === 'GET') {
      console.log('Received SSE connection request');
      await this.handleSSEConnection(req, res);
      return;
    }

    // Handle message POST request
    if (pathname === '/message' && req.method === 'POST') {
      console.log(`Received message POST request`);

      // Log the full URL for debugging
      console.log(`Full URL: ${req.url}`);
      console.log(`Pathname: ${pathname}`);

      // Extract session ID from query parameters
      const sessionId = url.searchParams.get('sessionId');

      if (sessionId) {
        console.log(`Found session ID in query parameters: "${sessionId}"`);
        await this.handleMessagePost(sessionId, req, res);
        return;
      }

      // If no session ID in query parameters, try to get it from the message body
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const message = JSON.parse(body);
          console.log(`Received message:`, message);

          // Find the session ID from the message
          const sessionId = message.sessionId;

          if (!sessionId) {
            console.error('No session ID in message or query parameters');
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'No session ID in message or query parameters',
              }),
            );
            return;
          }

          await this.handleMessagePost(sessionId, req, res, message);
        } catch (error) {
          console.error('Error parsing message:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });

      return;
    }

    // Handle health check
    if (pathname === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          sessions: this.sessions.size,
          uptime: process.uptime(),
        }),
      );
      return;
    }

    // Handle root path
    if (pathname === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head>
            <title>Confluence MCP Server</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
              h1 { color: #0078d4; }
              pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
              .container { max-width: 800px; margin: 0 auto; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Confluence MCP Server</h1>
              <p>Server is running. Connect to <a href="/sse">/sse</a> to establish an SSE connection.</p>
              <p>Server status: <a href="/health">/health</a></p>
              <p>Current sessions: ${this.sessions.size}</p>
              <p>Uptime: ${process.uptime().toFixed(2)} seconds</p>
            </div>
          </body>
        </html>
      `);
      return;
    }

    // Handle all other requests
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  /**
   * Handle an SSE connection request
   *
   * @param req The incoming request
   * @param res The server response
   */
  private async handleSSEConnection(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    console.log('Received SSE connection request');

    // Set keep-alive timeout to a high value to prevent connection timeouts
    if (req.socket) {
      req.socket.setKeepAlive(true);
      req.socket.setTimeout(0); // Disable timeout
    }

    // Create a new SSE transport
    const transport = new SSEServerTransport('/message', res);

    // Log the transport details
    console.log(`Created transport with session ID: "${transport.sessionId}"`);

    // Store the session
    this.sessions.set(transport.sessionId, transport);

    // Connect the server to the transport
    try {
      console.log('Connecting to transport...');

      // Add event listener for client disconnect before connecting
      req.on('close', () => {
        console.log(`Client disconnected: ${transport.sessionId}`);
        this.sessions.delete(transport.sessionId);
        transport
          .close()
          .catch((err) => console.error('Error closing transport:', err));
      });

      // Connect to the transport
      await this.server.connect(transport);
      console.log(`New SSE connection established: ${transport.sessionId}`);

      // Send a hello message immediately after connection
      try {
        console.log(`Sending hello message to ${transport.sessionId}`);
        await transport.send({
          jsonrpc: '2.0',
          method: 'hello',
          params: {
            sessionId: transport.sessionId,
            serverName: this.server.getName(),
            serverVersion: this.server.getVersion(),
          },
          id: `hello-${Date.now()}`,
        });
        console.log('Hello message sent successfully');
      } catch (error) {
        console.error('Error sending hello message:', error);
      }

      // Send a ping message every 30 seconds to keep the connection alive
      const pingInterval = setInterval(() => {
        try {
          if (this.sessions.has(transport.sessionId)) {
            console.log(`Sending ping to ${transport.sessionId}`);
            transport
              .send({
                jsonrpc: '2.0',
                method: 'ping',
                params: {
                  timestamp: new Date().toISOString(),
                },
                id: `ping-${Date.now()}`,
              })
              .catch((err) => console.error('Error sending ping:', err));
          } else {
            clearInterval(pingInterval);
          }
        } catch (error) {
          console.error('Error in ping interval:', error);
          clearInterval(pingInterval);
        }
      }, 30000);

      // Clear the interval when the client disconnects
      req.on('close', () => {
        clearInterval(pingInterval);
      });
    } catch (error) {
      console.error('Error connecting to transport:', error);
      this.sessions.delete(transport.sessionId);
      transport.close().catch(console.error);
    }
  }

  /**
   * Handle a message POST request
   *
   * @param sessionId The session ID
   * @param req The incoming request
   * @param res The server response
   */
  private async handleMessagePost(
    sessionId: string,
    req: IncomingMessage,
    res: ServerResponse,
    message?: any,
  ): Promise<void> {
    console.log(`Looking for session with ID: "${sessionId}"`);
    console.log(
      `Available sessions: ${Array.from(this.sessions.keys()).join(', ')}`,
    );

    const transport = this.sessions.get(sessionId);

    if (!transport) {
      console.error(`Session not found: "${sessionId}"`);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }

    if (message) {
      // If message is already parsed, use it directly
      console.log(
        `Handling pre-parsed message for session ${sessionId}:`,
        message,
      );
      await transport.handlePostMessage(req, res, message);
      return;
    }

    // Read the request body
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const message = JSON.parse(body);
        console.log(`Received message for session ${sessionId}:`, message);
        await transport.handlePostMessage(req, res, message);
      } catch (error) {
        console.error('Error handling message:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ error: 'Invalid JSON or message handling error' }),
        );
      }
    });
  }

  /**
   * Stop the SSE server
   */
  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Stopping SSE server...');

      // Close all sessions
      for (const transport of this.sessions.values()) {
        transport.close().catch(console.error);
      }

      // Clear the sessions map
      this.sessions.clear();

      // Close the HTTP server
      this.httpServer.close((err) => {
        if (err) {
          console.error('Error closing HTTP server:', err);
          reject(err);
        } else {
          console.log('SSE server stopped');
          resolve();
        }
      });
    });
  }
}
