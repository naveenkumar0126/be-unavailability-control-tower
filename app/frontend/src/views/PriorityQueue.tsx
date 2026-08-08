import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { api, type Filters, type PriorityRow } from "../lib/api";
import { DataTable, type Column } from "../components/DataTable";
import { SeverityPill } from "../components/Pill";
import { fmtNum, severityColor, shortWh } from "../lib/format";
import { seriesHex, palette } from "../lib/chartColors";
import { useTheme } from "../lib/theme";

export function PriorityQueue({ filters, dataVersion }: { filters: Filters; dataVersion: number }) {
  const { isDark } = useTheme();
  const c = palette(isDark);
  const [rows, setRows] = useState<PriorityRow[] | null>(null);

  useEffect(() => {
    api.priorityQueue(filters, 15).then(setRows).catch(() => setRows([]));
  }, [JSON.stringify(filters), dataVersion]);

  if (!rows) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;

  let run = 0;
  const totalLoss = rows.reduce((s, r) => s + r.unavail_cpd, 0) || 1;
  const pareto = rows.slice(0, 15).map((r) => {
    const share = (r.unavail_cpd / totalLoss) * 100;
    run += share;
    return { label: `${shortWh(r.wh)} · ${r.brand}`, share, cum: run };
  });

  const columns: Column<PriorityRow>[] = [
    { key: "wh", label: "Warehouse", left: true, render: (v) => shortWh(v) },
    { key: "brand", label: "Brand", left: true },
    { key: "region", label: "Region", left: true },
    { key: "cpd", label: "CPD", bar: true, defaultSort: false },
    { key: "unavail_cpd", label: "Lost CPD", bar: true, defaultSort: true },
    { key: "unavail_pct", label: "Unavail %", render: (v) => <SeverityPill value={v} color={severityColor(v)} /> },
    { key: "loss_share_pct", label: "% of network loss", decimals: 1 },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-lg border-l-4 px-4 py-3 text-[12px]"
        style={{ borderColor: "var(--series-1)", background: "var(--surface-1)", color: "var(--text-secondary)" }}
      >
        Top warehouse × brand cells ranked by absolute demand lost (CPD). These 15 rows account for{" "}
        <b style={{ color: "var(--text-primary)" }}>{pareto.at(-1)?.cum.toFixed(0)}%</b> of the total unavailable
        CPD in the current selection ({fmtNum(totalLoss)} CPD).
      </div>

      <DataTable columns={columns} rows={rows} rowKey={(r) => r.wh + "|" + r.brand} />

      <div className="card p-3">
        <h4 className="text-[12px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
          Concentration of loss (Pareto)
        </h4>
        <ReactECharts
          style={{ height: 260 }}
          option={{
            grid: { left: 40, right: 16, top: 10, bottom: 60 },
            xAxis: {
              type: "category",
              data: pareto.map((p) => p.label),
              axisLabel: { rotate: 40, fontSize: 9, color: c.muted },
              axisLine: { lineStyle: { color: c.gridline } },
            },
            yAxis: {
              type: "value",
              max: 100,
              name: "% of network loss",
              nameTextStyle: { color: c.muted, fontSize: 10 },
              axisLabel: { color: c.muted, fontSize: 10 },
              splitLine: { lineStyle: { color: c.gridline } },
            },
            tooltip: { trigger: "axis" },
            series: [
              { type: "bar", name: "Share of loss", data: pareto.map((p) => +p.share.toFixed(2)), itemStyle: { color: seriesHex(isDark, 0) }, barMaxWidth: 22 },
              {
                type: "line",
                name: "Cumulative %",
                data: pareto.map((p) => +p.cum.toFixed(1)),
                itemStyle: { color: seriesHex(isDark, 1) },
                lineStyle: { width: 2.5, color: seriesHex(isDark, 1) },
                symbol: "circle",
                symbolSize: 5,
              },
            ],
          }}
        />
      </div>
    </div>
  );
}
