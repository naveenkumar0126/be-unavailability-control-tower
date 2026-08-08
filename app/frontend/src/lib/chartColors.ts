// Canvas-rendered charts (ECharts) can't resolve CSS custom properties in
// fillStyle - that only works for real DOM/CSS contexts (pills, KPI tiles,
// table bar-cells). Chart code must use resolved hex values instead, kept in
// sync with the --series-*/--status-* tokens in index.css. isDark is passed
// in explicitly (from useTheme()) rather than re-detected here, so charts
// re-render correctly when the user toggles the theme, not just when the OS
// setting changes.
const LIGHT = {
  series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
  muted: "#898781",
  gridline: "#e1e0d9",
};

const DARK = {
  series: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
  muted: "#898781",
  gridline: "#2c2c2a",
};

export function palette(isDark: boolean) {
  return isDark ? DARK : LIGHT;
}

export function seriesHex(isDark: boolean, slot: number): string {
  return palette(isDark).series[slot % 8];
}

export function severityHex(isDark: boolean, unavailPct: number): string {
  const p = palette(isDark);
  if (unavailPct <= 10) return p.good;
  if (unavailPct <= 25) return p.warning;
  if (unavailPct <= 45) return p.serious;
  return p.critical;
}

export function availHex(isDark: boolean, availPct: number): string {
  return severityHex(isDark, 100 - availPct);
}
