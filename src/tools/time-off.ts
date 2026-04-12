import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BambooHRClient } from "../client.js";
import { textResult, errorResult } from "../types.js";


export function registerTimeOffTools(server: McpServer, client: BambooHRClient) {
  server.tool(
    "get_time_off_requests",
    "List time-off requests with optional filters",
    {
      start: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      end: z.string().optional().describe("End date (YYYY-MM-DD)"),
      status: z
        .string()
        .optional()
        .describe("Filter by status: approved, denied, superceded, requested, canceled"),
      employeeId: z.string().optional().describe("Filter by employee ID"),
    },
    async ({ start, end, status, employeeId }) => {
      try {
        const data = await client.getTimeOffRequests({ start, end, status, employeeId });
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );

  server.tool(
    "whos_out",
    "See which employees are currently out or will be out in a date range",
    {
      start: z.string().optional().describe("Start date (YYYY-MM-DD), defaults to today"),
      end: z.string().optional().describe("End date (YYYY-MM-DD), defaults to 14 days from start"),
    },
    async ({ start, end }) => {
      try {
        const data = await client.getWhosOut(start, end);
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );

  server.tool(
    "get_time_off_balance",
    "Get time-off balance for a specific employee",
    {
      employeeId: z.string().describe("Employee ID"),
      end: z.string().optional().describe("Calculate balance as of this date (YYYY-MM-DD)"),
    },
    async ({ employeeId, end }) => {
      try {
        const data = await client.getTimeOffBalance(employeeId, end);
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );
}
