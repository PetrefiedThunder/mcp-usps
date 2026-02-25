# mcp-usps

MCP server for USPS Web Tools API — address validation, tracking, ZIP lookup, and shipping rates. Free API key required.

## Tools

| Tool | Description |
|------|-------------|
| `validate_address` | Validate and standardize US addresses |
| `lookup_zipcode` | Find ZIP code for a city/state |
| `city_state_lookup` | Find city/state for a ZIP code |
| `track_package` | Track USPS packages |
| `calculate_rate` | Calculate domestic shipping rates |

## Setup

Register for a free USPS Web Tools account at https://www.usps.com/business/web-tools-apis/ and set:
```
USPS_USER_ID=your_user_id
```

## Install

```bash
npm install && npm run build
```

## Usage with Claude Desktop

```json
{
  "mcpServers": {
    "usps": {
      "command": "node",
      "args": ["/path/to/mcp-usps/dist/index.js"],
      "env": { "USPS_USER_ID": "your_user_id" }
    }
  }
}
```

## License

MIT
