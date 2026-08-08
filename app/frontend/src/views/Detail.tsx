import { useEffect, useState } from "react";
import { api, type Filters, type DetailRow } from "../lib/api";
import { DataTable, type Column } from "../components/DataTable";
import { severityColor } from "../lib/format";
import { SeverityPill } from "../components/Pill";

export function Detail({ filters, dataVersion }: { filters: Filters; dataVersion: number }) {
  const [rows, setRows] = useState<DetailRow[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.detail(filters).then(setRows).catch(() => setRows([]));
  }, [JSON.stringify(filters), dataVersion]);

  if (!rows) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;

  const filtered = query
    ? rows.filter((r) => (r.item + r.wh + r.brand).toLowerCase().includes(query.toLowerCase()))
    : rows;

  const columns: Column<DetailRow>[] = [
    { key: "wh", label: "Warehouse", left: true },
    { key: "brand", label: "Brand", left: true },
    { key: "item", label: "Item", left: true },
    { key: "region", label: "Region", left: true },
    { key: "category", label: "Category", left: true },
    { key: "cpd", label: "CPD", bar: true },
    { key: "inventory", label: "Inventory" },
    { key: "doi", label: "DOI", decimals: 1 },
    {
      key: "unavail_cpd",
      label: "Status",
      defaultSort: true,
      render: (_v, r) => (r.is_unavail ? <SeverityPill value={100} color={severityColor(100)} /> : <SeverityPill value={0} color={severityColor(0)} />),
    },
    { key: "sales", label: "Sales" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <input
        placeholder="Search item / warehouse / brand…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="rounded-md border px-2.5 py-1.5 text-[11.5px] w-[280px]"
        style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
      />
      <span style={{ color: "var(--text-muted)" }} className="text-[11px]">
        {filtered.length.toLocaleString()} rows
      </span>
      <DataTable columns={columns} rows={filtered} rowKey={(r) => `${r.wh}|${r.brand}|${r.item}`} />
    </div>
  );
}
