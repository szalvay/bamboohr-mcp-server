import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BambooHRClient } from "../client.js";
import { textResult, errorResult } from "../types.js";


export function registerAtsTools(server: McpServer, client: BambooHRClient) {
  server.tool(
    "list_jobs",
    "List job openings from BambooHR ATS",
    {
      page: z.number().optional().describe("Page number for pagination"),
      jobStatusGroups: z
        .string()
        .optional()
        .describe("Filter by status group: Draft, Open, On Hold, Filled"),
    },
    async ({ page, jobStatusGroups }) => {
      try {
        const data = await client.listJobs({ page, jobStatusGroups });
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );

  server.tool(
    "list_applications",
    "List job applications with optional filters",
    {
      page: z.number().optional().describe("Page number for pagination"),
      jobId: z.string().optional().describe("Filter by job ID"),
      applicationStatusId: z.string().optional().describe("Filter by application status ID"),
      searchString: z.string().optional().describe("Search applicants by name"),
      newSince: z
        .string()
        .optional()
        .describe("Only return applications created after this date (YYYY-MM-DDTHH:MM:SSZ)"),
    },
    async ({ page, jobId, applicationStatusId, searchString, newSince }) => {
      try {
        const data = await client.listApplications({
          page,
          jobId,
          applicationStatusId,
          searchString,
          newSince,
        });
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );

  server.tool(
    "get_application",
    "Get detailed information about a specific job application",
    {
      applicationId: z.string().describe("Application ID"),
    },
    async ({ applicationId }) => {
      try {
        const data = await client.getApplication(applicationId);
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );

  server.tool(
    "add_application_comment",
    "Add a comment to a job application",
    {
      applicationId: z.string().describe("Application ID"),
      comment: z.string().describe("Comment text to add"),
    },
    async ({ applicationId, comment }) => {
      try {
        const data = await client.addApplicationComment(applicationId, comment);
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );

  server.tool(
    "update_application_status",
    "Change the status of a job application",
    {
      applicationId: z.string().describe("Application ID"),
      statusId: z.number().describe("New status ID to set"),
    },
    async ({ applicationId, statusId }) => {
      try {
        const data = await client.updateApplicationStatus(applicationId, statusId);
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );
}
