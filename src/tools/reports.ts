import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BambooHRClient } from "../client.js";
import { textResult, errorResult } from "../types.js";
import { archive } from "../archive.js";
import { computePayPeriod } from "../pay_period.js";


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
        archive("list_datasets", {}, data);
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
        archive("list_dataset_fields", { dataset }, data);
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );

  server.tool(
    "query_dataset",
    "Query a BambooHR dataset for rows. Body sent to BHR: { fields, filters? }. " +
      "Returns JSON with the selected fields for every matching record. This tenant " +
      "silently rejects filter shapes — omit `filters` and filter client-side, or use " +
      "the get_pay_rates / get_pay_rates_managers preset tools which do that for you.",
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
          "Optional BHR filter object. This tenant usually rejects them — prefer client-side filtering."
        ),
    },
    async ({ dataset, fields, filters }) => {
      try {
        const data = await client.queryDataset(dataset, fields, filters);
        archive("query_dataset", { dataset, fields, filters }, data);
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );

  // --- UI-shaped preset reports ---

  server.tool(
    "get_pay_rates",
    "Run the Pay Rates report (UI Report 1). Returns active employees on Hourly or " +
      "Commission Only pay types, shaped with the 9 columns from the xlsx export: " +
      "employee_number, first_name, last_name, status, pay_type, pay_rate, effective_date, " +
      "job_title, home_clinic_location. Optional clinic_code filters by location prefix " +
      "(e.g. '0367' matches '0367 Clackamas').",
    {
      clinic_code: z
        .string()
        .optional()
        .describe("Optional clinic prefix (e.g. '0367') to filter Home Clinic / Location."),
    },
    async ({ clinic_code }) => {
      try {
        const data = await client.getPayRates({ clinicCode: clinic_code });
        archive("get_pay_rates", { clinic_code }, data);
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );

  server.tool(
    "get_pay_rates_managers",
    "Run the Pay Rate - Managers report (UI Report 3). Returns active employees on " +
      "the Salary pay type, shaped with the 7 columns from the xlsx export: employee_number, " +
      "first_name, last_name, status, pay_type, pay_rate, effective_date. No Job Title or " +
      "Location columns (matches UI).",
    {},
    async () => {
      try {
        const data = await client.getPayRatesManagers();
        archive("get_pay_rates_managers", {}, data);
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );

  server.tool(
    "get_pay_period",
    "Compute the semi-monthly pay period for a reference date (defaults to today). " +
      "Mirrors the Bible's utils.compute_pay_period: if the reference date's day is " +
      ">= 16, returns the 1st–15th window of THAT month; otherwise the 16th–EOM window " +
      "of the PREVIOUS month. Returns { start, end, is_month_end_period, reference_date }. " +
      "Use to feed explicit dates into other tools without doing the math in the caller.",
    {
      reference_date: z
        .string()
        .optional()
        .describe("YYYY-MM-DD reference date. Defaults to today."),
    },
    async ({ reference_date }) => {
      try {
        const data = computePayPeriod(reference_date);
        archive("get_pay_period", { reference_date }, data);
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );

  server.tool(
    "validate_presets",
    "Check that each preset's baked-in dataset fields still exist on this tenant. " +
      "Returns a per-preset { ok, missing[] } report. Run before a payroll cycle to catch " +
      "silent BHR field renames or removals.",
    {},
    async () => {
      try {
        const data = await client.validatePresets();
        archive("validate_presets", {}, data);
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );

  // --- Legacy /reports surface (shims over the dedicated preset methods) ---

  server.tool(
    "list_reports",
    "Legacy. BambooHR's /reports endpoint is NOT served on this tenant — it uses the " +
      "Datasets API. Prefer get_pay_rates / get_pay_rates_managers / get_time_off_used_report, " +
      "or list_datasets for arbitrary queries. This tool returns a clear migration error.",
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
    "Legacy dispatcher. Routes preset IDs to the new dedicated tools. Presets: " +
      "'1' or 'pay_rates' → get_pay_rates; '3' or 'pay_rates_managers' → get_pay_rates_managers. " +
      "For new code, call the dedicated tools directly.",
    {
      reportId: z
        .string()
        .describe("Preset ID: '1', '3', 'pay_rates', or 'pay_rates_managers'."),
      format: z
        .enum(["JSON"])
        .optional()
        .default("JSON")
        .describe("Only JSON is supported."),
      clinic_code: z
        .string()
        .optional()
        .describe("Only applied when reportId is '1'/'pay_rates'. Location prefix filter."),
    },
    async ({ reportId, format, clinic_code }) => {
      try {
        const data = await client.getReport(reportId, format, { clinicCode: clinic_code });
        archive("get_report", { reportId, format, clinic_code }, data);
        return textResult(data);
      } catch (e: any) {
        return errorResult(e.message);
      }
    }
  );
}
