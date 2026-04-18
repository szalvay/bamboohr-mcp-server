# BambooHR MCP — Patch Brief

**Author:** Claude (Cowork session, 2026-04-17)
**Target repo:** `C:\Users\szalv\Desktop\claude code\bamboohr-mcp-server\` (or wherever your BHR MCP lives — check `claude_desktop_config.json` / MCP manifest for the exact path)
**Scope:** Two related defects discovered during TouchPoint payroll period 4/1–4/15 that block automated report pulls.
**Priority:** Medium. The payroll build itself is NOT blocked — it uses `--bhr-source api` which calls BambooHR directly via Python. This brief fixes the *MCP convenience layer* so Claude/Cowork can hand Laszlo finished Excel files without touching the payroll build.

---

## TL;DR

Two MCP endpoints return HTTP 404 against TouchPoint's BambooHR tenant:

| # | Endpoint | Call | Result |
|---|---|---|---|
| 1 | `list_reports` | `mcp__bamboohr__list_reports()` | `404 Route Not Found` |
| 2 | `get_report` | `mcp__bamboohr__get_report(reportId=1)` | `404` (also 3, -13, with and without `format` param) |

Both come back as "Route Not Found" style 404s, which strongly suggests the MCP is hitting the wrong BambooHR API path — *not* a permission issue and *not* a missing report.

---

## Defect 1 — `list_reports` returns 404

### Observed symptoms

```
> mcp__bamboohr__list_reports()
Error: BambooHR API error 404: {"error_msg":"404 Route Not Found"}
```

### Likely root cause

BambooHR's public v1 API **does not expose a `GET /reports` listing endpoint** the way most APIs do. Saved custom reports are discoverable via:

- **The in-app URL** (`/app/reports/{id}`) — which is what Laszlo sent us
- **The metadata API** — `GET /api/gateway.php/{subdomain}/v1/meta/users/` and related `meta/` endpoints

If the MCP's `list_reports` handler is calling something like `GET /v1/reports/` or `GET /v1/reports/list`, BambooHR returns a 404 because that route simply doesn't exist.

### Fix strategy

Two acceptable resolutions:

**Option A (recommended): Remove the endpoint and document the limitation.**
Update the MCP's tool description for `list_reports` to say: *"Not supported by BambooHR API. To find report IDs, open BHR in a browser and read the ID from the URL: `/app/reports/{id}`."*

**Option B: Implement via metadata scraping.**
If BHR has a meta-reports endpoint (check their [API docs](https://documentation.bamboohr.com/reference/)), call that. Otherwise, this is not feasible without authenticated HTML scraping of `/app/reports/`, which is fragile.

### Test plan

After the fix, calling `list_reports` should either:
- Return a clear error message explaining the limitation (Option A), or
- Return the actual list of custom reports (Option B — only if BHR exposes an endpoint for it)

Neither outcome should be a raw 404.

---

## Defect 2 — `get_report` returns 404 for ALL report IDs

### Observed symptoms

```
> mcp__bamboohr__get_report(reportId=1, format="XLS")      → 404
> mcp__bamboohr__get_report(reportId=1, format="JSON")     → 404
> mcp__bamboohr__get_report(reportId=1)                     → 404 (no format)
> mcp__bamboohr__get_report(reportId=3, format="JSON")     → 404
> mcp__bamboohr__get_report(reportId=-13, format="JSON")   → 404: "Oops! That page does not exist."
```

Laszlo confirmed these reports exist and open fine in the UI:
- ID `1` → Pay Rates (all employees)
- ID `3` → Pay Rates - Managers
- ID `-13` → Time Off Used (a **built-in** report, not custom; negative IDs indicate BHR built-ins)

Three different IDs returning 404 = the handler is broken, not the data.

### Likely root cause — three candidate bugs

Inspect `get_report` in the MCP source. The handler is probably calling one of these:

**Candidate A — Wrong URL template (most likely):**
```python
# WRONG — this is a non-existent route
url = f"{base}/reports/{report_id}"
```

The correct v1 API URL for a **custom saved report** is:
```
GET /api/gateway.php/{subdomain}/v1/reports/{report_id}?format={format}&fd=yes
```

Key details:
- `format` is **required**, not optional. Must be one of: `CSV`, `PDF`, `XLS`, `XML`, `JSON`.
- `fd=yes` (fields as duplicates) is recommended to preserve column order.
- The response is **binary** (for XLS/PDF) or text (CSV/XML/JSON) — NOT a wrapped JSON envelope. The handler must return raw bytes or text, not `resp.json()`.

Reference: <https://documentation.bamboohr.com/reference/request-custom-report-1>

**Candidate B — Missing `format` default that BHR requires:**
If the handler calls the URL without `format=...` at all, BHR rejects with 404 (not 400, oddly). Even the "default" case needs `?format=JSON`.

**Candidate C — Built-in reports use a different endpoint:**
Negative report IDs (like `-13` for Time Off Used) are **BHR built-ins** and may not be accessible via `/v1/reports/{id}` at all. The built-in "Time Off Used" report is accessible via the UI URL `/reports/time-off-used/-13` but the public API equivalent is `GET /v1/time_off/requests/` with filters (see Bible's `bamboohr_api.py` which uses this exact endpoint).

### Fix strategy

1. **Verify the URL template** against BHR's public API docs. The URL should be:
   ```
   f"{BASE}/reports/{report_id}?format={format}&fd=yes"
   ```
   where `BASE = "https://api.bamboohr.com/api/gateway.php/{subdomain}/v1"`.

2. **Require `format` parameter.** Either make it required in the tool schema, or default to `"JSON"` server-side before constructing the URL.

3. **Return raw bytes for binary formats.** `XLS` and `PDF` are binary — the handler needs to save them to disk or base64-encode before returning through MCP. **Do not** call `resp.json()` on a binary response; it'll crash with a JSON decode error (and possibly mask as 404 depending on error handling).

4. **Reject negative IDs with a clear message.** Built-in reports like `-13` (Time Off Used) are NOT fetchable via `/reports/{id}`. Add validation:
   ```python
   if int(report_id) < 0:
       raise ValueError(
           f"Report ID {report_id} is a BHR built-in. Custom report API only supports positive IDs. "
           f"Use the `get_time_off_requests` tool for time off data."
       )
   ```

### Test plan

After the fix, these three calls should all succeed:

| Call | Expected |
|---|---|
| `get_report(1, format="XLS")` | Binary XLS — all employees with pay rates. File should match what you'd see downloading from `/app/reports/1` in the UI. |
| `get_report(3, format="XLS")` | Binary XLS — 5 salaried managers. |
| `get_report(1, format="JSON")` | JSON with fields, employee rows, ~114 records. |
| `get_report(-13)` | Clear error: *"Use get_time_off_requests for built-in time-off reports."* |

Regression check: every other endpoint (`list_employees`, `get_employee`, `get_time_off_requests`, `get_time_off_balance`, etc.) currently works against TouchPoint's tenant — do not regress those.

---

## Verification environment

TouchPoint BHR tenant details (already configured in the MCP):
- **Subdomain:** `touchpoint`
- **API key:** stored in env var (likely `BAMBOOHR_API_KEY`)
- **Auth:** HTTP Basic, username = api_key, password = `x` (BHR convention)

Known-good reference: `2026_04_15/Bible_BHR_API/extraction/bamboohr_api.py` calls the v1 API directly and works — use it as a reference for correct URL patterns and auth.

---

## Suggested execution order

1. **Fix Defect 2 first.** This unblocks `get_report` for the two pay rate reports (IDs 1 and 3), which is the highest-value workflow.
2. **Fix Defect 1 second.** Lower priority — `list_reports` is nice-to-have; Laszlo can always read report IDs from the UI URL.
3. **Add a `get_time_off_report` convenience tool** (optional). Since built-in time-off reports aren't accessible via `/reports/{id}`, consider exposing a purpose-built tool that wraps `GET /time_off/requests/` and shapes the output to match the UI's "Time Off Used" report.

---

## Files for reference while patching

In the payroll workspace:

- `2026_04_15/Bible_BHR_API/extraction/bamboohr_api.py` — working Python reference: correct URL patterns, auth, threading, response parsing for employees and time-off requests
- `2026_04_15/Bible_BHR_API/CLAUDE.md` — search for `bhr_api` to see how the adapter is configured

Public API docs:
- Custom reports: <https://documentation.bamboohr.com/reference/request-custom-report-1>
- Time off requests: <https://documentation.bamboohr.com/reference/time-off-requests-get>
- Employee directory: <https://documentation.bamboohr.com/reference/get-employees-directory>

---

## Out of scope for this brief

- **Rate limiting** — BHR allows ~100 req/sec per tenant. Not an issue at TouchPoint's scale.
- **Pagination** — BHR returns all records inline for the endpoints we use; no pagination needed.
- **Field selection** — the `fd=yes` flag handles duplicate field names in custom reports. Leave default behavior unless there's a specific complaint.

---

## Resolution (2026-04-17, same day)

**The original hypothesis was wrong.** The problem was not URL shape, not binary handling, not the `format` param, and not the API key's permissions. `/reports/{id}` returns 404 on the TouchPoint tenant regardless of how you call it — confirmed via PowerShell `Invoke-WebRequest` against multiple URL variants (`/reports/1`, `/reports/1/`, `/reports/custom/1`, `/reports/company/1`, `/company_reports/1`, with and without `fd=yes`, against both `api.bamboohr.com` and the tenant host). All 404.

### Actual root cause

TouchPoint's BambooHR tenant has migrated to the **Datasets API** and no longer serves the classic `/reports/{id}` endpoint. Probing `/datasets/` returned 200 with `{"datasets":[{"name":"employee","label":"Employee"},{"name":"applicants","label":"Applicants"}]}`. The `employee` dataset exposes 442 queryable fields including `compensationPayRate`, `jobInformationLocation`, `status`, `supervisorName`, etc. — exactly the columns the UI's "Pay Rates" report shows.

### What shipped

Commit `e1e829d` on `szalvay/bamboohr-mcp-server@master`:

- **Three new MCP tools** (the path forward):
  - `list_datasets` → `GET /v1/datasets/`
  - `list_dataset_fields(dataset)` → `GET /v1/datasets/{name}/fields/`
  - `query_dataset(dataset, fields, filters?)` → `POST /v1/datasets/{name}/` with body `{fields, filters?}`
- **Legacy compat**: `list_reports` now returns a clear "use Datasets API" error; `get_report` was preserved as a thin shim that maps preset IDs `1` / `pay_rates` and `3` / `pay_rates_managers` to a curated employee-dataset query (18 columns matching the UI's Pay Rates report). Any other `reportId` returns a migration hint pointing at `query_dataset`.
- **URL correction** (still valuable for future Datasets calls): report-related paths now go to `api.bamboohr.com` rather than the tenant host, which 404s on any `/reports/*` or `/datasets/*` route.

### Why the brief was off

The brief assumed BHR's documented `/reports/{id}` contract held on this tenant. It doesn't. No amount of code-level fiddling would have made that endpoint respond — the route simply doesn't exist here. The only signal we had initially was `404 Route Not Found`, which is indistinguishable between "wrong URL shape" and "endpoint retired." PowerShell probing against the candidate endpoints was what isolated it.

### Notes for future MCP work

- `filters` body shape for `query_dataset` has not yet been tested end-to-end. Server-side filtering should follow BHR's conventional `{match: "all"|"any", fields: [{name, operator, value}]}` structure, but verify with a one-off probe before relying on it.
- Binary (XLS/PDF) output via the Datasets API has not been explored — Datasets returns JSON only. If binary exports are needed later, look at `/employees/directory` style endpoints or re-check whether `/reports/*` has been turned back on.
- Built-in reports (negative IDs like `-13` for Time Off Used) remain accessible only via their dedicated endpoints (e.g. `get_time_off_requests`), not via `get_report`.
