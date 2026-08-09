export type Filters = {
  region?: string[];
  wh?: string[];
  brand?: string[];
  category?: string[];
  min_cpd?: number;
};

export type Kpis = {
  unavail_weighted: number;
  avail_weighted: number;
  unavail_normal: number;
  avail_normal: number;
  unavail_cpd: number;
  total_cpd: number;
  pct_of_pan: number | null;
  active_skus: number;
  warehouses: number;
  brands: number;
  is_filtered: boolean;
};

export type RollupRow = {
  brand?: string;
  wh?: string;
  region?: string;
  cpd: number;
  unavail_cpd: number;
  n: number;
  ok_n: number;
  inventory: number;
  open_po: number;
  sales: number;
  unavail_pct: number;
  avail_wtd: number;
  norm_avail: number;
  norm_unavail: number;
  loss_share_pct: number;
  demand_share_pct: number;
};

export type PriorityRow = RollupRow & { wh: string; brand: string; region: string };

export type MatrixCell = {
  cpd: number;
  unavail_cpd: number;
  unavail_pct: number;
  avail_wtd: number;
  norm_avail: number;
};

export type MatrixRow = {
  wh: string;
  region: string;
  total_cpd: number;
  total_unavail_cpd: number;
  cells: Record<string, MatrixCell>;
};

export type MatrixResponse = {
  warehouses: string[];
  brands: string[];
  rows: MatrixRow[];
};

export type PanRow = {
  key: string;
  brand: string;
  category: string | null;
  cpd: number;
  weight_pct: number;
  unavail_cpd: number;
  unavail_pan: number;
  unavail_within: number;
  avail_wtd: number;
  norm_avail: number;
  wh_count: number;
  sku_count: number;
  inventory: number;
  open_po: number;
  cumulative_pct: number;
};

export type PanResponse = {
  rows: PanRow[];
  summary: {
    count: number;
    total_count: number;
    cut_cpd: number;
    cut_unavail_cpd: number;
    pct_of_pan: number;
    unavail_pct_of_pan: number;
    unavail_pct_within_cut: number;
  };
};

export type WhItemCell = { cpd: number; inventory: number; doi: number; status: "OK" | "LOW" | "OUT" };
export type WhItemRow = {
  item: string;
  brand: string;
  pan_cpd: number;
  weight_pct: number;
  avail_wtd: number;
  cells: Record<string, WhItemCell>;
};
export type WhItemResponse = { items: WhItemRow[]; warehouses: string[] };

export type DataStatus = {
  loaded: boolean;
  filename?: string;
  uploaded_at?: string;
  rows?: number;
  doi_threshold?: number;
  facets?: { regions: string[]; warehouses: string[]; brands: string[]; categories: string[] };
};

export type DetailRow = {
  wh: string;
  brand: string;
  item: string;
  cpd: number;
  inventory: number;
  doi: number;
  category: string;
  region: string;
  sales: number;
  open_po: number;
  is_unavail: boolean;
  unavail_cpd: number;
};

// In local dev this is empty, so requests go through Vite's /api proxy to
// localhost:8000. In production (frontend and backend deployed as separate
// services, e.g. on Render) VITE_API_BASE is set at build time to the
// backend's own host, since a relative /api path would otherwise hit the
// static frontend's own origin instead of the backend.
const RAW_BASE = import.meta.env.VITE_API_BASE as string | undefined;
const API_BASE = RAW_BASE ? (RAW_BASE.startsWith("http") ? RAW_BASE : `https://${RAW_BASE}`) : "";

function qs(filters: Filters, extra: Record<string, string | number | undefined> = {}): string {
  const p = new URLSearchParams();
  filters.region?.forEach((v) => p.append("region", v));
  filters.wh?.forEach((v) => p.append("wh", v));
  filters.brand?.forEach((v) => p.append("brand", v));
  filters.category?.forEach((v) => p.append("category", v));
  if (filters.min_cpd) p.append("min_cpd", String(filters.min_cpd));
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== "") p.append(k, String(v));
  }
  return p.toString();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(API_BASE + path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  status: () => get<DataStatus>("/api/data/status"),

  upload: async (file: File, sheetName?: string, doiThreshold = 3): Promise<any> => {
    const fd = new FormData();
    fd.append("file", file);
    if (sheetName) fd.append("sheet_name", sheetName);
    fd.append("doi_threshold", String(doiThreshold));
    const res = await fetch(API_BASE + "/api/data/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Upload failed: ${res.status}`);
    }
    return res.json();
  },

  selectSheet: async (sheetName: string, doiThreshold = 3): Promise<any> => {
    const fd = new FormData();
    fd.append("sheet_name", sheetName);
    fd.append("doi_threshold", String(doiThreshold));
    const res = await fetch(API_BASE + "/api/data/select-sheet", { method: "POST", body: fd });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Sheet selection failed: ${res.status}`);
    }
    return res.json();
  },

  setDoiThreshold: async (threshold: number): Promise<DataStatus> => {
    const fd = new FormData();
    fd.append("threshold", String(threshold));
    const res = await fetch(API_BASE + "/api/data/doi-threshold", { method: "POST", body: fd });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Failed: ${res.status}`);
    }
    return res.json();
  },

  kpis: (f: Filters) => get<Kpis>(`/api/views/kpis?${qs(f)}`),
  rollup: (by: "brand" | "wh" | "region", f: Filters) => get<RollupRow[]>(`/api/views/rollup/${by}?${qs(f)}`),
  matrix: (f: Filters) => get<MatrixResponse>(`/api/views/matrix?${qs(f)}`),
  panIndia: (f: Filters, mode: "brand" | "sku", topPct: number) =>
    get<PanResponse>(`/api/views/pan-india?${qs(f, { mode, top_pct: topPct })}`),
  priorityQueue: (f: Filters, topN = 15) => get<PriorityRow[]>(`/api/views/priority-queue?${qs(f, { top_n: topN })}`),
  whItem: (f: Filters, drillBrand: string, topN = 30) =>
    get<WhItemResponse>(`/api/views/wh-item?${qs(f, { drill_brand: drillBrand, top_n: topN })}`),
  detail: (f: Filters, limit = 5000) => get<DetailRow[]>(`/api/views/detail?${qs(f, { limit })}`),
};
