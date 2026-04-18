// Dataset field lists for the preset reports. Exported so validate_presets
// can introspect them without duplication.
export const PAY_RATES_FIELDS = [
  "firstName",
  "lastName",
  "employeeNumber",
  "status",
  "compensationPayType",
  "compensationPayRate",
  "compensationEffectiveDate",
  "jobInformationJobTitle",
  "jobInformationLocation",
];

export const PAY_RATES_MANAGERS_FIELDS = [
  "firstName",
  "lastName",
  "employeeNumber",
  "status",
  "compensationPayType",
  "compensationPayRate",
  "compensationEffectiveDate",
];

const PAY_RATES_COLUMNS = [
  "employee_number",
  "first_name",
  "last_name",
  "status",
  "pay_type",
  "pay_rate",
  "effective_date",
  "job_title",
  "home_clinic_location",
];

const PAY_RATES_MANAGERS_COLUMNS = [
  "employee_number",
  "first_name",
  "last_name",
  "status",
  "pay_type",
  "pay_rate",
  "effective_date",
];

const TIME_OFF_USED_COLUMNS = [
  "employee_number",
  "name",
  "category",
  "from",
  "to",
  "requested",
  "approved",
  "notes",
  "time_off",
  "units",
];

function extractRows(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as any;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.employees)) return obj.employees;
    if (Array.isArray(obj.results)) return obj.results;
  }
  return [];
}

