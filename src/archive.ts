import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Write a raw tool response to the archive directory, if configured.
 *
 * Activated by setting BAMBOOHR_ARCHIVE_PATH. Layout:
 *   {BAMBOOHR_ARCHIVE_PATH}/{YYYY-MM-DD}/{ISO-timestamp}_{tool}.json
 *
 * Each file contains { tool, args, timestamp, response } so a payroll run can
 * be reconstructed or diffed later. Fire-and-forget: failures are logged to
 * stderr but never propagate — archival must never break a live tool call.
 */
export function archive(tool: string, args: unknown, response: unknown): void {
  const archivePath = process.env.BAMBOOHR_ARCHIVE_PATH;
  if (!archivePath) return;

  try {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const stamp = now.toISOString().replace(/[:.]/g, "-");
    const dir = join(archivePath, date);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${stamp}_${tool}.json`);
    const payload = {
      tool,
      args,
      timestamp: now.toISOString(),
      response,
    };
    writeFileSync(file, JSON.stringify(payload, null, 2), "utf-8");
  } catch (e: any) {
    console.error(`[archive] failed to write ${tool} response: ${e.message}`);
  }
}
