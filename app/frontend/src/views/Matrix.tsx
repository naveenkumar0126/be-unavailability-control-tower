import { useEffect, useState } from "react";
import { api, type Filters, type MatrixResponse } from "../lib/api";
import { severityColor, shortWh } from "../lib/format";

export function Matrix({ filters, dataVersion }: { filters: Filters; dataVersion: number }) {
  const [data, setData] = useState<MatrixResponse | null>(null);

  useEffect(() => {
    api.matrix(filters).then(setData).catch(() => setData(null));
  }, [JSON.stringify(filters), dataVersion]);

  if (!data) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;

  const rows = [...data.rows].sort((a, b) => b.total_unavail_cpd - a.total_unavail_cpd);
  const brands = [...data.brands]
    .map((b) => ({ b, cpd: rows.reduce((s, r) => s + (r.cells[b]?.cpd ?? 0), 0) }))
    .sort((a, c) => c.cpd - a.cpd)
    .slice(0, 40)
    .map((x) => x.b);

  return (
    <div className="rounded-lg border overflow-auto max-h-[640px]" style={{ borderColor: "var(--border)" }}>
      <table>
        <thead>
          <tr>
            <th className="l sticky left-0 z-10" style={{ background: "var(--surface-2)", minWidth: 170 }}>
              Warehouse
            </th>
            <th>Total CPD</th>
            <th>Unavail %</th>
            {brands.map((b) => (
              <th key={b} title={b} style={{ maxWidth: 90 }}>
                {b.length > 12 ? b.slice(0, 11) + "…" : b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rowUnavail = r.total_cpd ? (r.total_unavail_cpd / r.total_cpd) * 100 : 0;
            return (
              <tr key={r.wh}>
                <td className="l sticky left-0 z-10" style={{ background: "var(--surface-1)" }} title={r.wh}>
                  <b>{shortWh(r.wh)}</b>
                  <div className="text-[9.5px]" style={{ color: "var(--text-muted)" }}>
                    {r.region}
                  </div>
                </td>
                <td>{r.total_cpd.toLocaleString()}</td>
                <td>
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                    style={{ background: severityColor(rowUnavail) }}
                  >
                    {rowUnavail.toFixed(0)}%
                  </span>
                </td>
                {brands.map((b) => {
                  const c = r.cells[b];
                  if (!c) return <td key={b} style={{ color: "var(--text-muted)" }}>·</td>;
                  return (
                    <td key={b} style={{ background: severityColor(c.unavail_pct), color: "#fff", fontWeight: 600 }} title={`${b} @ ${r.wh}: ${c.unavail_pct.toFixed(1)}% unavail, ${c.cpd.toFixed(0)} CPD`}>
                      {c.unavail_pct.toFixed(0)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
