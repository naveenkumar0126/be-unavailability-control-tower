import { useEffect, useState } from "react";
import { api, type BrandWhDrill } from "../lib/api";
import { DataTable, type Column } from "./DataTable";
import { SeverityPill } from "./Pill";
import { fmtNum, availColor, severityColor, shortWh } from "../lib/format";

function Tile({ value, label, sub, accent }: { value: string; label: string; sub?: string; accent: string }) {
  return (
    <div className="card relative overflow-hidden px-3.5 py-2.5">
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: accent }} />
      <div className="text-[19px] font-bold" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      {sub && (
        <div className="text-[10.5px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function BrandWhDrillPanel({ wh, brand, onClose }: { wh: string; brand: string; onClose: () => void }) {
  const [data, setData] = useState<BrandWhDrill | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api.whBrandDrill(wh, brand).then(setData).catch((e) => setError(e.message));
  }, [wh, brand]);

  const statusColor = (s: string) => (s === "OUT" ? "var(--status-critical)" : s === "LOW" ? "var(--status-serious)" : "var(--status-good)");

  const columns: Column<NonNullable<typeof data>["items"][number]>[] = [
    { key: "item", label: "Item", left: true },
    { key: "cpd", label: "CPD", bar: true, defaultSort: true },
    { key: "inventory", label: "Inventory" },
    { key: "doi", label: "DOI", decimals: 1 },
    { key: "open_po", label: "Open PO" },
    ...(data?.fill_rate_available
      ? ([
          { key: "fill_L1", label: "Fill L1", render: (v: number | null) => (v == null ? "–" : <SeverityPill value={v} color={availColor(v)} />) },
          { key: "fill_L2", label: "Fill L2", render: (v: number | null) => (v == null ? "–" : <SeverityPill value={v} color={availColor(v)} />) },
        ] as Column<any>[])
      : []),
    {
      key: "status",
      label: "Status",
      left: true,
      render: (v: string) => (
        <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: statusColor(v) }}>
          {v}
        </span>
      ),
    },
  ];

  return (
    <div className="card border-2 p-4" style={{ borderColor: "var(--series-1)" }}>
      {error && <div style={{ color: "var(--status-critical)" }}>{error}</div>}
      {!data && !error && <div style={{ color: "var(--text-muted)" }}>Loading…</div>}
      {data && (
        <>
          <div className="flex items-start justify-between">
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
              {data.brand}
              <span className="ml-2 text-[11px] font-normal" style={{ color: "var(--text-muted)" }}>
                @ {shortWh(data.wh)} · {data.region}
              </span>
            </h3>
            <button onClick={onClose} className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              ✕
            </button>
          </div>

          <div className="rounded-lg mt-2 mb-3 px-3 py-2.5 text-[12px]" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
            <b style={{ color: "var(--text-primary)" }}>{data.sku_count}</b> SKUs of this brand at this warehouse, running{" "}
            <b style={{ color: "var(--text-primary)" }}>{fmtNum(data.total_cpd)} CPD</b> combined —{" "}
            <b style={{ color: severityColor(data.unavail_pct) }}>{data.unavail_pct.toFixed(1)}% unavailable</b> (weighted by
            demand).
          </div>

          <div className="grid gap-2.5 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
            <Tile value={fmtNum(data.total_cpd)} label="Total CPD" sub={`${data.sku_count} SKUs`} accent="var(--series-1)" />
            <Tile value={`${data.avail_wtd.toFixed(1)}%`} label="Availability" sub="weighted by CPD" accent={severityColor(data.unavail_pct)} />
            <Tile value={fmtNum(data.inventory)} label="Inventory" sub="units on hand" accent={data.inventory <= 0 ? "var(--status-critical)" : "var(--status-good)"} />
            <Tile value={data.doi_blended.toFixed(1)} label="Blended DOI" sub="inventory ÷ CPD" accent={severityColor(data.doi_blended < 3 ? 100 : 0)} />
            <Tile value={fmtNum(data.open_po)} label="Open PO" sub="units inbound" accent="var(--series-4)" />
            {data.fill_rate_available && (
              <>
                <Tile value={data.fill_L1 == null ? "–" : `${data.fill_L1.toFixed(0)}%`} label="Fill Rate · L1" sub="brand-level" accent={data.fill_L1 == null ? "var(--text-muted)" : availColor(data.fill_L1)} />
                <Tile value={data.fill_L2 == null ? "–" : `${data.fill_L2.toFixed(0)}%`} label="Fill Rate · L2" sub="previous week" accent={data.fill_L2 == null ? "var(--text-muted)" : availColor(data.fill_L2)} />
              </>
            )}
          </div>

          <h4 className="text-[12.5px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            All SKUs of this brand at this warehouse
          </h4>
          <div className="text-[11px] mb-2" style={{ color: "var(--text-muted)" }}>
            Ranked by demand — spot exactly which items are driving the brand's unavailability here.
          </div>
          <DataTable columns={columns} rows={data.items} rowKey={(r) => r.item} />
        </>
      )}
    </div>
  );
}
