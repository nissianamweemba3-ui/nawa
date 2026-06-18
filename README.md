# AFIS — AI-Powered Fleet Intelligence System
### Enterprise Fleet Management Platform · Bantu Track Pvt Ltd

Production-ready Next.js platform merging the AFIS AI Fleet Manager and SIM Card Management Module.

## Platform

| Feature | Status |
|---|---|
| Executive Dashboard (KPIs + Charts) | ✅ |
| AI Analysis Centre + Ask AFIS AI | ✅ |
| 12 AI Report Templates | ✅ |
| SIM Card Management (80 SIMs) | ✅ |
| Vehicle Management (68 vehicles) | ✅ |
| Tracking Device Management (80 devices) | ✅ |
| Customer Management (30 accounts) | ✅ |
| Alerts & Exceptions (48 alerts) | ✅ |
| Fleet Utilization Analytics | ✅ |
| Live Vehicle Map | ✅ |
| Reports & Export | ✅ |
| Settings & RBAC | ✅ |
| Supabase Schema (full production) | ✅ |
| Dark Mode | ✅ |

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 — demo credentials are pre-filled.

## Database

Run in Supabase SQL Editor in order:
1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_sample_data.sql`

## Tech Stack

Next.js 16 · TypeScript · Tailwind CSS · Recharts · Supabase · Claude AI · Vercel
