import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BambooHRClient } from "../client.js";
import { textResult, errorResult } from "../types.js";
import { archive } from "../archive.js";


export function registerEmployeeTools(server: McpServer, client: BambooHRClient) {
  server.tool(
    "list_employees",
    "List all employees from the BambooHR directory",
    {},
    async () => {
      try {
        const data = await client.getEmployeeDirectory();
        archive("list_employees", {}, data);
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );

  server.tool(
    "get_employee",
    "Get details for a specific employee by ID",
    {
      employeeId: z.string().describe("Employee ID (use '0' for the API key owner)"),
      fields: z
        .array(z.string())
        .optional()
        .describe("Specific fields to retrieve (e.g. firstName, lastName, department, hireDate)"),
    },
    async ({ employeeId, fields }) => {
      try {
        const data = await client.getEmployee(employeeId, fields);
        archive("get_employee", { employeeId, fields }, data);
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );

  server.tool(
    "ping",
    "Health check: verify the configured API key and tenant resolve to a reachable " +
      "BambooHR account. Returns { ok, tenant, employees_visible, latency_ms }. Use at the " +
      "start of a payroll run to catch expired API keys before the pipeline starts.",
    {},
    async () => {
      try {
        const data = await client.ping();
        archive("ping", {}, data);
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );
}
