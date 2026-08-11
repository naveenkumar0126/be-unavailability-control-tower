import { useEffect, useState } from "react";
import { tagsApi, type ChronicIssueRow } from "../../lib/api";
import { DataTable, type Column } from "../../components/DataTable";
import { shortWh } from "../../lib/format";

export function ChronicIssues() {
  const [minWeeks, setMinWeeks] = useState(3);
  const [rows, setRows] = useState<ChronicIssueRow[] | null>(null);

  useEffect(() => {
    tagsApi.chronic(minWeeks).then(setRows).catch(() => setRows([]));
  }, [minWeeks]);

  const columns: Column<ChronicIssueRow>[] = [
    { key: "wh", label: "Warehouse", left: true, render: (v) => shortWh(v) },
    { key: "brand", label: "Brand", left: true },
    { key: "region", label: "Region", left: true },
    { key: "weeks_affected", label: "Weeks Affected", defaultSort: true },
    { key: "latest_tag", label: "Latest Tag", left: true },
    { key: "tags", label: "All Tags Seen", left: true },
    { key: "total_at_risk_cpd", label: "Total At-Risk CPD", bar: true },
    { key: "latest_remark", label: "Latest Remark", left: true, render: (v: string) => <span title={v}>{v?.slice(0, 80)}{v?.length > 80 ? "…" : ""}</span> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-lg border-l-4 px-4 py-3 text-[12px]"
        style={{ borderColor: "var(--status-critical)", background: "var(--surface-1)", color: "var(--text-secondary)" }}
      >
        Warehouse × brand combos tagged with a real problem (not "No issues", not untagged) for{" "}
        <b style={{ color: "var(--text-primary)" }}>{minWeeks} weeks running</b> — the ones a one-off explanation
        doesn't cover anymore. This is the sharpest escalation list: everything here has been reviewed and still
        isn't resolved.
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-secondary)" }}>
          Stuck for at least:
        </span>
        {[2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => setMinWeeks(n)}
            className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold"
            style={{ background: minWeeks === n ? "var(--series-1)" : "var(--surface-2)", color: minWeeks === n ? "#fff" : "var(--text-secondary)" }}
          >
            {n} weeks
          </button>
        ))}
      </div>

      {!rows ? (
        <div style={{ color: "var(--text-muted)" }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: "var(--text-muted)" }} className="py-10 text-center">
          Nothing stuck for {minWeeks}+ weeks — either genuinely resolved fast, or not enough weeks of history yet.
        </div>
      ) : (
        <>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {rows.length} combos stuck for {minWeeks}+ consecutive weeks
          </div>
          <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.wh}|${r.brand}`} />
        </>
      )}
    </div>
  );
}
