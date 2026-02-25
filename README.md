# mcp-usps

Validate addresses, look up ZIP codes, track packages, and calculate shipping rates via USPS.

## Tools

| Tool | Description |
|------|-------------|
| `validate_address` | Validate and standardize a US address via USPS. |
| `lookup_zipcode` | Look up ZIP code for a city/state. |
| `city_state_lookup` | Look up city and state for a ZIP code. |
| `track_package` | Track a USPS package by tracking number. |
| `calculate_rate` | Calculate USPS shipping rate for a domestic package. |

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `USPS_USER_ID` | Yes | USPS Web Tools User ID |

## Installation

```bash
git clone https://github.com/PetrefiedThunder/mcp-usps.git
cd mcp-usps
npm install
npm run build
```

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "usps": {
      "command": "node",
      "args": ["/path/to/mcp-usps/dist/index.js"],
      "env": {
        "USPS_USER_ID": "your-usps-user-id"
      }
    }
  }
}
```

## Usage with npx

```bash
npx mcp-usps
```

## License

MIT
