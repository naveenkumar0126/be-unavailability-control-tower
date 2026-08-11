import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { pmApi, type FestiveDimRow } from "../../lib/api";
import { DataTable, type Column } from "../../components/DataTable";
import { SeverityPill } from "../../components/Pill";
import { availColor, fmtNum } from "../../lib/format";
import { seriesHex, palette } from "../../lib/chartColors";
import { useTheme } from "../../lib/theme";

export function ByPtype() {
  const { isDark } = useTheme();
  const pal = palette(isDark);
  const [rows, setRows] = useState<FestiveDimRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pmApi
      .festiveByPtype()
      .then((d) => {
        setRows(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div style={{ color: "var(--status-critical)" }}>{error}</div>;
  if (!rows) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;

  const columns: Column<FestiveDimRow>[] = [
    { key: "ptype", label: "Product Type", left: true },
    { key: "wh_count", label: "Warehouses" },
    { key: "brand_count", label: "Brands" },
    {
      key: "at_risk_count",
      label: "At-Risk Lines",
      render: (v: number) => <span style={{ color: v > 0 ? "var(--status-critical)" : "var(--text-secondary)", fontWeight: v > 0 ? 700 : 400 }}>{v}</span>,
    },
    { key: "requirement", label: "Still Required", bar: true, defaultSort: true },
    { key: "ach_be_pct", label: "Achievement · BE", render: (v: number) => <SeverityPill value={v} color={availColor(v)} decimals={0} /> },
    { key: "ach_po_pct", label: "Achievement · +PO", render: (v: number) => <SeverityPill value={v} color={availColor(v)} decimals={0} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-lg border-l-4 px-4 py-3 text-[12px]"
        style={{ borderColor: "var(--series-1)", background: "var(--surface-1)", color: "var(--text-secondary)" }}
      >
        Every product type stocked for Sawan, side by side. Bars = units still required (left axis); lines =
        need-weighted achievement % (right axis) — the ptype with the tallest bar and lowest lines needs attention
        first.
      </div>

      <div className="card p-3">
        <ReactECharts
          style={{ height: 340 }}
          option={{
            grid: { left: 55, right: 55, top: 40, bottom: 40 },
            legend: { top: 0, textStyle: { color: pal.muted, fontSize: 10 } },
            xAxis: { type: "category", data: rows.map((r) => r.ptype), axisLabel: { color: pal.muted, fontSize: 11 }, axisLine: { lineStyle: { color: pal.gridline } } },
            yAxis: [
              {
                type: "value",
                name: "Still Required",
                nameTextStyle: { color: pal.muted, fontSize: 10 },
                axisLabel: { color: pal.muted, fontSize: 10 },
                splitLine: { lineStyle: { color: pal.gridline } },
              },
              {
                type: "value",
                name: "Achievement %",
                max: 100,
                nameTextStyle: { color: pal.muted, fontSize: 10 },
                axisLabel: { color: pal.muted, fontSize: 10 },
                splitLine: { show: false },
              },
            ],
            tooltip: { trigger: "axis" },
            series: [
              {
                name: "Still Required",
                type: "bar",
                barMaxWidth: 70,
                itemStyle: { color: seriesHex(isDark, 3) },
                data: rows.map((r) => Math.round(r.requirement)),
              },
              {
                name: "Achievement · BE",
                type: "line",
                yAxisIndex: 1,
                symbol: "circle",
                symbolSize: 7,
                lineStyle: { width: 2.5, color: seriesHex(isDark, 0) },
                itemStyle: { color: seriesHex(isDark, 0) },
                data: rows.map((r) => +r.ach_be_pct.toFixed(1)),
              },
              {
                name: "Achievement · +PO",
                type: "line",
                yAxisIndex: 1,
                symbol: "circle",
                symbolSize: 7,
                lineStyle: { width: 2.5, color: seriesHex(isDark, 2) },
                itemStyle: { color: seriesHex(isDark, 2) },
                data: rows.map((r) => +r.ach_po_pct.toFixed(1)),
              },
            ],
          }}
        />
      </div>

      <DataTable columns={columns} rows={rows} rowKey={(r) => r.ptype ?? ""} />

      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${rows.length}, 1fr)` }}>
        {rows.map((r) => (
          <div key={r.ptype} className="card px-3.5 py-3">
            <div className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
              {r.ptype}
            </div>
            <div className="text-[11px] mt-1" style={{ color: "var(--text-secondary)" }}>
              {fmtNum(r.requirement)} units still needed across {r.wh_count} warehouses
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {r.brand_count} brand{r.brand_count === 1 ? "" : "s"} ·{" "}
              <span style={{ color: r.at_risk_count > 0 ? "var(--status-critical)" : "var(--text-secondary)" }}>
                {r.at_risk_count} at-risk
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
