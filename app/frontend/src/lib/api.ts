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
  fill_L1?: number;
  fill_L2?: number;
  fill_L15?: number;
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
    binary_avail_pct: number;
    binary_n: number;
    binary_ok_n: number;
  };
  fill_rate_available: boolean;
};

export type WhItemCell = {
  cpd: number;
  inventory: number;
  doi: number;
  status: "OK" | "LOW" | "OUT";
  fill_L1?: number;
  fill_L2?: number;
};
export type WhItemRow = {
  item: string;
  brand: string;
  pan_cpd: number;
  weight_pct: number;
  avail_wtd: number;
  cells: Record<string, WhItemCell>;
};
export type WhItemResponse = { items: WhItemRow[]; warehouses: string[]; fill_rate_available: boolean };

export type WhItemDrillRow = {
  wh: string;
  region: string;
  cpd: number;
  inventory: number;
  doi: number;
  open_po: number;
  status: "OK" | "LOW" | "OUT";
  fill_L1: number | null;
  fill_L2: number | null;
};
export type WhItemDrill = {
  item: string;
  wh: string;
  brand: string;
  cpd_here: number;
  pct_of_national: number;
  inventory: number;
  doi: number;
  open_po: number;
  pipeline: number;
  national_cpd: number;
  national_wh_count: number;
  out_wh_count: number;
  out_cpd: number;
  fill_L1: number | null;
  fill_L2: number | null;
  fill_rate_available: boolean;
  rows: WhItemDrillRow[];
};

export type BrandWhDrillItem = {
  item: string;
  cpd: number;
  inventory: number;
  doi: number;
  open_po: number;
  unavail_cpd: number;
  status: "OK" | "LOW" | "OUT";
  fill_L1: number | null;
  fill_L2: number | null;
};
export type BrandWhDrill = {
  wh: string;
  brand: string;
  region: string;
  sku_count: number;
  total_cpd: number;
  unavail_cpd: number;
  unavail_pct: number;
  avail_wtd: number;
  inventory: number;
  open_po: number;
  doi_blended: number;
  fill_L1: number | null;
  fill_L2: number | null;
  fill_rate_available: boolean;
  items: BrandWhDrillItem[];
};

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
export const API_BASE = RAW_BASE ? (RAW_BASE.startsWith("http") ? RAW_BASE : `https://${RAW_BASE}`) : "";

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
  whItemDrill: (wh: string, item: string) =>
    get<WhItemDrill>(`/api/views/wh-item-drill?${new URLSearchParams({ wh, item }).toString()}`),
  whBrandDrill: (wh: string, brand: string) =>
    get<BrandWhDrill>(`/api/views/wh-brand-drill?${new URLSearchParams({ wh, brand }).toString()}`),
  detail: (f: Filters, limit = 5000) => get<DetailRow[]>(`/api/views/detail?${qs(f, { limit })}`),
};

export type FillWindow = { start: string; end: string };
export type FillStatus = {
  loaded: boolean;
  filename?: string;
  rows?: number;
  windows?: { L1: FillWindow; L2: FillWindow; L15: FillWindow; max_date: string; cutoff: string };
};

export type FillRow = {
  ordered_L1: number; grn_L1: number; lines_L1: number; fill_L1: number;
  ordered_L2: number; grn_L2: number; lines_L2: number; fill_L2: number;
  ordered_L15: number; grn_L15: number; lines_L15: number; fill_L15: number;
};
export type BrandFillRow = FillRow & { brand: string };
export type SkuFillRow = FillRow & { item_id: string; item: string; brand: string };
export type WhItemFillRow = FillRow & { wh: string; item_id: string; item: string; brand: string };

