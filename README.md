# AutoEDA Frontend

Next.js 14 app for exploratory data analysis: connect or upload a dataset, get an automatic profile, then explore it via a full EDA toolkit, an AI agent (Scout), and evidence-backed hypothesis testing.

## Prerequisites

- Node.js 20+
- The AutoEDA backend running locally (see `autoeda-backend/README.md`)

## Quick Start (Local)

### 1. Install dependencies

```bash
cd autoeda-frontend
npm install
```

> `legacy-peer-deps=true` is already set in `.npmrc` — no extra flags needed.

### 2. Configure environment

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_API_URL=/api
EC2_API_URL=http://localhost:8000/api/v1
```

**How the proxy works:** Browser calls always go to `/api` (same origin), which is a Next.js proxy route (`app/api/[[...proxy]]/route.ts`) that forwards them to `EC2_API_URL` on the server side. This avoids CORS issues and Vercel's request body size limit for large uploads.

For production, set `EC2_API_URL` to the deployed backend URL.

### 3. Start the dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

Default login: use the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in the backend `.env`.

### 4. Build for production

```bash
npm run build
npm start
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | API path the browser calls — always `/api` (do not point directly at the backend) |
| `EC2_API_URL` | Yes | Server-side only — the real backend URL the proxy forwards to (e.g. `http://localhost:8000/api/v1`) |

---

## What's in here

**Per-dataset EDA**: profiling, distributions, correlations (Pearson/Spearman/Kendall, Cramér's V, η², significance-gated), missing values, outliers, feature importance (RF/MI/ANOVA/permutation/SHAP, redundancy/leakage detection, minimal-feature-set finder), time series, text analysis, quality rules.

**Tools**: Transform Studio (preview before applying), SQL editor, connector-based Data Sources (databases, cloud storage, REST APIs).

**Workspace-level** (span every dataset, not just one):
- **Scout** — tool-calling AI agent: profiling, correlations, SQL, sandboxed Python, real statistical tests, streamed with visible step-by-step progress.
- **Hypotheses** — propose a claim (or let Scout generate one), get a verdict backed by a real computed test.
- **Warehouse** — SQL across every dataset in the workspace at once.

---

## Project Structure

```
app/                        Next.js App Router pages
  (auth)/                   Login page
  (dashboard)/              Everything behind auth
    datasets/[datasetId]/   Per-dataset EDA tabs (profile, correlations, timeseries, ...)
    workspaces/[id]/        Workspace-level features (Scout, Hypotheses, Warehouse, ...)
  api/[[...proxy]]/         Backend proxy route
components/
  charts/                   Chart components (Plotly, Recharts, D3)
  layout/                   Sidebar, header, breadcrumbs
  shared/                   Reusable widgets (Mascot, StatCard, DataTable, ...)
lib/
  api.ts                    All backend API calls
  queryKeys.ts              TanStack Query cache keys
store/                      Zustand stores (auth, workspace selection, theme)
types/                      TypeScript types matching backend Pydantic schemas
```

---

## Tech Stack

- Next.js 14 (App Router) + React 18 + TypeScript
- TanStack Query v5 for data fetching and caching
- Zustand for client state
- Tailwind CSS
- Recharts + Plotly + D3 for charts
- `react-markdown` + `remark-gfm` for AI-generated content (Scout, Hypotheses)
- TipTap for rich text, Monaco for SQL/code editors

