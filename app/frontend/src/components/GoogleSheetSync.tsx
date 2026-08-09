import { useEffect, useState } from "react";
import { API_BASE } from "../lib/api";

async function postForm(path: string, fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const res = await fetch(API_BASE + path, { method: "POST", body: fd });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || `Request failed: ${res.status}`);
  return body;
}

export function GoogleSheetSync({
  syncEndpoint,
  listTabsEndpoint,
  infoEndpoint,
  extraFields = {},
  onSynced,
  compact = false,
}: {
  syncEndpoint: string;
  listTabsEndpoint: string;
  infoEndpoint?: string;
  extraFields?: Record<string, string>;
  onSynced: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [tabs, setTabs] = useState<string[] | null>(null);
  const [tab, setTab] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saEmail, setSaEmail] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open || !infoEndpoint || configured !== null) return;
    fetch(API_BASE + infoEndpoint)
      .then((r) => r.json())
      .then((d) => {
        setConfigured(!!d.configured);
        setSaEmail(d.service_account_email ?? null);
      })
      .catch(() => setConfigured(false));
  }, [open, infoEndpoint, configured]);

  async function handleFetchTabs() {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    setTabs(null);
    try {
      const res = await postForm(listTabsEndpoint, { sheet_url: url.trim() });
      setTabs(res.tabs);
      setTab(res.tabs[0] ?? "");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSync() {
    setBusy(true);
    setError(null);
    try {
      await postForm(syncEndpoint, { sheet_url: url.trim(), tab_name: tab, ...extraFields });
      onSynced();
      setOpen(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={compact ? "rounded-md px-3 py-1.5 text-[11.5px] font-semibold border" : "rounded-md px-3 py-1.5 font-medium border hover:opacity-80"}
        style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface-2)" }}
      >
        🔗 Sync from Google Sheet
      </button>
    );
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border p-3 text-[11.5px]"
      style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
    >
      {configured === false && (
        <div style={{ color: "var(--status-critical)" }}>
          Google Sheets isn't configured on the backend yet (no service account credentials set).
        </div>
      )}
      {saEmail && (
        <div style={{ color: "var(--text-secondary)" }}>
          Share your sheet (Viewer is enough) with: <b style={{ color: "var(--text-primary)" }}>{saEmail}</b>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          placeholder="Paste Google Sheet URL…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 rounded-md border px-2.5 py-1.5"
          style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
        />
        <button
          onClick={handleFetchTabs}
          disabled={busy || !url.trim()}
          className="rounded-md px-2.5 py-1.5 font-semibold border disabled:opacity-50"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
        >
          Find tabs
        </button>
      </div>
      {tabs && (
        <div className="flex items-center gap-2">
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value)}
            className="rounded-md border px-2.5 py-1.5"
            style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
          >
            {tabs.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            onClick={handleSync}
            disabled={busy}
            className="rounded-md px-3 py-1.5 font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--series-1)" }}
          >
            {busy ? "Syncing…" : "Sync this tab"}
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        {error && <span style={{ color: "var(--status-critical)" }}>{error}</span>}
        <button onClick={() => setOpen(false)} className="ml-auto" style={{ color: "var(--text-muted)" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
