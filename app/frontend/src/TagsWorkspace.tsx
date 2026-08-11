import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { tagsApi, type TagsStatus } from "./lib/api";
import { fmtNum } from "./lib/format";
import { Overview } from "./views/tags/Overview";
import { Trend } from "./views/tags/Trend";
import { ByDimension } from "./views/tags/ByDimension";
import { ChronicIssues } from "./views/tags/ChronicIssues";
import { Detail } from "./views/tags/Detail";

const TABS = [
  { key: "overview", label: "⚡ Overview" },
  { key: "trend", label: "📈 Trend Over Time" },
  { key: "brand", label: "🏷️ By Brand" },
  { key: "warehouse", label: "🏭 By Warehouse" },
  { key: "chronic", label: "⚠️ Chronic Issues" },
  { key: "detail", label: "📋 Detail" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function UploadPrompt({ onLoaded }: { onLoaded: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await tagsApi.upload(file);
      if (res.skipped_sheets?.length) {
        setInfo(`Loaded ${res.weeks_loaded} week(s). Skipped sheets (no date found in name): ${res.skipped_sheets.join(", ")}`);
      }
      onLoaded();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20" style={{ color: "var(--text-muted)" }}>
      <div className="text-[40px]">🏷️</div>
      <div className="text-[14px] font-semibold" style={{ color: "var(--text-secondary)" }}>
        No Tag & Reason data loaded yet
      </div>
      <div className="text-[12px] max-w-md text-center">
        Upload the TAG & Reason workbook — one sheet per week (e.g. "6th_july", "3rd aug"). Every dated sheet in the
        file is loaded as its own week automatically.
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
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
        className="rounded-md px-4 py-2 text-[12px] font-semibold border disabled:opacity-50"
        style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
      >
        {busy ? "Uploading…" : "Upload TAG & Reason.xlsx"}
      </button>
      {error && <span style={{ color: "var(--status-critical)" }}>{error}</span>}
      {info && <span style={{ color: "var(--status-warning)" }}>{info}</span>}
    </div>
  );
}

export function TagsWorkspace() {
  const [status, setStatus] = useState<TagsStatus | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");

  function refreshStatus() {
    tagsApi.status().then(setStatus).catch(() => setStatus({ loaded: false, weeks: [] }));
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  if (!status) return <div className="p-4" style={{ color: "var(--text-muted)" }}>Loading…</div>;
  if (!status.loaded) return <UploadPrompt onLoaded={refreshStatus} />;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b flex-wrap" style={{ borderColor: "var(--border)" }}>
        <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-secondary)" }}>
          {status.weeks.length} weeks loaded ({fmtNum(status.total_rows ?? 0)} rows) — {status.weeks.map((w) => w.label).join(", ")}
        </span>
        <div className="flex-1" />
        <UploadRefresh onLoaded={refreshStatus} />
      </div>

      <div className="p-4">
        <div id="tags-tab-strip" className="flex gap-1 flex-wrap border-b mb-4" style={{ borderColor: "var(--border)" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx("px-3.5 py-2 text-[12px] font-semibold border-b-2 -mb-px transition-colors")}
              style={{
                borderColor: tab === t.key ? "var(--series-1)" : "transparent",
                color: tab === t.key ? "var(--series-1)" : "var(--text-secondary)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && <Overview onNavigate={setTab} />}
        {tab === "trend" && <Trend />}
        {tab === "brand" && <ByDimension dim="brand" />}
        {tab === "warehouse" && <ByDimension dim="wh" />}
        {tab === "chronic" && <ChronicIssues />}
        {tab === "detail" && <Detail />}
      </div>
    </div>
  );
}

function UploadRefresh({ onLoaded }: { onLoaded: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      await tagsApi.upload(file);
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
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
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
        className="rounded-md px-3 py-1.5 text-[11.5px] font-semibold border disabled:opacity-50"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
      >
        {busy ? "Uploading…" : "Replace / add week"}
      </button>
      {error && <span className="text-[11px]" style={{ color: "var(--status-critical)" }}>{error}</span>}
    </div>
  );
}
