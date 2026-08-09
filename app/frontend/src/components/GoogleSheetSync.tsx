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

type GoogleStatus = { configured: boolean; connected: boolean; email: string | null };
type SaInfo = { configured: boolean; service_account_email?: string; detail?: string };

function urlHasGoogleParam(): "connected" | "error" | null {
  const p = new URLSearchParams(window.location.search);
  if (p.has("google_connected")) return "connected";
  if (p.has("google_error")) return "error";
  return null;
}

function clearGoogleParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete("google_connected");
  url.searchParams.delete("google_error");
  window.history.replaceState({}, "", url.toString());
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
  const [open, setOpen] = useState(() => urlHasGoogleParam() !== null);
  const [url, setUrl] = useState("");
  const [tabs, setTabs] = useState<string[] | null>(null);
  const [tab, setTab] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [saInfo, setSaInfo] = useState<SaInfo | null>(null);

  function refreshStatus() {
    fetch(API_BASE + "/api/google/status")
      .then((r) => r.json())
      .then(setGoogle)
      .catch(() => setGoogle({ configured: false, connected: false, email: null }));
    if (infoEndpoint) {
      fetch(API_BASE + infoEndpoint)
        .then((r) => r.json())
        .then(setSaInfo)
        .catch(() => setSaInfo({ configured: false }));
    }
  }

  useEffect(() => {
    if (!open) return;
    refreshStatus();
    const param = urlHasGoogleParam();
    if (param === "error") {
      const p = new URLSearchParams(window.location.search);
      setError(p.get("google_error"));
    }
    if (param) clearGoogleParams();
  }, [open]);

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

  const canPickSheet = google?.connected || saInfo?.configured;

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border p-3 text-[11.5px]"
      style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
    >
      {google === null ? (
        <div style={{ color: "var(--text-muted)" }}>Checking Google access…</div>
      ) : google.connected ? (
        <div style={{ color: "var(--text-secondary)" }}>
          Connected as <b style={{ color: "var(--text-primary)" }}>{google.email}</b>
          <button
            onClick={async () => {
              await fetch(API_BASE + "/api/google/disconnect", { method: "POST" });
              refreshStatus();
            }}
            className="ml-2 underline"
            style={{ color: "var(--text-muted)" }}
          >
            disconnect
          </button>
        </div>
      ) : saInfo?.configured ? (
        <div style={{ color: "var(--text-secondary)" }}>
          Share your sheet (Viewer is enough) with:{" "}
          <b style={{ color: "var(--text-primary)" }}>{saInfo.service_account_email}</b>
        </div>
      ) : google.configured ? (
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--text-secondary)" }}>Sign in with the Google account that can see your sheet:</span>
          <a
            href={`${API_BASE}/api/google/login`}
            className="rounded-md px-3 py-1.5 font-semibold text-white"
            style={{ background: "var(--series-1)" }}
          >
            Connect Google Account
          </a>
        </div>
      ) : (
        <div style={{ color: "var(--status-critical)" }}>
          Google access isn't configured on the backend yet (no OAuth client or service account credentials set).
        </div>
      )}

      {canPickSheet && (
        <>
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
        </>
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
