export function fmtNum(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  return v.toLocaleString("en-IN", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

export function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  return `${v.toFixed(decimals)}%`;
}

// Unavailability severity: higher = worse. Maps onto the fixed status palette
// (good/warning/serious/critical) rather than inventing extra hues.
export function severityColor(unavailPct: number): string {
  if (unavailPct <= 10) return "var(--status-good)";
  if (unavailPct <= 25) return "var(--status-warning)";
  if (unavailPct <= 45) return "var(--status-serious)";
  return "var(--status-critical)";
}

export function severityLabel(unavailPct: number): string {
  if (unavailPct <= 10) return "Good";
  if (unavailPct <= 25) return "Watch";
  if (unavailPct <= 45) return "Serious";
  return "Critical";
}

// Availability is the inverse of unavailability - same bands, mirrored.
export function availColor(availPct: number): string {
  return severityColor(100 - availPct);
}

export function shortWh(wh: string): string {
  return wh.replace(/^CPC ?-? ?/, "").replace(/\(HP\)/, "").trim();
}
