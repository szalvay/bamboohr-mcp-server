export class BambooHRClient {
  private baseUrl: string;
  private authToken: string;

  constructor(companyDomain: string, apiKey: string) {
    this.baseUrl = `https://${companyDomain}.bamboohr.com/api/gateway.php/${companyDomain}/v1`;
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

  // --- Reports ---

  async listReports(): Promise<unknown> {
    return this.request("/reports");
  }

  async getReport(reportId: string, format: string = "JSON"): Promise<unknown> {
    return this.request(`/reports/${reportId}?format=${format}&onlyCurrent=true`);
  }
}
