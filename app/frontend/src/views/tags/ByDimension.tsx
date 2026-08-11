import { useEffect, useState } from "react";
import { tagsApi, type TagByDimRow, type TagsStatus } from "../../lib/api";
import { DataTable, type Column } from "../../components/DataTable";
import { fmtNum } from "../../lib/format";

type EntityRow = {
  entity: string;
  total_count: number;
  total_at_risk_cpd: number;
  top_tag: string;
  top_tag_count: number;
  second_tag: string;
  second_tag_count: number;
};

function pivot(rows: TagByDimRow[], key: string): EntityRow[] {
  const byEntity = new Map<string, TagByDimRow[]>();
  for (const r of rows) {
    const k = r[key];
    if (!byEntity.has(k)) byEntity.set(k, []);
    byEntity.get(k)!.push(r);
  }
  const out: EntityRow[] = [];
  for (const [entity, tagRows] of byEntity) {
    const sorted = [...tagRows].sort((a, b) => b.count - a.count);
    out.push({
      entity,
      total_count: tagRows.reduce((s, r) => s + r.count, 0),
      total_at_risk_cpd: tagRows.reduce((s, r) => s + r.at_risk_cpd, 0),
      top_tag: sorted[0]?.tag ?? "–",
      top_tag_count: sorted[0]?.count ?? 0,
      second_tag: sorted[1]?.tag ?? "–",
      second_tag_count: sorted[1]?.count ?? 0,
    });
  }
  return out.sort((a, b) => b.total_at_risk_cpd - a.total_at_risk_cpd);
}

export function ByDimension({ dim }: { dim: "brand" | "wh" }) {
  const [status, setStatus] = useState<TagsStatus | null>(null);
  const [week, setWeek] = useState<string>("");
  const [rows, setRows] = useState<TagByDimRow[] | null>(null);

  useEffect(() => {
    tagsApi.status().then(setStatus);
  }, []);

  useEffect(() => {
    const fetcher = dim === "brand" ? tagsApi.byBrand : tagsApi.byWarehouse;
    fetcher(week || undefined).then(setRows).catch(() => setRows([]));
  }, [dim, week]);

  if (!rows) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;

  const key = dim === "brand" ? "brand" : "wh";
  const entities = pivot(rows, key);
  const label = dim === "brand" ? "Brand" : "Warehouse";

  const columns: Column<EntityRow>[] = [
    { key: "entity", label, left: true },
    { key: "total_count", label: "Tagged Rows", defaultSort: true },
    { key: "total_at_risk_cpd", label: "At-Risk CPD", bar: true },
    {
      key: "top_tag",
      label: "Top Root Cause",
      left: true,
      render: (v: string, r) => (
        <span>
          {v} <span style={{ color: "var(--text-muted)" }}>({fmtNum(r.top_tag_count)})</span>
        </span>
      ),
    },
    {
      key: "second_tag",
      label: "2nd Root Cause",
      left: true,
      render: (v: string, r) =>
        v === "–" ? (
          "–"
        ) : (
          <span>
            {v} <span style={{ color: "var(--text-muted)" }}>({fmtNum(r.second_tag_count)})</span>
          </span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-lg border-l-4 px-4 py-3 text-[12px]"
        style={{ borderColor: "var(--series-1)", background: "var(--surface-1)", color: "var(--text-secondary)" }}
      >
        {label}s ranked by at-risk CPD, with the root cause behind most of their tagged rows. Pick a week below, or
        leave on "All weeks" to see the full history combined.
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-secondary)" }}>
          Week:
        </span>
        <button
          onClick={() => setWeek("")}
          className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold"
          style={{ background: week === "" ? "var(--series-1)" : "var(--surface-2)", color: week === "" ? "#fff" : "var(--text-secondary)" }}
        >
          All weeks
        </button>
        {status?.weeks.map((w) => (
          <button
            key={w.week}
            onClick={() => setWeek(w.week)}
            className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold"
            style={{ background: week === w.week ? "var(--series-1)" : "var(--surface-2)", color: week === w.week ? "#fff" : "var(--text-secondary)" }}
          >
            {w.label}
          </button>
        ))}
      </div>

      {entities.length === 0 ? (
        <div style={{ color: "var(--text-muted)" }} className="py-10 text-center">
          No data for this selection.
        </div>
      ) : (
        <DataTable columns={columns} rows={entities} rowKey={(r) => r.entity} />
      )}
    </div>
  );
}
