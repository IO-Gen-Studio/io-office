// UK formatting helpers. All currency in GBP, dates dd/mm/yyyy.

export function formatGBP(n: number | string | null | undefined, opts: { decimals?: boolean } = {}): string {
  if (n === null || n === undefined || n === "") return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  }).format(v);
}

/** Accepts ISO date (yyyy-mm-dd), full ISO timestamp, or Date. Returns dd/mm/yyyy or "—". */
export function formatDateUK(input: string | Date | null | undefined): string {
  if (!input) return "—";
  let d: Date;
  if (input instanceof Date) d = input;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, day] = input.split("-").map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(input);
  }
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatDateTimeUK(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  const date = formatDateUK(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${date} ${hh}:${mm}`;
}

/** Relative time, e.g. "3 hours ago". */
export function relativeTimeUK(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = (Date.now() - d.getTime()) / 1000;
  const abs = Math.abs(diff);
  const past = diff >= 0;
  const fmt = (v: number, unit: string) => `${Math.floor(v)} ${unit}${Math.floor(v) === 1 ? "" : "s"} ${past ? "ago" : "from now"}`;
  if (abs < 60) return past ? "just now" : "in a moment";
  if (abs < 3600) return fmt(abs / 60, "minute");
  if (abs < 86400) return fmt(abs / 3600, "hour");
  if (abs < 2592000) return fmt(abs / 86400, "day");
  if (abs < 31536000) return fmt(abs / 2592000, "month");
  return fmt(abs / 31536000, "year");
}
