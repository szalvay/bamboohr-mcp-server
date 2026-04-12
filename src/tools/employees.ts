import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BambooHRClient } from "../client.js";
import { textResult, errorResult } from "../types.js";


export function registerEmployeeTools(server: McpServer, client: BambooHRClient) {
  server.tool(
    "list_employees",
    "List all employees from the BambooHR directory",
    {},
    async () => {
      try {
        const data = await client.getEmployeeDirectory();
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
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );
}
