import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BambooHRClient } from "./client.js";
import { registerEmployeeTools } from "./tools/employees.js";
import { registerTimeOffTools } from "./tools/time-off.js";
import { registerAtsTools } from "./tools/ats.js";
import { registerReportTools } from "./tools/reports.js";

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env file if present (fallback when env vars aren't passed)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const apiKey = process.env.BAMBOOHR_API_KEY;
const companyDomain = process.env.BAMBOOHR_COMPANY_DOMAIN;

if (!apiKey || !companyDomain) {
  console.error("Missing required env vars: BAMBOOHR_API_KEY and BAMBOOHR_COMPANY_DOMAIN");
  process.exit(1);
}

const client = new BambooHRClient(companyDomain, apiKey);

const server = new McpServer({
  name: "bamboohr",
  version: "1.0.0",
});

registerEmployeeTools(server, client);
registerTimeOffTools(server, client);
registerAtsTools(server, client);
registerReportTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
