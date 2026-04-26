// Lightweight formatters used across dashboards. Centralised so we
// stay consistent — currency in INR, area in sq m, dates in IST.

export function formatINR(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(n: number, fractionDigits = 0): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(n);
}

export function formatArea(sqM: number): string {
  if (!Number.isFinite(sqM)) return "—";
  if (sqM >= 10000) return `${formatNumber(sqM / 10000, 2)} ha`;
  return `${formatNumber(sqM, 0)} sq m`;
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function relativeFromNow(iso?: string): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const day = 1000 * 60 * 60 * 24;
  const hr = 1000 * 60 * 60;
  if (abs < hr) return ms >= 0 ? "in <1h" : "<1h ago";
  if (abs < day) {
    const h = Math.round(abs / hr);
    return ms >= 0 ? `in ${h}h` : `${h}h ago`;
  }
  const d = Math.round(abs / day);
  return ms >= 0 ? `in ${d}d` : `${d}d ago`;
}

export function daysBetween(a?: string, b?: string): number {
  if (!a || !b) return 0;
  const day = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / day));
}

export function titleCase(s: string): string {
  return s
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
