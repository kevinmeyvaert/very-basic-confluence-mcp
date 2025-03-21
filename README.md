# TINY CONFLUENCE MCP (Model Context Protocol)

A reference server implementation for the Model Context Protocol (MCP) integrated with Confluence. This enables AI assistants to interact with Confluence resources and perform operations programmatically.

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
```

Required environment variables:
- `CONFLUENCE_BASE_URL`: Your Confluence instance URL
- `CONFLUENCE_USERNAME`: Your Confluence username (email)
- `CONFLUENCE_API_TOKEN`: Your Confluence API token (get it from https://id.atlassian.com/manage-profile/security/api-tokens)
- `CONFLUENCE_DEFAULT_SPACE_KEY`: Your default Confluence space key
- `PORT`: Server port (default: 3000)

3. Start the server:
```bash
npm start
```

## Add to Cursor

Add `http://localhost:3000/sse` to your Cursor AI settings.

## License

MIT