function parseNumeric(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function shapePayRatesRow(r: any, includeJob: boolean): Record<string, unknown> {
  const row: Record<string, unknown> = {
    employee_number: r.employeeNumber ?? null,
    first_name: r.firstName ?? null,
    last_name: r.lastName ?? null,
    status: r.status ?? null,
    pay_type: r.compensationPayType ?? null,
    pay_rate: parseNumeric(r.compensationPayRate) ?? r.compensationPayRate ?? null,
    effective_date: r.compensationEffectiveDate ?? null,
  };
  if (includeJob) {
    row.job_title = r.jobInformationJobTitle ?? null;
    row.home_clinic_location = r.jobInformationLocation ?? null;
  }
  return row;
}

function normalizeNotes(notes: unknown): string | null {
  if (notes == null) return null;
  if (typeof notes === "string") return notes.trim() || null;
  if (Array.isArray(notes)) {
    const parts = notes
      .map((n) => (typeof n === "string" ? n : n?.text ?? n?.note ?? ""))
      .filter((s) => typeof s === "string" && s.trim().length > 0);
    return parts.length ? parts.join("; ") : null;
  }
  if (typeof notes === "object") {
    const vals = Object.values(notes as Record<string, unknown>).filter(
      (v) => typeof v === "string" && v.trim().length > 0
    ) as string[];
    return vals.length ? vals.join("; ") : null;
  }
  return String(notes);
}

function ymdOnly(v: unknown): string | null {
  if (!v) return null;
  const s = String(v);
  const m = s.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : s;
}

export class BambooHRClient {
  private baseUrl: string;
  private apiHostBaseUrl: string;
  private authToken: string;

  constructor(companyDomain: string, apiKey: string) {
    this.baseUrl = `https://${companyDomain}.bamboohr.com/api/gateway.php/${companyDomain}/v1`;
    this.apiHostBaseUrl = `https://api.bamboohr.com/api/gateway.php/${companyDomain}/v1`;
    this.authToken = Buffer.from(`${apiKey}:x`).toString("base64");
  }

  private async request<T = unknown>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Basic ${this.authToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`BambooHR API error ${res.status}: ${body}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : ({} as T);
  }

  // --- Employees ---

  async getEmployeeDirectory(): Promise<unknown> {
    return this.request("/employees/directory");
  }

  async getEmployee(id: string, fields?: string[]): Promise<unknown> {
    const params = new URLSearchParams();
    if (fields?.length) params.set("fields", fields.join(","));
    const qs = params.toString();
    return this.request(`/employees/${id}${qs ? `?${qs}` : ""}`);
  }

  /** Lightweight auth/connectivity check. Returns a self-describing status envelope. */
  async ping(): Promise<unknown> {
    const started = Date.now();
    try {
      const dir = (await this.getEmployeeDirectory()) as any;
      const count = Array.isArray(dir?.employees) ? dir.employees.length : null;
      return {
        ok: true,
        tenant: this.baseUrl,
        employees_visible: count,
        latency_ms: Date.now() - started,
        message: "Authenticated successfully.",
      };
    } catch (e: any) {
      return {
        ok: false,
        tenant: this.baseUrl,
        latency_ms: Date.now() - started,
        error: e.message,
      };
    }
  }

  // --- Time Off ---

  async getTimeOffRequests(params: {
    start?: string;
    end?: string;
    status?: string;
    employeeId?: string;
  }): Promise<unknown> {
    const sp = new URLSearchParams();
    if (params.start) sp.set("start", params.start);
    if (params.end) sp.set("end", params.end);
    if (params.status) sp.set("status", params.status);
    if (params.employeeId) sp.set("employeeId", params.employeeId);
    const qs = sp.toString();
    return this.request(`/time_off/requests${qs ? `?${qs}` : ""}`);
  }

  async getWhosOut(start?: string, end?: string): Promise<unknown> {
    const sp = new URLSearchParams();
    if (start) sp.set("start", start);
    if (end) sp.set("end", end);
    const qs = sp.toString();
    return this.request(`/time_off/whos_out${qs ? `?${qs}` : ""}`);
  }

  async getTimeOffBalance(employeeId: string, end?: string): Promise<unknown> {
    const sp = new URLSearchParams();
    if (end) sp.set("end", end);
    const qs = sp.toString();
    return this.request(`/employees/${employeeId}/time_off/calculator${qs ? `?${qs}` : ""}`);
  }

  /**
   * Shape approved time-off requests into the 10-column Time Off Used report
   * (BHR UI Report 13). Optional category filter (e.g. "Sick") runs client-side.
   */
  async getTimeOffUsedReport(
    start: string,
    end: string,
    category?: string
  ): Promise<unknown> {
    const raw = (await this.getTimeOffRequests({
      start,
      end,
      status: "approved",
    })) as any;
    const list: any[] = Array.isArray(raw) ? raw : raw?.requests ?? [];
    const filtered = category
      ? list.filter((r) => {
          const cat = r?.type?.name ?? r?.type ?? "";
          return String(cat).toLowerCase() === category.toLowerCase();
        })
      : list;
    const rows = filtered.map((r) => ({
      employee_number: r.employeeId ?? null,
      name: r.name ?? null,
      category: r?.type?.name ?? r?.type ?? null,
      from: ymdOnly(r.start),
      to: ymdOnly(r.end),
      requested: ymdOnly(r.created),
      approved:
        r?.status?.status === "approved" ? ymdOnly(r?.status?.lastChanged) : null,
      notes: normalizeNotes(r.notes),
      time_off: parseNumeric(r?.amount?.amount),
      units: r?.amount?.unit ?? null,
    }));
    return {
      preset: "Time Off Used (UI Report 13)",
      filters: {
        start,
        end,
        status: "approved",
        category: category ?? null,
      },
      columns: TIME_OFF_USED_COLUMNS,
      row_count: rows.length,
      rows,
    };
  }

  // --- ATS ---

  async listJobs(params?: {
    page?: number;
    jobStatusGroups?: string;
  }): Promise<unknown> {
    const sp = new URLSearchParams();
    if (params?.page) sp.set("page", String(params.page));
    if (params?.jobStatusGroups) sp.set("jobStatusGroups", params.jobStatusGroups);
    const qs = sp.toString();
    return this.request(`/applicant_tracking/jobs${qs ? `?${qs}` : ""}`);
  }

  async listApplications(params?: {
    page?: number;
    jobId?: string;
    applicationStatusId?: string;
    searchString?: string;
    newSince?: string;
  }): Promise<unknown> {
    const sp = new URLSearchParams();
    if (params?.page) sp.set("page", String(params.page));
    if (params?.jobId) sp.set("jobId", params.jobId);
    if (params?.applicationStatusId) sp.set("applicationStatusId", params.applicationStatusId);
    if (params?.searchString) sp.set("searchString", params.searchString);
    if (params?.newSince) sp.set("newSince", params.newSince);
    const qs = sp.toString();
    return this.request(`/applicant_tracking/applications${qs ? `?${qs}` : ""}`);
  }

  async getApplication(applicationId: string): Promise<unknown> {
    return this.request(`/applicant_tracking/applications/${applicationId}`);
  }

  async addApplicationComment(applicationId: string, comment: string): Promise<unknown> {
    return this.request(`/applicant_tracking/applications/${applicationId}/comments`, {
      method: "POST",
      body: JSON.stringify({ type: "comment", comment }),
    });
  }

  async updateApplicationStatus(applicationId: string, statusId: number): Promise<unknown> {
    return this.request(`/applicant_tracking/applications/${applicationId}/status`, {
      method: "POST",
      body: JSON.stringify({ status: statusId }),
    });
  }

  // --- Datasets (new reports API) ---

  async listDatasets(): Promise<unknown> {
    const url = `${this.apiHostBaseUrl}/datasets/`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${this.authToken}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const b = await res.text();
      throw new Error(`BambooHR API error ${res.status}: ${b}`);
    }
    return res.json();
  }

  async listDatasetFields(dataset: string): Promise<unknown> {
    const url = `${this.apiHostBaseUrl}/datasets/${encodeURIComponent(dataset)}/fields/`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${this.authToken}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const b = await res.text();
      throw new Error(`BambooHR API error ${res.status}: ${b}`);
    }
    return res.json();
  }

  async queryDataset(
    dataset: string,
    fields: string[],
    filters?: unknown
  ): Promise<unknown> {
    if (!Array.isArray(fields) || fields.length === 0) {
      throw new Error("queryDataset: fields must be a non-empty array of field names.");
    }
    const firstUrl = `${this.apiHostBaseUrl}/datasets/${encodeURIComponent(dataset)}/`;
    const body: Record<string, unknown> = { fields };
    if (filters !== undefined) body.filters = filters;

    const allRows: unknown[] = [];
    let aggregations: unknown = undefined;
    let pageUrl: string | null = firstUrl;
    let pageCount = 0;
    const MAX_PAGES = 50; // hard safety stop

    while (pageUrl && pageCount < MAX_PAGES) {
      const res: Response = await fetch(pageUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${this.authToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.text();
        throw new Error(`BambooHR API error ${res.status}: ${b}`);
      }
      const text = await res.text();
      if (!text) {
        // BHR returns 200 + empty body when it recognizes `filters` but rejects the
        // shape. The tenant's filter schema isn't publicly documented — we always
        // filter client-side as a result.
        if (filters !== undefined) {
          throw new Error(
            "BambooHR returned an empty body, which happens when it silently rejects " +
              "the `filters` shape. Fetch without filters and filter client-side."
          );
        }
        throw new Error("BambooHR returned an empty body for this dataset query.");
      }
      const parsed: any = JSON.parse(text);
      if (Array.isArray(parsed?.data)) {
        allRows.push(...parsed.data);
      } else if (Array.isArray(parsed)) {
        allRows.push(...parsed);
      }
      if (parsed?.aggregations !== undefined) aggregations = parsed.aggregations;
      pageUrl = parsed?.pagination?.next_page ?? null;
      pageCount++;
    }

    return {
      data: allRows,
      aggregations,
      pagination: { pages_fetched: pageCount, total_records: allRows.length },
    };
  }

  // --- Presets (UI report parity) ---

  /**
   * UI Report 1: Pay Rates. Active employees on Hourly or Commission Only pay types.
   * Returns rows shaped like the xlsx export (9 columns).
   * Optional clinicCode filters by Home Clinic / Location prefix (e.g. "0367").
   */
  async getPayRates(opts?: { clinicCode?: string }): Promise<unknown> {
    const raw = await this.queryDataset("employee", PAY_RATES_FIELDS);
    const rows = extractRows(raw);
    const filtered = rows.filter((r) => {
      if (r.status !== "Active") return false;
      const pt = r.compensationPayType;
      if (pt !== "Hourly" && pt !== "Commission Only") return false;
      if (opts?.clinicCode) {
        const loc = String(r.jobInformationLocation ?? "");
        if (!loc.startsWith(opts.clinicCode)) return false;
      }
      return true;
    });
    return {
      preset: "Pay Rates (UI Report 1)",
      dataset: "employee",
      bhr_fields: PAY_RATES_FIELDS,
      filters: {
        status: "Active",
        pay_type: ["Hourly", "Commission Only"],
        clinic_code: opts?.clinicCode ?? null,
      },
      columns: PAY_RATES_COLUMNS,
      row_count: filtered.length,
      rows: filtered.map((r) => shapePayRatesRow(r, true)),
    };
  }

  /**
   * UI Report 3: Pay Rate - Managers. Active employees on Salary pay type.
   * Returns rows shaped like the xlsx export (7 columns, no Job Title or Location).
   */
  async getPayRatesManagers(): Promise<unknown> {
    const raw = await this.queryDataset("employee", PAY_RATES_MANAGERS_FIELDS);
    const rows = extractRows(raw);
    const filtered = rows.filter(
      (r) => r.status === "Active" && r.compensationPayType === "Salary"
    );
    return {
      preset: "Pay Rate - Managers (UI Report 3)",
      dataset: "employee",
      bhr_fields: PAY_RATES_MANAGERS_FIELDS,
      filters: { status: "Active", pay_type: "Salary" },
      columns: PAY_RATES_MANAGERS_COLUMNS,
      row_count: filtered.length,
      rows: filtered.map((r) => shapePayRatesRow(r, false)),
    };
  }

  // --- Reports (legacy shim — this tenant uses the Datasets API) ---

  async listReports(): Promise<never> {
    throw new Error(
      "This BambooHR tenant uses the Datasets API, not the legacy /reports endpoint. " +
        "Use list_datasets to discover available datasets, list_dataset_fields(dataset) to " +
        "discover columns, and query_dataset(dataset, fields) to fetch rows. For the " +
        "common UI reports, use get_pay_rates / get_pay_rates_managers / get_time_off_used_report."
    );
  }

  /**
   * Legacy dispatcher. Maps UI report IDs to the new dedicated methods so
   * existing callers keep working.
   *
   *   1 / "pay_rates"           → getPayRates (optional clinic_code)
   *   3 / "pay_rates_managers"  → getPayRatesManagers
   */
  async getReport(
    reportId: string,
    _format: string = "JSON",
    opts?: { clinicCode?: string }
  ): Promise<unknown> {
    const id = String(reportId).trim().toLowerCase();
    if (id === "1" || id === "pay_rates") {
      return this.getPayRates(opts);
    }
    if (id === "3" || id === "pay_rates_managers") {
      return this.getPayRatesManagers();
    }
    throw new Error(
      `get_report: reportId "${reportId}" is not a known preset. ` +
        `Known IDs: 1 / "pay_rates", 3 / "pay_rates_managers". ` +
        `Prefer the dedicated tools get_pay_rates / get_pay_rates_managers / get_time_off_used_report, ` +
        `or use query_dataset for arbitrary queries.`
    );
  }

  /**
   * Introspect each preset's baked-in field list against the tenant's current
   * dataset schema and flag any fields that no longer exist. Run before a
   * payroll cycle to catch silent drift.
   */
  async validatePresets(): Promise<unknown> {
    const targets = [
      { preset: "pay_rates", dataset: "employee", fields: PAY_RATES_FIELDS },
      {
        preset: "pay_rates_managers",
        dataset: "employee",
        fields: PAY_RATES_MANAGERS_FIELDS,
      },
    ];
    const results: unknown[] = [];
    for (const t of targets) {
      try {
        const schema = (await this.listDatasetFields(t.dataset)) as any;
        const available = new Set<string>(
          Array.isArray(schema?.fields) ? schema.fields.map((f: any) => f.name) : []
        );
        const missing = t.fields.filter((f) => !available.has(f));
        results.push({
          preset: t.preset,
          dataset: t.dataset,
          ok: missing.length === 0,
          fields_checked: t.fields.length,
          available_fields_on_tenant: available.size,
          missing,
        });
      } catch (e: any) {
        results.push({
          preset: t.preset,
          dataset: t.dataset,
          ok: false,
          error: e.message,
        });
      }
    }
    return { checked_at: new Date().toISOString(), results };
  }
}
