import { useEffect, useRef, useState } from "react";
import { pmApi, type InboundStatus, type InboundSummaryRow, type InboundRow } from "../../lib/api";
import { DataTable, type Column } from "../../components/DataTable";
import { shortWh, availColor } from "../../lib/format";
import { SeverityPill } from "../../components/Pill";

function UploadPrompt({ onLoaded }: { onLoaded: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      await pmApi.inboundUpload(file);
      onLoaded();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20" style={{ color: "var(--text-muted)" }}>
      <div className="text-[40px]">📥</div>
      <div className="text-[14px] font-semibold" style={{ color: "var(--text-secondary)" }}>
        No inbound utilization data loaded yet
      </div>
      <div className="text-[12px] max-w-md text-center">
        Upload the DOD Tracker file (date × warehouse, inbound capacity/planned/GRN qty).
      </div>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) handleFile(f);
        e.target.value = "";
      }} />
      <button onClick={() => fileRef.current?.click()} disabled={busy} className="rounded-md px-4 py-2 text-[12px] font-semibold border disabled:opacity-50" style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}>
        {busy ? "Uploading…" : "Upload DOD Tracker CSV/XLSX"}
      </button>
      {error && <span style={{ color: "var(--status-critical)" }}>{error}</span>}
    </div>
  );
}

export function InboundUtilization({ wh }: { wh: string[] }) {
  const [status, setStatus] = useState<InboundStatus | null>(null);
  const [summary, setSummary] = useState<InboundSummaryRow[] | null>(null);
  const [detail, setDetail] = useState<InboundRow[] | null>(null);

  function refreshStatus() {
    pmApi.inboundStatus().then(setStatus).catch(() => setStatus({ loaded: false }));
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  useEffect(() => {
    if (!status?.loaded) return;
    pmApi.inboundSummary(wh).then(setSummary).catch(() => setSummary([]));
    pmApi.inboundUtilization(wh).then(setDetail).catch(() => setDetail([]));
  }, [status?.loaded, JSON.stringify(wh)]);

  if (!status) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;
  if (!status.loaded) return <UploadPrompt onLoaded={refreshStatus} />;

  const summaryColumns: Column<InboundSummaryRow>[] = [
    { key: "wh", label: "Warehouse", left: true, render: (v) => shortWh(v) },
    { key: "zone", label: "Zone", left: true },
    { key: "avg_cap", label: "Avg Inbound Cap/day", bar: true },
    { key: "avg_planned", label: "Avg Planned/day", bar: true },
    { key: "avg_grn", label: "Avg GRN/day", bar: true },
    {
      key: "avg_utilization",
      label: "Avg Utilization",
      defaultSort: true,
      render: (v: number) => <SeverityPill value={v} color={v < 85 ? "var(--status-critical)" : availColor(v)} decimals={0} />,
    },
    { key: "low_days", label: "Days < 85%" },
  ];

  const detailColumns: Column<InboundRow>[] = [
    { key: "date", label: "Date", left: true, defaultSort: true },
    { key: "wh", label: "Warehouse", left: true, render: (v) => shortWh(v) },
    { key: "cap", label: "Inbound Cap", bar: true },
    { key: "planned", label: "Planned", bar: true },
    { key: "grn", label: "GRN", bar: true },
    { key: "failed", label: "Failed" },
    {
      key: "utilization_pct",
      label: "Utilization",
      render: (v: number, r) => <SeverityPill value={v} color={r.is_low ? "var(--status-critical)" : availColor(v)} decimals={0} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border-l-4 px-4 py-3 text-[12px]" style={{ borderColor: "var(--series-1)", background: "var(--surface-1)", color: "var(--text-secondary)" }}>
        <b style={{ color: "var(--text-primary)" }}>Utilization</b> = GRN qty ÷ Inbound Cap — how much of the day's
        dock capacity actually got used. Below <b style={{ color: "var(--status-critical)" }}>85%</b> is flagged red —
        plan better or flag the gap upstream.
      </div>

      <h4 className="text-[12.5px] font-semibold" style={{ color: "var(--text-primary)" }}>
        Last 7 days — by warehouse
      </h4>
      {summary ? <DataTable columns={summaryColumns} rows={summary} rowKey={(r) => r.wh} /> : <div style={{ color: "var(--text-muted)" }}>Loading…</div>}

      <h4 className="text-[12.5px] font-semibold mt-2" style={{ color: "var(--text-primary)" }}>
        Day-by-day detail
      </h4>
      {detail ? <DataTable columns={detailColumns} rows={detail} rowKey={(r) => r.wh + r.date} /> : <div style={{ color: "var(--text-muted)" }}>Loading…</div>}
    </div>
  );
}
