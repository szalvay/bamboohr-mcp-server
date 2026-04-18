/**
 * Semi-monthly pay period math. Mirrors the Bible's utils.compute_pay_period
 * so MCP callers and the Python pipeline agree on window boundaries.
 *
 *   ref.day >= 16  →  1st through 15th of THIS month     (mid-month run)
 *   ref.day < 16   →  16th through EOM of PREVIOUS month (month-end run)
 *
 * `is_month_end_period` is true for the 16-EOM window — the Bible uses it to
 * gate product and membership commission tabs.
 */
export interface PayPeriod {
  start: string;
  end: string;
  is_month_end_period: boolean;
  reference_date: string;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function lastDayOfMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

export function computePayPeriod(referenceDate?: string): PayPeriod {
  const ref = referenceDate ? new Date(`${referenceDate}T00:00:00Z`) : new Date();
  if (isNaN(ref.getTime())) {
    throw new Error(`computePayPeriod: invalid reference_date "${referenceDate}" (expected YYYY-MM-DD).`);
  }

  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  const day = ref.getUTCDate();

  if (day >= 16) {
    return {
      start: `${y}-${pad(m + 1)}-01`,
      end: `${y}-${pad(m + 1)}-15`,
      is_month_end_period: false,
      reference_date: ymd(ref),
    };
  }

  const prevMonth0 = m === 0 ? 11 : m - 1;
  const prevYear = m === 0 ? y - 1 : y;
  const eom = lastDayOfMonth(prevYear, prevMonth0);
  return {
    start: `${prevYear}-${pad(prevMonth0 + 1)}-16`,
    end: `${prevYear}-${pad(prevMonth0 + 1)}-${pad(eom)}`,
    is_month_end_period: true,
    reference_date: ymd(ref),
  };
}

/**
 * Resolve a { start, end } window: explicit dates win, otherwise fall back to
 * the pay period derived from reference_date (or today).
 */
export function resolveWindow(args: {
  start?: string;
  end?: string;
  reference_date?: string;
}): { start: string; end: string; derived: boolean; period?: PayPeriod } {
  if (args.start && args.end) {
    return { start: args.start, end: args.end, derived: false };
  }
  const period = computePayPeriod(args.reference_date);
  return { start: period.start, end: period.end, derived: true, period };
}
