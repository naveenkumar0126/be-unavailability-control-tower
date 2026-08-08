# BE Unavailability Control Tower

A dashboard for tracking backend (warehouse) stock unavailability across brands, warehouses, and SKUs — availability KPIs, PAN-India demand contribution, warehouse×brand heatmaps, and SKU-level drill-downs.

Rebuilt from an original single-file HTML prototype into a proper two-service app:

- **`app/backend`** — FastAPI + pandas. Ingests CSV/Excel uploads (flexible column matching), computes weighted/normal availability, PAN India contribution, and warehouse-level rollups.
- **`app/frontend`** — React + Vite + Tailwind + ECharts. KPI tiles, filters, and 9 views (Action Board, Overview, PAN India, Brand/Warehouse/Region rollups, Brand×WH matrix, Warehouse×Item grid, Detail).

## Status

Availability workspace is functional. Tags & Reasons and Festive workspaces are planned next, along with persistence (Postgres), scheduled daily refresh from Google Sheets, and Google Workspace SSO login.

## Running locally

**Backend**
```bash
cd app/backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd app/frontend
npm install
npm run dev
```

Open http://localhost:5173 and upload a CSV or Excel file to get started.

## Data privacy

No sample or real data files are committed to this repo — the dashboard is data-agnostic and expects you to upload your own CSV/Excel export.