export const fillRateApi = {
  status: () => get<FillStatus>("/api/fillrate/status"),
  upload: async (file: File): Promise<FillStatus> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(API_BASE + "/api/fillrate/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Upload failed: ${res.status}`);
    }
    return res.json();
  },
  brand: (q?: string) => get<BrandFillRow[]>(`/api/fillrate/brand${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  sku: (q?: string, brand?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (brand) p.set("brand", brand);
    return get<SkuFillRow[]>(`/api/fillrate/sku?${p.toString()}`);
  },
  whItem: (opts: { itemId?: string; wh?: string; brand?: string } = {}) => {
    const p = new URLSearchParams();
    if (opts.itemId) p.set("item_id", opts.itemId);
    if (opts.wh) p.set("wh", opts.wh);
    if (opts.brand) p.set("brand", opts.brand);
    return get<WhItemFillRow[]>(`/api/fillrate/wh-item?${p.toString()}`);
  },
  warehouses: () => get<string[]>("/api/fillrate/warehouses"),
  brands: () => get<string[]>("/api/fillrate/brands"),
};

// ---------------- Purchase Manager ----------------

export type InboundStatus = { loaded: boolean; filename?: string; rows?: number };
export type InboundRow = {
  date: string;
  wh: string;
  zone: string;
  cap: number;
  planned: number;
  grn: number;
  failed: number;
  utilization_pct: number;
  is_low: boolean;
};
export type InboundSummaryRow = {
  wh: string;
  zone: string;
  days: number;
  avg_cap: number;
  avg_planned: number;
  avg_grn: number;
  avg_utilization: number;
  low_days: number;
};

export type FestiveStatus = { loaded: boolean; ptypes: { ptype: string; rows: number }[] };
export type FestiveRow = {
  wh: string;
  brand: string;
  item: string;
  inventory: number;
  fe_inventory: number;
  cpd: number;
  open_po: number;
  projection: number;
  bau_safety: number;
  need: number;
  requirement: number;
  ach_be: number;
  ach_po: number;
  remark: string;
  ptype: string;
  region: string;
};

export type FestiveOverview = {
  ptypes: string[];
  ptype_count: number;
  row_count: number;
  warehouse_count: number;
  brand_count: number;
  total_requirement: number;
  total_need: number;
  ach_be_pct: number;
  ach_po_pct: number;
  at_risk_count: number;
  at_risk_requirement: number;
};

export type FestiveDimRow = {
  ptype?: string;
  brand?: string;
  region?: string;
  wh?: string;
  inventory: number;
  open_po: number;
  requirement: number;
  need: number;
  row_count: number;
  brand_count: number;
  wh_count: number;
  at_risk_count: number;
  ach_be_pct: number;
  ach_po_pct: number;
};

export type FocusItemRow = {
  wh: string;
  brand: string;
  item: string;
  region: string;
  category: string;
  cpd: number;
  inventory: number;
  doi: number;
  open_po: number;
  is_unavail: boolean;
};

export type DeliveryRow = {
  wh: string;
  brand: string;
  item: string;
  item_id: string;
  ordered: number;
  po_lines: number;
};

export type PmOverview = {
  focus_items: {
    count: number;
    at_risk_cpd: number;
    top: { wh: string; brand: string; item: string; cpd: number; doi: number; inventory: number }[];
  } | null;
  inbound: {
    avg_utilization: number;
    low_wh_count: number;
    wh_count: number;
    top: { wh: string; zone: string; avg_utilization: number; avg_planned: number; avg_grn: number }[];
  } | null;
  festive: {
    total_requirement: number;
    ptype_count: number;
    row_count: number;
    top: { wh: string; brand: string; item: string; ptype: string; requirement: number }[];
  } | null;
  deliveries: {
    total_units: number;
    po_lines: number;
    row_count: number;
    top: { wh: string; brand: string; item: string; ordered: number; po_lines: number }[];
  } | null;
};

function whParams(wh?: string[]): string {
  const p = new URLSearchParams();
  wh?.forEach((w) => p.append("wh", w));
  return p.toString();
}

export const pmApi = {
  inboundStatus: () => get<InboundStatus>("/api/inbound/status"),
  inboundUpload: async (file: File): Promise<InboundStatus> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(API_BASE + "/api/inbound/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Upload failed: ${res.status}`);
    return res.json();
  },
  inboundUtilization: (wh?: string[], days = 7) =>
    get<InboundRow[]>(`/api/inbound/utilization?${whParams(wh)}&days=${days}`),
  inboundSummary: (wh?: string[], days = 7) =>
    get<InboundSummaryRow[]>(`/api/inbound/summary?${whParams(wh)}&days=${days}`),

  festiveStatus: () => get<FestiveStatus>("/api/festive/status"),
  festiveUpload: async (file: File, ptype: string): Promise<any> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("ptype", ptype);
    const res = await fetch(API_BASE + "/api/festive/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Upload failed: ${res.status}`);
    return res.json();
  },
  festiveRequirements: (wh?: string[], ptype?: string) => {
    const p = new URLSearchParams(whParams(wh));
    if (ptype) p.append("ptype", ptype);
    return get<FestiveRow[]>(`/api/festive/requirements?${p.toString()}`);
  },
  festiveOverview: () => get<FestiveOverview>("/api/festive/overview"),
  festiveByPtype: () => get<FestiveDimRow[]>("/api/festive/by-ptype"),
  festiveByBrand: (ptype?: string) => get<FestiveDimRow[]>(`/api/festive/by-brand${ptype ? `?ptype=${encodeURIComponent(ptype)}` : ""}`),
  festiveByRegion: (ptype?: string) => get<FestiveDimRow[]>(`/api/festive/by-region${ptype ? `?ptype=${encodeURIComponent(ptype)}` : ""}`),
  festiveByWarehouse: (ptype?: string) => get<FestiveDimRow[]>(`/api/festive/by-warehouse${ptype ? `?ptype=${encodeURIComponent(ptype)}` : ""}`),

  focusItems: (wh?: string[], doiMax = 3, topN = 30) => {
    const p = new URLSearchParams(whParams(wh));
    p.append("doi_max", String(doiMax));
    p.append("top_n", String(topN));
    return get<FocusItemRow[]>(`/api/pm/focus-items?${p.toString()}`);
  },
  deliveriesToday: (wh?: string[]) =>
    get<{ date: string; rows: DeliveryRow[] }>(`/api/pm/deliveries-today?${whParams(wh)}`),
  overview: (wh?: string[]) => get<PmOverview>(`/api/pm/overview?${whParams(wh)}`),
};

