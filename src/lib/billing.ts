export type SessionTimerState = {
  startedAt: Date | string;
  pausedAt: Date | string | null;
  totalPausedMs: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
};

/** Elapsed playable milliseconds (excludes pause time). */
export function getElapsedMs(
  session: SessionTimerState,
  now: Date = new Date(),
): number {
  if (session.status === "COMPLETED" || session.status === "CANCELLED") {
    return 0;
  }

  const started = new Date(session.startedAt).getTime();
  let pausedMs = session.totalPausedMs;

  if (session.status === "PAUSED" && session.pausedAt) {
    pausedMs += now.getTime() - new Date(session.pausedAt).getTime();
  }

  return Math.max(0, now.getTime() - started - pausedMs);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Club settings rates are the source of truth for new games. */
export function resolveHourlyRate(params: {
  isVip: boolean;
  defaultHourlyRate: unknown;
  vipHourlyRate: unknown;
  tableHourlyRate?: unknown;
}): number {
  const fromSettings = params.isVip
    ? toNumber(params.vipHourlyRate)
    : toNumber(params.defaultHourlyRate);
  if (fromSettings > 0) return fromSettings;
  const fallback = toNumber(params.tableHourlyRate);
  return fallback > 0 ? fallback : 0;
}

/**
 * Billable charge from elapsed ms and hourly rate.
 * Rounds up to billingIncrementSeconds, applies minimumCharge.
 * Keeps 2 decimal places for live/incremental estimates.
 * Call `roundMoney()` when locking the final bill on stop.
 */
export function calculateTableCharge(params: {
  elapsedMs: number;
  hourlyRate: number;
  minimumCharge?: number;
  billingIncrementSeconds?: number;
}): number {
  const {
    elapsedMs,
    hourlyRate,
    minimumCharge = 0,
    billingIncrementSeconds = 1,
  } = params;

  const incrementMs = Math.max(1, billingIncrementSeconds) * 1000;
  const billableMs =
    elapsedMs === 0 ? 0 : Math.ceil(elapsedMs / incrementMs) * incrementMs;
  const hours = billableMs / (1000 * 60 * 60);
  const raw = hours * hourlyRate;
  const withMinimum = Math.max(
    raw,
    minimumCharge > 0 && elapsedMs > 0 ? minimumCharge : 0,
  );
  return Math.round(withMinimum * 100) / 100;
}

/** Round any money amount to the nearest whole currency unit (final bill). */
export function roundMoney(amount: number): number {
  return Math.round(toNumber(amount));
}

export function money(
  amount: number,
  symbol = "Rs",
  opts?: { whole?: boolean },
): string {
  const value = opts?.whole ? roundMoney(amount) : toNumber(amount);
  return `${symbol} ${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: opts?.whole ? 0 : 2,
  })}`;
}

export function periodRange(
  period: "day" | "month" | "year",
  reference: Date = new Date(),
): { start: Date; end: Date } {
  const ref = new Date(reference);
  // Normalize to local calendar date parts
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = ref.getDate();

  if (period === "day") {
    const start = new Date(y, m, d, 0, 0, 0, 0);
    const end = new Date(y, m, d, 23, 59, 59, 999);
    return { start, end };
  }

  if (period === "month") {
    const start = new Date(y, m, 1, 0, 0, 0, 0);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  const start = new Date(y, 0, 1, 0, 0, 0, 0);
  const end = new Date(y, 11, 31, 23, 59, 59, 999);
  return { start, end };
}

/** Parse YYYY-MM-DD as a local calendar date (avoids UTC shift). */
export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  const date = new Date(y, m, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

export function toDateInputValue(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
