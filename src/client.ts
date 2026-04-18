export class BambooHRClient {
  private baseUrl: string;
  private apiHostBaseUrl: string;
  private authToken: string;

  constructor(companyDomain: string, apiKey: string) {
    // Tenant host — works for /employees, /time_off, etc.
    this.baseUrl = `https://${companyDomain}.bamboohr.com/api/gateway.php/${companyDomain}/v1`;
    // Central API host — required for /reports/{id} (tenant host 404s on this route).
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

  /** List available datasets (e.g. employee, applicants). */
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

  /** List the queryable fields for a dataset. */
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

  /**
   * Query a dataset. Body shape: { fields: [...], filters?: {...} }.
   * Returns JSON with the selected fields for every matching record.
   */
  async queryDataset(
    dataset: string,
    fields: string[],
    filters?: unknown
  ): Promise<unknown> {
    if (!Array.isArray(fields) || fields.length === 0) {
      throw new Error("queryDataset: fields must be a non-empty array of field names.");
    }
    const url = `${this.apiHostBaseUrl}/datasets/${encodeURIComponent(dataset)}/`;
    const body: Record<string, unknown> = { fields };
    if (filters !== undefined) body.filters = filters;
    const res = await fetch(url, {
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
    return res.json();
  }

  // --- Reports (legacy shim — this tenant uses the Datasets API) ---

  /**
   * BambooHR's classic /reports/{id} endpoint is not served on this tenant.
   * Use query_dataset / list_datasets instead.
   */
  async listReports(): Promise<never> {
    throw new Error(
      "This BambooHR tenant uses the Datasets API, not the legacy /reports endpoint. " +
        "Use list_datasets to discover available datasets, list_dataset_fields(dataset) to " +
        "discover columns, and query_dataset(dataset, fields) to fetch rows."
    );
  }

  /**
   * Legacy get_report shim. BambooHR's /reports/{id} endpoint is not served on this tenant
   * (it's been replaced by the Datasets API). We map known UI report IDs to curated dataset
   * queries so existing callers keep working; everything else returns a clear migration hint.
   *
   * Known preset IDs:
   *   1 / "pay_rates"          → employee dataset, Pay Rates column set
   *   3 / "pay_rates_managers" → employee dataset, Pay Rates column set (filter managers client-side)
   *
   * For anything else, use query_dataset directly.
   */
  async getReport(reportId: string, _format: string = "JSON"): Promise<unknown> {
    const id = String(reportId).trim().toLowerCase();

    const PAY_RATES_FIELDS = [
      "firstName",
      "lastName",
      "preferredName",
      "employeeNumber",
      "status",
      "employmentStatus",
      "jobInformationJobTitle",
      "jobInformationLocation",
      "jobInformationDepartment",
      "compensationPayRate",
      "compensationPayRateCurrencyCode",
      "compensationPayType",
      "compensationPaidPer",
      "compensationOvertimeStatus",
      "hireDate",
      "terminationDate",
      "supervisorName",
      "email",
    ];

    const presets: Record<string, { dataset: string; fields: string[]; note?: string }> = {
      "1": { dataset: "employee", fields: PAY_RATES_FIELDS, note: "Pay Rates (all employees)" },
      "pay_rates": { dataset: "employee", fields: PAY_RATES_FIELDS, note: "Pay Rates (all employees)" },
      "3": {
        dataset: "employee",
        fields: PAY_RATES_FIELDS,
        note: "Pay Rates - Managers (returns all employees; filter by supervisorName/isSupervisor client-side)",
      },
      "pay_rates_managers": {
        dataset: "employee",
        fields: PAY_RATES_FIELDS,
        note: "Pay Rates - Managers (returns all employees; filter by supervisorName/isSupervisor client-side)",
      },
    };

    const preset = presets[id];
    if (!preset) {
      throw new Error(
        `get_report: reportId "${reportId}" is not a known preset on this tenant. ` +
          `Legacy /reports/{id} endpoint is not served by BambooHR here — the tenant uses the Datasets API. ` +
          `Use list_datasets / list_dataset_fields / query_dataset directly. ` +
          `Known get_report preset IDs: 1 or "pay_rates", 3 or "pay_rates_managers".`
      );
    }

    const data = await this.queryDataset(preset.dataset, preset.fields);
    return { preset: preset.note, dataset: preset.dataset, fields: preset.fields, data };
  }
}
