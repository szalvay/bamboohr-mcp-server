# BambooHR MCP Server

A Model Context Protocol (MCP) server that exposes BambooHR API functionality as tools for Claude Code.

## Tools

| Tool | Description |
|------|-------------|
| `list_employees` | List all employees from the directory |
| `get_employee` | Get details for a specific employee |
| `get_time_off_requests` | List time-off requests with filters |
| `whos_out` | See who's currently out |
| `get_time_off_balance` | Get PTO balance for an employee |
| `list_jobs` | List job openings |
| `list_applications` | List job applications |
| `get_application` | Get application details |
| `add_application_comment` | Add a comment to an application |
| `update_application_status` | Change application status |
| `list_reports` | List saved custom reports |
| `get_report` | Run a saved report |

## Setup

### 1. Get your BambooHR API key

Go to BambooHR > Account > API Keys > Add New Key

### 2. Install dependencies

```bash
cd bamboohr-mcp-server
npm install
```

### 3. Verify it compiles

```bash
npm run check
```

### 4. Add to Claude Code

Add this to your `~/.claude/settings.json` under `mcpServers`:

```json
{
  "mcpServers": {
    "bamboohr": {
      "command": "npx",
      "args": ["tsx", "/path/to/bamboohr-mcp-server/src/index.ts"],
      "env": {
        "BAMBOOHR_API_KEY": "your-api-key",
        "BAMBOOHR_COMPANY_DOMAIN": "your-company-subdomain"
      }
    }
  }
}
```

Then restart Claude Code. The 12 BambooHR tools will appear in your tool list.

## Development

```bash
npm run start    # Run the server
npm run check    # Type-check without building
npm run build    # Compile to dist/
```
