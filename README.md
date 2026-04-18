# BambooHR MCP Server

A Model Context Protocol (MCP) server that exposes BambooHR API functionality as tools for Claude Code.

## Tools

### Employees
| Tool | Description |
|------|-------------|
| `list_employees` | List all employees from the directory |
| `get_employee` | Get details for a specific employee |
| `ping` | Verify API key + tenant reachable; returns latency and visible employee count |

### Time Off
| Tool | Description |
|------|-------------|
| `get_time_off_requests` | List time-off requests with filters |
| `whos_out` | See who's currently out |
| `get_time_off_balance` | Get PTO balance for an employee |
| `get_time_off_used_report` | **Preset:** UI Report 13 shape (10 flat columns), auto-resolves pay period |

### Reports / Datasets
| Tool | Description |
|------|-------------|
| `get_pay_rates` | **Preset:** UI Report 1 (active + Hourly/Commission), 9 columns; optional `clinic_code` filter |
| `get_pay_rates_managers` | **Preset:** UI Report 3 (active + Salary), 7 columns |
| `get_pay_period` | Semi-monthly pay period math (1–15 or 16–EOM) for a reference date |
| `validate_presets` | Check preset field lists against the tenant schema; flags drift |
| `list_datasets` | List available datasets |
| `list_dataset_fields` | List queryable fields for a dataset |
| `query_dataset` | Raw dataset query with arbitrary field list |
| `list_reports` | Legacy — returns migration hint |
| `get_report` | Legacy dispatcher — routes `'1'`/`'pay_rates'` and `'3'`/`'pay_rates_managers'` to the preset tools |

### ATS
| Tool | Description |
|------|-------------|
| `list_jobs` | List job openings |
| `list_applications` | List job applications |
| `get_application` | Get application details |
| `add_application_comment` | Add a comment to an application |
| `update_application_status` | Change application status |

## Preset reports

Three UI reports are exposed as dedicated tools, returning rows in the same shape as BambooHR's xlsx export:

**`get_pay_rates`** (UI Report 1)
Filters: `status = Active`, `compensationPayType ∈ {Hourly, Commission Only}`.
Columns: `employee_number, first_name, last_name, status, pay_type, pay_rate, effective_date, job_title, home_clinic_location`.
Optional `clinic_code` narrows by Home Clinic / Location prefix (e.g. `"0367"` matches `"0367 Clackamas"`).

**`get_pay_rates_managers`** (UI Report 3)
Filters: `status = Active`, `compensationPayType = Salary`.
Columns: `employee_number, first_name, last_name, status, pay_type, pay_rate, effective_date`.
No Job Title or Location columns — matches the UI.

**`get_time_off_used_report`** (UI Report 13)
Filters: `status = approved` in a date window. Optional `category` (case-insensitive, e.g. `"Sick"`).
Columns: `employee_number, name, category, from, to, requested, approved, notes, time_off, units`.
Accepts either explicit `start`+`end` or `reference_date` (auto-resolves via `get_pay_period`).

> All tenant filters run client-side. BambooHR's Datasets API silently rejects `filters` payloads on this tenant, so `query_dataset` should be called without filters.

## Pay period helper

`get_pay_period(reference_date?)` returns `{ start, end, is_month_end_period, reference_date }` using semi-monthly semantics:

- Reference day **≥ 16** → `1st–15th` of **that** month (mid-month run)
- Reference day **< 16** → `16th–EOM` of the **previous** month (month-end run; `is_month_end_period = true`)

Mirrors the Bible's `utils.compute_pay_period`. The report tools accept `reference_date` directly so callers don't need to do the math.

## Archival

Set `BAMBOOHR_ARCHIVE_PATH` to an absolute directory and every tool response will be written to:

```
{BAMBOOHR_ARCHIVE_PATH}/YYYY-MM-DD/{ISO-timestamp}_{tool}.json
```

Each file contains `{ tool, args, timestamp, response }`. Archival is fire-and-forget — failures log to stderr but never break a live call. Use this for a forensic trail on payroll runs.

## Setup

### 1. Get your BambooHR API key

Go to BambooHR > Account > API Keys > Add New Key

### 2. Install dependencies

```bash
cd bamboohr-mcp-server
npm install
```

### 3. Verify it compiles

```bash
npm run check
```

### 4. Add to Claude Code

Add this to your `~/.claude/settings.json` under `mcpServers`:

```json
{
  "mcpServers": {
    "bamboohr": {
      "command": "npx",
      "args": ["tsx", "/path/to/bamboohr-mcp-server/src/index.ts"],
      "env": {
        "BAMBOOHR_API_KEY": "your-api-key",
        "BAMBOOHR_COMPANY_DOMAIN": "your-company-subdomain",
        "BAMBOOHR_ARCHIVE_PATH": "/path/to/archive/dir"
      }
    }
  }
}
```

`BAMBOOHR_ARCHIVE_PATH` is optional. Restart Claude Code after editing.

## Development

```bash
npm run start    # Run the server
npm run check    # Type-check without building
npm run build    # Compile to dist/
```
