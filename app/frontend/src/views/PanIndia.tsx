import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { api, type Filters, type PanResponse } from "../lib/api";
import { DataTable, type Column } from "../components/DataTable";
import { SeverityPill } from "../components/Pill";
import { fmtNum, fmtPct, severityColor } from "../lib/format";
import { seriesHex, availHex, palette } from "../lib/chartColors";
import { useTheme } from "../lib/theme";

const CUTS = [10, 20, 40, 60, 80, 100];

export function PanIndia({ filters, dataVersion }: { filters: Filters; dataVersion: number }) {
  const { isDark } = useTheme();
  const pal = palette(isDark);
  const [mode, setMode] = useState<"brand" | "sku">("brand");
  const [topPct, setTopPct] = useState(80);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<PanResponse | null>(null);

  useEffect(() => {
    api.panIndia(filters, mode, topPct).then(setData).catch(() => setData(null));
  }, [JSON.stringify(filters), mode, topPct, dataVersion]);

  const rows = (data?.rows ?? []).filter(
    (r) => !query || r.key.toLowerCase().includes(query.toLowerCase()) || r.brand.toLowerCase().includes(query.toLowerCase())
  );

  const columns: Column<(typeof rows)[number]>[] = [
    { key: "key", label: mode === "brand" ? "Brand" : "Item", left: true },
    ...(mode === "sku" ? [{ key: "brand", label: "Brand", left: true } as any] : []),
    { key: "cpd", label: "PAN India CPD", bar: true, defaultSort: true },
    { key: "weight_pct", label: "Weight %", decimals: 2 },
    { key: "cumulative_pct", label: "Cumulative %", decimals: 1 },
    { key: "wh_count", label: "WHs" },
    ...(mode === "brand" ? [{ key: "sku_count", label: "SKUs" } as any] : []),
    { key: "unavail_pan", label: "Unavail % of PAN", decimals: 2 },
    { key: "unavail_within", label: "Unavail within", render: (v: number) => <SeverityPill value={v} color={severityColor(v)} /> },
    { key: "avail_wtd", label: "Avail · weighted", decimals: 1 },
  ];

  const paretoN = mode === "brand" ? 20 : 30;
  const pareto = rows.slice(0, paretoN);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-secondary)" }}>
          View by:
        </span>
        {(["brand", "sku"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold"
            style={{ background: mode === m ? "var(--series-1)" : "var(--surface-2)", color: mode === m ? "#fff" : "var(--text-secondary)" }}
          >
            {m === "brand" ? "Brand" : "SKU / Item"}
          </button>
        ))}
        <span className="ml-2 text-[11.5px] font-semibold" style={{ color: "var(--text-secondary)" }}>
          Cut:
        </span>
        {CUTS.map((c) => (
          <button
            key={c}
            onClick={() => setTopPct(c)}
            className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold"
            style={{ background: topPct === c ? "var(--series-1)" : "var(--surface-2)", color: topPct === c ? "#fff" : "var(--text-secondary)" }}
          >
            {c === 100 ? "All" : `Top ${c}%`}
          </button>
        ))}
        <input
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="rounded-md border px-2.5 py-1.5 text-[11.5px] w-[180px] ml-2"
          style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
        />
      </div>

      {data && (
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          {[
            [fmtNum(data.summary.count), `${mode === "brand" ? "Brands" : "SKUs"} in cut`],
            [fmtNum(data.summary.cut_cpd), "Demand CPD", `${fmtPct(data.summary.pct_of_pan)} of PAN`],
            [fmtPct(data.summary.unavail_pct_of_pan, 2), "Unavail % of PAN India"],
            [fmtPct(data.summary.unavail_pct_within_cut), "Unavail within cut"],
            [fmtPct(100 - data.summary.unavail_pct_within_cut), "Availability · weighted"],
          ].map(([v, l, s], i) => (
            <div key={i} className="card px-3.5 py-2.5">
              <div className="text-[19px] font-bold" style={{ color: "var(--text-primary)" }}>
                {v}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: "var(--text-muted)" }}>
                {l}
              </div>
              {s && (
                <div className="text-[10.5px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {s}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <DataTable columns={columns} rows={rows} rowKey={(r) => r.key + (r as any).brand} />

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card p-3">
          <h4 className="text-[12px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Demand concentration (Pareto)
          </h4>
          <ReactECharts
            style={{ height: 260 }}
            option={{
              grid: { left: 40, right: 16, top: 10, bottom: 10 },
              xAxis: { type: "category", show: false, data: pareto.map((p) => p.key) },
              yAxis: { type: "value", max: 100, name: "%", nameTextStyle: { color: pal.muted, fontSize: 10 }, axisLabel: { color: pal.muted, fontSize: 10 }, splitLine: { lineStyle: { color: pal.gridline } } },
              tooltip: { trigger: "axis", formatter: (p: any) => `${pareto[p[0].dataIndex]?.key}<br/>weight ${p[0].value}% · cum ${p[1].value}%` },
              series: [
                { type: "bar", name: "Weight %", data: pareto.map((p) => +p.weight_pct.toFixed(2)), itemStyle: { color: seriesHex(isDark, 0) }, barMaxWidth: 16 },
                { type: "line", name: "Cumulative %", data: pareto.map((p) => +p.cumulative_pct.toFixed(1)), itemStyle: { color: seriesHex(isDark, 1) }, lineStyle: { width: 2.5, color: seriesHex(isDark, 1) }, symbol: "none" },
              ],
            }}
          />
        </div>
        <div className="card p-3">
          <h4 className="text-[12px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Weight vs availability — bubble = at-risk CPD
          </h4>
          <ReactECharts
            style={{ height: 260 }}
            option={{
              grid: { left: 44, right: 16, top: 10, bottom: 30 },
              xAxis: { type: "log", name: "PAN weight % (log)", nameTextStyle: { color: pal.muted, fontSize: 10 }, axisLabel: { color: pal.muted, fontSize: 9 } },
              yAxis: { type: "value", max: 105, name: "avail % (weighted)", nameTextStyle: { color: pal.muted, fontSize: 10 }, axisLabel: { color: pal.muted, fontSize: 10 }, splitLine: { lineStyle: { color: pal.gridline } } },
              tooltip: { formatter: (p: any) => `${p.data.name}<br/>${p.data.value[0].toFixed(2)}% weight · ${p.data.value[1].toFixed(0)}% available` },
              series: [
                {
                  type: "scatter",
                  data: rows.slice(0, 120).map((r) => ({
                    name: r.key,
                    value: [Math.max(0.01, r.weight_pct), r.avail_wtd],
                    symbolSize: Math.max(6, Math.sqrt(r.unavail_cpd) / 4),
                    itemStyle: { color: availHex(isDark, r.avail_wtd) + "cc" },
                  })),
                },
              ],
            }}
          />
        </div>
      </div>
    </div>
  );
}
