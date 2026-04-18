import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BambooHRClient } from "../client.js";
import { textResult, errorResult } from "../types.js";
import { archive } from "../archive.js";
import { resolveWindow } from "../pay_period.js";


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
        archive("get_time_off_requests", { start, end, status, employeeId }, data);
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
        archive("whos_out", { start, end }, data);
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
        archive("get_time_off_balance", { employeeId, end }, data);
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );

  server.tool(
    "get_time_off_used_report",
    "Run the Time Off Used report (UI Report 13). Returns approved time-off requests in " +
      "the given window, flattened to the 10 xlsx columns: employee_number, name, category, " +
      "from, to, requested, approved, notes, time_off, units. " +
      "Supply start+end directly, or supply reference_date (or nothing) to auto-resolve the " +
      "current pay period via compute_pay_period. Optional category filter (e.g. 'Sick') " +
      "limits to one time-off type.",
    {
      start: z.string().optional().describe("Window start (YYYY-MM-DD). Pair with `end`."),
      end: z.string().optional().describe("Window end (YYYY-MM-DD). Pair with `start`."),
      reference_date: z
        .string()
        .optional()
        .describe("Alternative to start/end: resolve the pay period from this date (defaults to today)."),
      category: z
        .string()
        .optional()
        .describe("Optional category name filter (case-insensitive), e.g. 'Sick'."),
    },
    async ({ start, end, reference_date, category }) => {
      try {
        const win = resolveWindow({ start, end, reference_date });
        const data = await client.getTimeOffUsedReport(win.start, win.end, category);
        archive(
          "get_time_off_used_report",
          { start, end, reference_date, category, resolved_window: win },
          data
        );
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );
}
