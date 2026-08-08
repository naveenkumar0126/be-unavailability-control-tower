import { useEffect, useState } from "react";
import { api, type Filters, type WhItemResponse } from "../lib/api";
import { fmtNum, shortWh } from "../lib/format";

const STATUS_COLOR: Record<string, string> = {
  OK: "var(--status-good)",
  LOW: "var(--status-serious)",
  OUT: "var(--status-critical)",
};

export function WhItem({ filters, brands, dataVersion }: { filters: Filters; brands: string[]; dataVersion: number }) {
  const [brand, setBrand] = useState("__TOP__");
  const [topN, setTopN] = useState(30);
  const [data, setData] = useState<WhItemResponse | null>(null);

  useEffect(() => {
    api.whItem(filters, brand, topN).then(setData).catch(() => setData(null));
  }, [JSON.stringify(filters), brand, topN, dataVersion]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="rounded-md border px-2.5 py-1.5 text-[11.5px]"
          style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
        >
          <option value="__TOP__">Top items (all brands)</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          value={topN}
          onChange={(e) => setTopN(Number(e.target.value))}
          className="rounded-md border px-2.5 py-1.5 text-[11.5px]"
          style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
        >
          {[15, 30, 50].map((n) => (
            <option key={n} value={n}>
              Top {n} items
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5 ml-auto text-[10.5px]" style={{ color: "var(--text-muted)" }}>
          {Object.entries(STATUS_COLOR).map(([k, c]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
              {k}
            </span>
          ))}
        </div>
      </div>

      {!data ? (
        <div style={{ color: "var(--text-muted)" }}>Loading…</div>
      ) : (
        <div className="rounded-lg border overflow-auto max-h-[600px]" style={{ borderColor: "var(--border)" }}>
          <table>
            <thead>
              <tr>
                <th className="l sticky left-0 z-10" style={{ background: "var(--surface-2)", minWidth: 220 }}>
                  Item
                </th>
                <th>PAN CPD</th>
                <th>Wt %</th>
                <th>Avail</th>
                {data.warehouses.map((w) => (
                  <th key={w} title={w}>
                    {shortWh(w).slice(0, 10)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => (
                <tr key={it.item}>
                  <td className="l sticky left-0 z-10" style={{ background: "var(--surface-1)" }} title={it.item}>
                    <b>{it.item.slice(0, 42)}</b>
                    <div className="text-[9.5px]" style={{ color: "var(--text-muted)" }}>
                      {it.brand}
                    </div>
                  </td>
                  <td>{fmtNum(it.pan_cpd)}</td>
                  <td>{it.weight_pct.toFixed(2)}%</td>
                  <td>{it.avail_wtd.toFixed(0)}%</td>
                  {data.warehouses.map((w) => {
                    const c = it.cells[w];
                    if (!c) return <td key={w} style={{ color: "var(--text-muted)" }}>·</td>;
                    return (
                      <td
                        key={w}
                        style={{ background: STATUS_COLOR[c.status], color: "#fff", fontWeight: 600 }}
                        title={`${it.item} @ ${w}: DOI ${c.doi?.toFixed(1)}, inv ${fmtNum(c.inventory)}`}
                      >
                        {c.status}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
