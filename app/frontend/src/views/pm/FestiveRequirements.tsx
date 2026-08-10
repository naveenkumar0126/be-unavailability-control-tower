import { useEffect, useRef, useState } from "react";
import { pmApi, type FestiveStatus, type FestiveRow } from "../../lib/api";
import { DataTable, type Column } from "../../components/DataTable";
import { fmtNum, availColor } from "../../lib/format";
import { SeverityPill } from "../../components/Pill";

function UploadRow({ onLoaded }: { onLoaded: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [ptype, setPtype] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!ptype.trim()) {
      setError("Name this product type first (e.g. Khoya)");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await pmApi.festiveUpload(file, ptype.trim());
      setPtype("");
      onLoaded();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        placeholder="Product type name (e.g. Khoya)…"
        value={ptype}
        onChange={(e) => setPtype(e.target.value)}
        className="rounded-md border px-2.5 py-1.5 text-[11.5px] w-[220px]"
        style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
      />
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) handleFile(f);
        e.target.value = "";
      }} />
      <button onClick={() => fileRef.current?.click()} disabled={busy} className="rounded-md px-3 py-1.5 text-[11.5px] font-semibold border disabled:opacity-50" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}>
        {busy ? "Uploading…" : "Upload ptype file"}
      </button>
      {error && <span className="text-[11px]" style={{ color: "var(--status-critical)" }}>{error}</span>}
    </div>
  );
}

export function FestiveRequirements({ wh }: { wh: string[] }) {
  const [status, setStatus] = useState<FestiveStatus | null>(null);
  const [rows, setRows] = useState<FestiveRow[] | null>(null);
  const [ptype, setPtype] = useState<string>("");

  function refreshStatus() {
    pmApi.festiveStatus().then(setStatus).catch(() => setStatus({ loaded: false, ptypes: [] }));
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  useEffect(() => {
    if (!status?.loaded) return;
    pmApi.festiveRequirements(wh, ptype || undefined).then(setRows).catch(() => setRows([]));
  }, [status?.loaded, JSON.stringify(wh), ptype]);

  const columns: Column<FestiveRow>[] = [
    { key: "ptype", label: "Product Type", left: true },
    { key: "wh", label: "Warehouse", left: true },
    { key: "brand", label: "Brand", left: true },
    { key: "item", label: "Item", left: true },
    { key: "inventory", label: "Inventory" },
    { key: "open_po", label: "Open PO" },
    { key: "need", label: "Need (Proj+BAU)", bar: true },
    { key: "requirement", label: "Still Required", bar: true, defaultSort: true },
    { key: "ach_be", label: "Achieved · BE", render: (v: number) => <SeverityPill value={v} color={availColor(v)} decimals={0} /> },
    { key: "ach_po", label: "Achieved · +PO", render: (v: number) => <SeverityPill value={v} color={availColor(v)} decimals={0} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border-l-4 px-4 py-3 text-[12px]" style={{ borderColor: "var(--series-1)", background: "var(--surface-1)", color: "var(--text-secondary)" }}>
        Stock-in-advance requirement per festive product type, at the warehouse(s) selected above.{" "}
        <b style={{ color: "var(--text-primary)" }}>Still Required</b> = what's left to source after inventory + open
        PO against the projected festive need.
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-secondary)" }}>
          Product type:
        </span>
        <button
          onClick={() => setPtype("")}
          className="rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
          style={{
            background: ptype === "" ? "var(--series-1)" : "var(--surface-2)",
            color: ptype === "" ? "#fff" : "var(--text-secondary)",
          }}
        >
          All
        </button>
        {status?.ptypes.map((p) => (
          <button
            key={p.ptype}
            onClick={() => setPtype(p.ptype)}
            className="rounded-full border px-2.5 py-1 text-[10.5px] font-semibold"
            style={{
              borderColor: ptype === p.ptype ? "var(--series-1)" : "var(--border)",
              background: ptype === p.ptype ? "var(--series-1)" : "var(--surface-2)",
              color: ptype === p.ptype ? "#fff" : "var(--text-secondary)",
            }}
          >
            {p.ptype} · {fmtNum(p.rows)} rows
          </button>
        ))}
        <UploadRow onLoaded={refreshStatus} />
      </div>

      {!status?.loaded ? (
        <div style={{ color: "var(--text-muted)" }} className="py-10 text-center">
          Upload festive projection files (one per product type) to see requirements here.
        </div>
      ) : rows ? (
        rows.length === 0 ? (
          <div style={{ color: "var(--text-muted)" }} className="py-10 text-center">
            No outstanding requirement for this selection.
          </div>
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.ptype}|${r.wh}|${r.brand}|${r.item}`} />
        )
      ) : (
        <div style={{ color: "var(--text-muted)" }}>Loading…</div>
      )}
    </div>
  );
}