// ---------------- Tags & Reasons ----------------

export type TagsStatus = {
  loaded: boolean;
  weeks: { week: string; label: string; rows: number }[];
  total_rows?: number;
};

export type TagsOverview = {
  latest_week_label: string | null;
  weeks_available: number;
  total_rows: number;
  coverage_pct: number;
  prev_coverage_pct: number | null;
  top_tag: string | null;
  top_tag_count: number;
  top_tag_prev_count: number | null;
  good_pct: number;
  prev_good_pct: number | null;
  at_risk_cpd: number;
};

export type TagTrendRow = { week: string; week_label: string; tag: string; count: number; at_risk_cpd: number };
export type TagCoverageRow = { week: string; week_label: string; total: number; tagged: number; coverage_pct: number };

export type TagByDimRow = { tag: string; count: number; at_risk_cpd: number } & Record<string, any>;

export type ChronicIssueRow = {
  wh: string;
  brand: string;
  region: string;
  weeks_affected: number;
  tags: string;
  latest_tag: string;
  total_at_risk_cpd: number;
  latest_remark: string;
};

export type TagDetailRow = {
  week_label: string;
  wh: string;
  region: string;
  brand: string;
  tag: string;
  remark: string;
  category_remark: string;
  cpd: number;
  avail_wtd: number;
  doi: number;
  active_skus: number;
  unavail_cpd: number;
  skus_note: string;
};

export type TagsFacets = { warehouses: string[]; brands: string[]; tags: string[] };

export const tagsApi = {
  status: () => get<TagsStatus>("/api/tags/status"),
  upload: async (file: File): Promise<any> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(API_BASE + "/api/tags/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Upload failed: ${res.status}`);
    return res.json();
  },
  overview: () => get<TagsOverview>("/api/tags/overview"),
  trend: () => get<{ trend: TagTrendRow[]; coverage: TagCoverageRow[] }>("/api/tags/trend"),
  byBrand: (week?: string) => get<TagByDimRow[]>(`/api/tags/by-brand${week ? `?week=${encodeURIComponent(week)}` : ""}`),
  byWarehouse: (week?: string) => get<TagByDimRow[]>(`/api/tags/by-warehouse${week ? `?week=${encodeURIComponent(week)}` : ""}`),
  chronic: (minWeeks = 3) => get<ChronicIssueRow[]>(`/api/tags/chronic?min_weeks=${minWeeks}`),
  detail: (params: { week?: string; tag?: string[]; wh?: string[]; brand?: string[] } = {}) => {
    const p = new URLSearchParams();
    if (params.week) p.append("week", params.week);
    params.tag?.forEach((t) => p.append("tag", t));
    params.wh?.forEach((w) => p.append("wh", w));
    params.brand?.forEach((b) => p.append("brand", b));
    return get<TagDetailRow[]>(`/api/tags/detail?${p.toString()}`);
  },
  facets: () => get<TagsFacets>("/api/tags/facets"),
};
