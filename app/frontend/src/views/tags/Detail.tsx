import { useEffect, useState } from "react";
import { tagsApi, type TagDetailRow, type TagsFacets, type TagsStatus } from "../../lib/api";
import { DataTable, type Column } from "../../components/DataTable";
import { MultiSelect } from "../../components/MultiSelect";
import { SeverityPill } from "../../components/Pill";
import { availColor, shortWh } from "../../lib/format";

export function Detail() {
  const [status, setStatus] = useState<TagsStatus | null>(null);
  const [facets, setFacets] = useState<TagsFacets | null>(null);
  const [week, setWeek] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [wh, setWh] = useState<string[]>([]);
  const [brand, setBrand] = useState<string[]>([]);
  const [rows, setRows] = useState<TagDetailRow[] | null>(null);

  useEffect(() => {
    tagsApi.status().then(setStatus);
    tagsApi.facets().then(setFacets);
  }, []);

  useEffect(() => {
    tagsApi
      .detail({ week: week || undefined, tag: tags, wh, brand })
      .then(setRows)
      .catch(() => setRows([]));
  }, [week, JSON.stringify(tags), JSON.stringify(wh), JSON.stringify(brand)]);

  const columns: Column<TagDetailRow>[] = [
    { key: "week_label", label: "Week", left: true },
    { key: "wh", label: "Warehouse", left: true, render: (v) => shortWh(v) },
    { key: "brand", label: "Brand", left: true },
    { key: "tag", label: "Tag", left: true },
    { key: "cpd", label: "CPD", bar: true },
    { key: "avail_wtd", label: "Weighted Avail", decimals: 0, render: (v: number) => <SeverityPill value={v} color={availColor(v)} decimals={0} /> },
    { key: "doi", label: "DOI", decimals: 1 },
    { key: "unavail_cpd", label: "At-Risk CPD", bar: true, defaultSort: true },
    { key: "remark", label: "Root Cause Remark", left: true, render: (v: string) => <span title={v}>{v?.slice(0, 90)}{v?.length > 90 ? "…" : ""}</span> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-secondary)" }}>
          Week:
        </span>
        <select
          value={week}
          onChange={(e) => setWeek(e.target.value)}
          className="rounded-md border px-2.5 py-1.5 text-[11.5px]"
          style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
        >
          <option value="">All weeks</option>
          {status?.weeks.map((w) => (
            <option key={w.week} value={w.week}>
              {w.label}
            </option>
          ))}
        </select>
        <MultiSelect label="Tag" options={facets?.tags ?? []} selected={tags} onChange={setTags} />
        <MultiSelect label="Warehouse" options={facets?.warehouses ?? []} selected={wh} onChange={setWh} />
        <MultiSelect label="Brand" options={facets?.brands ?? []} selected={brand} onChange={setBrand} />
      </div>

      {!rows ? (
        <div style={{ color: "var(--text-muted)" }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: "var(--text-muted)" }} className="py-10 text-center">
          Nothing matches this filter.
        </div>
      ) : (
        <>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {rows.length} rows
          </div>
          <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.week_label}|${r.wh}|${r.brand}|${r.tag}`} />
        </>
      )}
    </div>
  );
}
