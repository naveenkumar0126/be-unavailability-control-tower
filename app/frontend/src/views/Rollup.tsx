import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { api, type Filters, type RollupRow } from "../lib/api";
import { DataTable, type Column } from "../components/DataTable";
import { SeverityPill } from "../components/Pill";
import { severityColor, shortWh } from "../lib/format";
import { severityHex, palette } from "../lib/chartColors";
import { useTheme } from "../lib/theme";

export function Rollup({ filters, by, dataVersion }: { filters: Filters; by: "brand" | "wh" | "region"; dataVersion: number }) {
  const { isDark } = useTheme();
  const [rows, setRows] = useState<RollupRow[] | null>(null);

  useEffect(() => {
    api.rollup(by, filters).then(setRows).catch(() => setRows([]));
  }, [JSON.stringify(filters), by, dataVersion]);

  if (!rows) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;

  const keyLabel = by === "brand" ? "Brand" : by === "wh" ? "Warehouse" : "Region";
  const nameFmt = by === "wh" ? shortWh : (v: string) => v;

  const columns: Column<RollupRow>[] = [
    { key: by, label: keyLabel, left: true, render: (v) => nameFmt(v) },
    ...(by === "wh" ? [{ key: "region", label: "Region", left: true } as Column<RollupRow>] : []),
    { key: "cpd", label: "Demand (CPD)", bar: true },
    { key: "unavail_cpd", label: "Lost CPD", bar: true, defaultSort: true },
    { key: "unavail_pct", label: "Unavail % (weighted)", render: (v) => <SeverityPill value={v} color={severityColor(v)} /> },
    { key: "norm_avail", label: "Avail % (normal)", decimals: 1 },
    { key: "loss_share_pct", label: "% of network loss", decimals: 1 },
    { key: "demand_share_pct", label: "% of network demand", decimals: 1 },
    { key: "n", label: "SKUs" },
  ];

  const worst = [...rows].sort((a, b) => b.unavail_pct - a.unavail_pct).slice(0, 15);
  const c = palette(isDark);

  return (
    <div className="flex flex-col gap-4">
      <DataTable columns={columns} rows={rows} rowKey={(r) => String(r[by])} />

      <div className="card p-3">
        <h4 className="text-[12px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
          Worst {keyLabel.toLowerCase()}s by unavailability %
        </h4>
        <ReactECharts
          style={{ height: Math.max(220, worst.length * 22) }}
          option={{
            grid: { left: 140, right: 40, top: 10, bottom: 20 },
            xAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%", color: c.muted, fontSize: 10 }, splitLine: { lineStyle: { color: c.gridline } } },
            yAxis: {
              type: "category",
              data: worst.map((r) => nameFmt(String(r[by]))).reverse(),
              axisLabel: { fontSize: 10, color: c.muted },
              axisLine: { lineStyle: { color: c.gridline } },
            },
            tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
            series: [
              {
                type: "bar",
                data: worst.map((r) => ({ value: +r.unavail_pct.toFixed(1), itemStyle: { color: severityHex(isDark, r.unavail_pct) } })).reverse(),
                barMaxWidth: 14,
              },
            ],
          }}
        />
      </div>
    </div>
  );
}
