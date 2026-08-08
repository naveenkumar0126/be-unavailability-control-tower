import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { api, type Filters, type RollupRow } from "../lib/api";
import { severityColor, shortWh, fmtPct, fmtNum } from "../lib/format";
import { severityHex, palette } from "../lib/chartColors";
import { useTheme } from "../lib/theme";

function BarPanel({ title, rows, nameKey, nameFmt }: { title: string; rows: RollupRow[]; nameKey: "brand" | "wh"; nameFmt: (v: string) => string }) {
  const { isDark } = useTheme();
  const worst = [...rows].sort((a, b) => b.unavail_pct - a.unavail_pct).slice(0, 12);
  const c = palette(isDark);
  return (
    <div className="card p-3">
      <h4 className="text-[12px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        {title}
      </h4>
      <ReactECharts
        style={{ height: 300 }}
        option={{
          grid: { left: 130, right: 40, top: 6, bottom: 20 },
          xAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%", color: c.muted, fontSize: 10 }, splitLine: { lineStyle: { color: c.gridline } } },
          yAxis: { type: "category", data: worst.map((r) => nameFmt(String(r[nameKey]))).reverse(), axisLabel: { fontSize: 10, color: c.muted }, axisLine: { lineStyle: { color: c.gridline } } },
          tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
          series: [{ type: "bar", data: worst.map((r) => ({ value: +r.unavail_pct.toFixed(1), itemStyle: { color: severityHex(isDark, r.unavail_pct) } })).reverse(), barMaxWidth: 13 }],
        }}
      />
    </div>
  );
}

export function Overview({ filters, dataVersion }: { filters: Filters; dataVersion: number }) {
  const [brands, setBrands] = useState<RollupRow[] | null>(null);
  const [whs, setWhs] = useState<RollupRow[] | null>(null);
  const [regions, setRegions] = useState<RollupRow[] | null>(null);

  useEffect(() => {
    api.rollup("brand", filters).then(setBrands).catch(() => setBrands([]));
    api.rollup("wh", filters).then(setWhs).catch(() => setWhs([]));
    api.rollup("region", filters).then(setRegions).catch(() => setRegions([]));
  }, [JSON.stringify(filters), dataVersion]);

  if (!brands || !whs || !regions) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <BarPanel title="Worst brands by unavailability %" rows={brands} nameKey="brand" nameFmt={(v) => v} />
        <BarPanel title="Worst warehouses by unavailability %" rows={whs} nameKey="wh" nameFmt={shortWh} />
      </div>

      <div className="card p-3">
        <h4 className="text-[12px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
          Demand vs. loss share by region
        </h4>
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <table>
            <thead>
              <tr>
                <th className="l">Region</th>
                <th>Demand CPD</th>
                <th>% of demand</th>
                <th>Lost CPD</th>
                <th>% of loss</th>
                <th>Unavail %</th>
              </tr>
            </thead>
            <tbody>
              {[...regions]
                .sort((a, b) => b.unavail_cpd - a.unavail_cpd)
                .map((r) => (
                  <tr key={r.region}>
                    <td className="l">{r.region}</td>
                    <td>{fmtNum(r.cpd)}</td>
                    <td>{fmtPct(r.demand_share_pct)}</td>
                    <td>{fmtNum(r.unavail_cpd)}</td>
                    <td>{fmtPct(r.loss_share_pct)}</td>
                    <td>
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                        style={{ background: severityColor(r.unavail_pct) }}
                      >
                        {r.unavail_pct.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
