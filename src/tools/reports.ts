import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BambooHRClient } from "../client.js";
import { textResult, errorResult } from "../types.js";


export function registerReportTools(server: McpServer, client: BambooHRClient) {
  server.tool(
    "list_reports",
    "List all saved custom reports in BambooHR",
    {},
    async () => {
      try {
        const data = await client.listReports();
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );

  server.tool(
    "get_report",
    "Run a saved custom report and return its data",
    {
      reportId: z.string().describe("Report ID"),
      format: z
        .string()
        .optional()
        .describe("Output format: JSON (default), CSV, XML, XLS, PDF"),
    },
    async ({ reportId, format }) => {
      try {
        const data = await client.getReport(reportId, format);
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );
}
