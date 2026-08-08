import { useRef, useState } from "react";
import { api, type DataStatus } from "../lib/api";

export function UploadPanel({ status, onLoaded }: { status: DataStatus | null; onLoaded: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSheets, setPendingSheets] = useState<string[] | null>(null);
  const [doiThreshold, setDoiThreshold] = useState(3);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setPendingSheets(null);
    try {
      const res = await api.upload(file, undefined, doiThreshold);
      if (res.needs_sheet_selection) {
        setPendingSheets(res.sheets);
      } else {
        onLoaded();
      }
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectSheet(sheet: string) {
    setBusy(true);
    setError(null);
    try {
      await api.selectSheet(sheet, doiThreshold);
      setPendingSheets(null);
      onLoaded();
    } catch (e: any) {
      setError(e.message || "Could not load sheet");
    } finally {
      setBusy(false);
    }
  }

  async function handleDoiChange(v: number) {
    setDoiThreshold(v);
    if (status?.loaded) {
      setBusy(true);
      try {
        await api.setDoiThreshold(v);
        onLoaded();
      } catch (e: any) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    }
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 border-b text-[12px]"
      style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
    >
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="rounded-md px-3 py-1.5 font-medium border hover:opacity-80 disabled:opacity-50"
        style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface-2)" }}
      >
        {busy ? "Working…" : status?.loaded ? "Replace data" : "Upload data (CSV/XLSX)"}
      </button>

      {pendingSheets && (
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--text-secondary)" }}>Pick a sheet:</span>
          <select
            className="rounded border px-2 py-1"
            style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
            defaultValue=""
            onChange={(e) => e.target.value && handleSelectSheet(e.target.value)}
          >
            <option value="" disabled>
              Select sheet…
            </option>
            {pendingSheets.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-1.5 ml-2">
        <span style={{ color: "var(--text-secondary)" }}>DOI threshold:</span>
        {[2, 3].map((v) => (
          <button
            key={v}
            onClick={() => handleDoiChange(v)}
            className="rounded px-2 py-1 font-semibold"
            style={{
              background: doiThreshold === v ? "var(--series-1)" : "var(--surface-2)",
              color: doiThreshold === v ? "#fff" : "var(--text-secondary)",
            }}
          >
            {"<"} {v}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {error && <span style={{ color: "var(--status-critical)" }}>{error}</span>}

      {status?.loaded && (
        <span style={{ color: "var(--text-muted)" }}>
          {status.filename} · {status.rows?.toLocaleString()} rows
        </span>
      )}
    </div>
  );
}
