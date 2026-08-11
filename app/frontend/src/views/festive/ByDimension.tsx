import { useEffect, useState } from "react";
import { pmApi, type FestiveDimRow, type FestiveOverview } from "../../lib/api";
import { DataTable, type Column } from "../../components/DataTable";
import { SeverityPill } from "../../components/Pill";
import { availColor, fmtNum, shortWh } from "../../lib/format";

const DIM_CONFIG = {
  brand: { key: "brand" as const, label: "Brand", fetcher: pmApi.festiveByBrand },
  region: { key: "region" as const, label: "Region", fetcher: pmApi.festiveByRegion },
  wh: { key: "wh" as const, label: "Warehouse", fetcher: pmApi.festiveByWarehouse },
};

export function ByDimension({ dim }: { dim: "brand" | "region" | "wh" }) {
  const cfg = DIM_CONFIG[dim];
  const [meta, setMeta] = useState<FestiveOverview | null>(null);
  const [ptype, setPtype] = useState("");
  const [rows, setRows] = useState<FestiveDimRow[] | null>(null);

  useEffect(() => {
    pmApi.festiveOverview().then(setMeta).catch(() => setMeta(null));
  }, []);

  useEffect(() => {
    setRows(null);
    cfg.fetcher(ptype || undefined).then(setRows).catch(() => setRows([]));
  }, [dim, ptype]);

  if (!rows) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;

  const columns: Column<FestiveDimRow>[] = [
    { key: cfg.key, label: cfg.label, left: true, render: dim === "wh" ? (v: string) => shortWh(v) : undefined },
    { key: "inventory", label: "Stocked Now", bar: true },
    { key: "open_po", label: "Incoming (Open PO)", bar: true },
    { key: "requirement", label: "Still Required", bar: true, defaultSort: true },
    { key: "ach_be_pct", label: "% Covered · Stock", render: (v: number) => <SeverityPill value={v} color={availColor(v)} decimals={0} /> },
    { key: "ach_po_pct", label: "% Covered · +PO", render: (v: number) => <SeverityPill value={v} color={availColor(v)} decimals={0} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-lg border-l-4 px-4 py-3 text-[12px]"
        style={{ borderColor: "var(--series-1)", background: "var(--surface-1)", color: "var(--text-secondary)" }}
      >
        {cfg.label}s ranked by outstanding requirement — how much is already <b style={{ color: "var(--status-good)" }}>stocked</b>,
        how much is <b style={{ color: "var(--series-4)" }}>incoming on PO</b>, and how much is{" "}
        <b style={{ color: "var(--status-critical)" }}>still required</b>. Filter to one product type, or leave on
        "All" to see the combined festive picture.
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-secondary)" }}>
          Product type:
        </span>
        <button
          onClick={() => setPtype("")}
          className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold"
          style={{ background: ptype === "" ? "var(--series-1)" : "var(--surface-2)", color: ptype === "" ? "#fff" : "var(--text-secondary)" }}
        >
          All
        </button>
        {meta?.ptypes.map((p) => (
          <button
            key={p}
            onClick={() => setPtype(p)}
            className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold"
            style={{ background: ptype === p ? "var(--series-1)" : "var(--surface-2)", color: ptype === p ? "#fff" : "var(--text-secondary)" }}
          >
            {p}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ color: "var(--text-muted)" }} className="py-10 text-center">
          No data for this selection.
        </div>
      ) : (
        <>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {rows.length} {cfg.label.toLowerCase()}{rows.length === 1 ? "" : "s"} ·{" "}
            <b style={{ color: "var(--status-good)" }}>{fmtNum(rows.reduce((s, r) => s + r.inventory, 0))}</b> stocked ·{" "}
            <b style={{ color: "var(--series-4)" }}>{fmtNum(rows.reduce((s, r) => s + r.open_po, 0))}</b> incoming ·{" "}
            <b style={{ color: "var(--status-critical)" }}>{fmtNum(rows.reduce((s, r) => s + r.requirement, 0))}</b> still required
          </div>
          <DataTable columns={columns} rows={rows} rowKey={(r) => String(r[cfg.key] ?? "")} />
        </>
      )}
    </div>
  );
}
