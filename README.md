# AutoEDA Frontend

Next.js 14 web application for Exploratory Data Analysis.

## Quick Start

### 1. Clone and Install
```bash
git clone <autoeda-frontend-repo>
cd autoeda-frontend
npm install
```

### 2. Configure Environment
Create `.env.local` file in the root directory:
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

For production, set `NEXT_PUBLIC_API_URL` to your backend URL.

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
npm run build
npm start
```

## Environment Variables

- `NEXT_PUBLIC_API_URL` - Backend API base URL (required)

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- TanStack Query v5
- Zustand
- Tailwind CSS
