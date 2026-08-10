import { useEffect, useState } from "react";
import { api, type Filters, type MatrixResponse } from "../lib/api";
import { severityColor, shortWh } from "../lib/format";
import { BrandWhDrillPanel } from "../components/BrandWhDrillPanel";

export function Matrix({ filters, dataVersion }: { filters: Filters; dataVersion: number }) {
  const [data, setData] = useState<MatrixResponse | null>(null);
  const [selected, setSelected] = useState<{ wh: string; brand: string } | null>(null);

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
    <div className="flex flex-col gap-4">
      <div
        className="rounded-lg border-l-4 px-4 py-3 text-[12px]"
        style={{ borderColor: "var(--series-1)", background: "var(--surface-1)", color: "var(--text-secondary)" }}
      >
        Each block is a warehouse × brand combination, shaded by{" "}
        <b style={{ color: "var(--text-primary)" }}>unavailability % (weighted by CPD)</b> — the number shown is that
        %. Click any block to see every SKU of that brand at that warehouse.
      </div>

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
                      <td
                        key={b}
                        onClick={() => setSelected({ wh: r.wh, brand: b })}
                        style={{ background: severityColor(c.unavail_pct), color: "#fff", fontWeight: 600, cursor: "pointer" }}
                        title={`${b} @ ${r.wh}: ${c.unavail_pct.toFixed(1)}% unavail, ${c.cpd.toFixed(0)} CPD — click for SKU detail`}
                      >
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

      {selected && <BrandWhDrillPanel wh={selected.wh} brand={selected.brand} onClose={() => setSelected(null)} />}
    </div>
  );
}
