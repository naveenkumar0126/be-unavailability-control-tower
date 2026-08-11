import { useEffect, useMemo, useState } from "react";
import { pmApi, type FestiveRow } from "../../lib/api";
import { DataTable, type Column } from "../../components/DataTable";
import { MultiSelect } from "../../components/MultiSelect";
import { SeverityPill } from "../../components/Pill";
import { availColor, fmtNum, shortWh } from "../../lib/format";

export function Detail() {
  const [all, setAll] = useState<FestiveRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ptype, setPtype] = useState<string[]>([]);
  const [wh, setWh] = useState<string[]>([]);
  const [brand, setBrand] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    pmApi
      .festiveRequirements(undefined, undefined)
      .then((d) => {
        setAll(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, []);

  const facets = useMemo(() => {
    if (!all) return { ptypes: [], warehouses: [], brands: [] };
    return {
      ptypes: [...new Set(all.map((r) => r.ptype))].sort(),
      warehouses: [...new Set(all.map((r) => r.wh))].sort(),
      brands: [...new Set(all.map((r) => r.brand))].sort(),
    };
  }, [all]);

  const rows = useMemo(() => {
    if (!all) return [];
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      if (ptype.length && !ptype.includes(r.ptype)) return false;
      if (wh.length && !wh.includes(r.wh)) return false;
      if (brand.length && !brand.includes(r.brand)) return false;
      if (q && !r.item.toLowerCase().includes(q) && !r.brand.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, ptype, wh, brand, query]);

  if (error) return <div style={{ color: "var(--status-critical)" }}>{error}</div>;
  if (!all) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;

  const columns: Column<FestiveRow>[] = [
    { key: "ptype", label: "Product Type", left: true },
    { key: "wh", label: "Warehouse", left: true, render: (v) => shortWh(v) },
    { key: "region", label: "Region", left: true },
    { key: "brand", label: "Brand", left: true },
    {
      key: "item",
      label: "Item",
      left: true,
      render: (v: string, r) =>
        v === r.brand ? <span style={{ color: "var(--text-muted)" }}>— brand-level, no SKU split</span> : v,
    },
    { key: "inventory", label: "Inventory" },
    { key: "open_po", label: "Open PO" },
    { key: "need", label: "Need (Proj+BAU)", bar: true },
    { key: "requirement", label: "Still Required", bar: true, defaultSort: true },
    { key: "ach_be", label: "Achieved · BE", render: (v: number) => <SeverityPill value={v} color={availColor(v)} decimals={0} /> },
    { key: "ach_po", label: "Achieved · +PO", render: (v: number) => <SeverityPill value={v} color={availColor(v)} decimals={0} /> },
    { key: "remark", label: "Remark", left: true, render: (v: string) => <span title={v}>{v?.slice(0, 60)}{v?.length > 60 ? "…" : ""}</span> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <MultiSelect label="Product Type" options={facets.ptypes} selected={ptype} onChange={setPtype} />
        <MultiSelect label="Warehouse" options={facets.warehouses} selected={wh} onChange={setWh} />
        <MultiSelect label="Brand" options={facets.brands} selected={brand} onChange={setBrand} />
        <input
          placeholder="Search item/brand…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="rounded-md border px-2.5 py-1.5 text-[11.5px] w-[180px]"
          style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
        />
      </div>

      {rows.length === 0 ? (
        <div style={{ color: "var(--text-muted)" }} className="py-10 text-center">
          Nothing matches this filter.
        </div>
      ) : (
        <>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {rows.length} of {all.length} lines · {fmtNum(rows.reduce((s, r) => s + r.requirement, 0))} units still required
          </div>
          <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.ptype}|${r.wh}|${r.brand}|${r.item}`} />
        </>
      )}
    </div>
  );
}
