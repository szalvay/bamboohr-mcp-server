import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BambooHRClient } from "../client.js";
import { textResult, errorResult } from "../types.js";


export function registerReportTools(server: McpServer, client: BambooHRClient) {
  // --- Datasets API (the modern reports surface) ---

  server.tool(
    "list_datasets",
    "List the BambooHR datasets available on this tenant (e.g. employee, applicants). " +
      "Use list_dataset_fields(dataset) next to see which columns you can request, then " +
      "query_dataset(dataset, fields) to pull rows.",
    {},
    async () => {
      try {
        const data = await client.listDatasets();
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );

  server.tool(
    "list_dataset_fields",
    "List the queryable fields for a BambooHR dataset. Returns an object with a `fields` " +
      "array of { name, label, entityName, parentName } entries. Use the `name` values in " +
      "query_dataset.",
    {
      dataset: z
        .string()
        .describe("Dataset name from list_datasets (e.g. 'employee', 'applicants')."),
    },
    async ({ dataset }) => {
      try {
        const data = await client.listDatasetFields(dataset);
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );

  server.tool(
    "query_dataset",
    "Query a BambooHR dataset for rows. Body sent to BHR: { fields, filters? }. " +
      "Returns JSON with the selected fields for every matching record. Replaces the legacy " +
      "get_report / custom-report-id workflow on tenants that have migrated to Datasets.",
    {
      dataset: z
        .string()
        .describe("Dataset name (e.g. 'employee', 'applicants')."),
      fields: z
        .array(z.string())
        .min(1)
        .describe("Field names to return. Find valid values via list_dataset_fields."),
      filters: z
        .any()
        .optional()
        .describe(
          "Optional BHR filter object. Example: { match: 'all', fields: [{ name:'status', operator:'equal', value:'Active' }] }."
        ),
    },
    async ({ dataset, fields, filters }) => {
      try {
        const data = await client.queryDataset(dataset, fields, filters);
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );

  // --- Legacy /reports surface (shims over Datasets) ---

  server.tool(
    "list_reports",
    "Legacy. BambooHR's /reports endpoint is NOT served on this tenant — it uses the " +
      "Datasets API. Call list_datasets instead. This tool returns a clear migration error.",
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
    "Legacy compatibility shim. The classic /reports/{id} endpoint is not served on this " +
      "tenant. This tool accepts only curated preset IDs and runs the equivalent dataset " +
      "query. Presets: '1' or 'pay_rates' → Pay Rates (all employees); '3' or " +
      "'pay_rates_managers' → same columns (filter managers client-side). For anything " +
      "else, use query_dataset directly.",
    {
      reportId: z
        .string()
        .describe("Preset ID: '1', '3', 'pay_rates', or 'pay_rates_managers'."),
      format: z
        .enum(["JSON"])
        .optional()
        .default("JSON")
        .describe("Only JSON is supported via the dataset shim."),
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
