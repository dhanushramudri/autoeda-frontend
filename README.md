# AutoEDA Frontend

Next.js 14 app for exploratory data analysis: connect or upload a dataset, get an automatic profile, then explore it via a full EDA toolkit, an AI agent (Scout), and evidence-backed hypothesis testing.

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Configure Environment

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_API_URL=/api
EC2_API_URL=http://localhost:8000/api/v1
```

Calls go through a Next.js proxy (`app/api/[[...proxy]]/route.ts`), not directly to the backend — Vercel caps serverless request bodies at ~4.5MB, so large uploads go straight to S3 instead. `EC2_API_URL` (server-side only) is where the proxy forwards to; `NEXT_PUBLIC_API_URL=/api` is what the browser calls.

For production, point `EC2_API_URL` at the deployed backend.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Build for Production

```bash
npm run build
npm start
```

## What's in here

**Per-dataset EDA**: profiling, distributions, correlations (Pearson/Spearman/Kendall, Cramér's V, η², significance-gated), missing values, outliers, feature importance (RF/MI/ANOVA/permutation/SHAP, redundancy/leakage detection, minimal-feature-set finder), time series, text analysis, quality rules.

**Tools**: Transform Studio (preview before applying), SQL editor, connector-based Data Sources (databases, cloud storage, REST APIs, SaaS platforms).

**Workspace-level** (span every dataset, not just one):
- **Scout** — tool-calling AI agent: profiling, correlations, SQL, sandboxed Python, real statistical tests, streamed with visible step-by-step progress.
- **Hypotheses** — propose a claim (or let Scout generate one), get a verdict backed by a real computed test.
- **Warehouse** — SQL across every dataset in the workspace at once.
- **Join Builder** — visually combine datasets without writing SQL.

## Project Structure

```
app/                  Next.js App Router pages
  (auth)/             Login
  (dashboard)/        Everything behind auth — workspaces, datasets, Scout, Hypotheses, etc.
  api/[[...proxy]]/   The backend proxy route described above
components/           Shared UI (charts, layout, shared widgets, per-feature components)
lib/                  api.ts (all backend calls), queryKeys.ts, markdown rendering, utils
store/                Zustand stores (auth, workspace selection)
types/                Shared TypeScript types matching the backend's Pydantic schemas
```

## Tech Stack

- Next.js 14 (App Router) + React 18 + TypeScript
- TanStack Query v5 for data fetching/caching
- Zustand for client state
- Tailwind CSS
- Recharts + Plotly + D3 for charts
- `react-markdown` + `remark-gfm` for AI-generated content (Scout, Hypotheses)
- TipTap for rich text, Monaco for the SQL/code editors, React Flow for the Join Builder

## Environment Variables

- `NEXT_PUBLIC_API_URL` — the path the browser calls (`/api` in every normal setup; do not point this at the backend directly)
- `EC2_API_URL` — server-side only; the real backend URL the proxy forwards to
