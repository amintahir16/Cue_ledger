# CueLedger — Snooker Club Manager

Full-stack admin app for snooker clubs: table timers, hourly billing, expenses, and profit dashboard.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS
- **PostgreSQL** via **Prisma 7**
- **Better Auth** (single admin, email/password, signup disabled)

## Features

### Core
- Admin login (one system user)
- Add/manage snooker tables with per-table hourly rates
- Per-table timer: **Start / Pause / Resume / Stop / Reset**
- On stop: bill = playable time × hourly rate (minus pauses), plus F&B extras
- Dashboard with **day / month / year** filters
- Stat cards: revenue, expenses, **actual profit**, games, occupancy, pending payments, etc.
- Expenses: electricity, rent, salaries, maintenance, and more (deducted from revenue for profit)

### Pro additions included
- Session history + mark paid / pay later
- Customer registry
- F&B / extras catalog attachable to live games
- Club settings (currency, minimum charge, billing increment)
- Daily cash closing notes

## Quick start

### 1. Database

**Option A — Docker**

```bash
docker compose up -d
```

Set in `.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/snooker_club"
```

**Option B — Prisma local Postgres (no Docker)**

```bash
npx prisma dev --name snooker --detach
```

Use the TCP URL printed (or keep the project `.env` pointing at that instance), create DB `snooker_club` if needed, then:

```bash
npm run db:setup
```

### 2. Environment

Copy `.env.example` → `.env` and set:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET` (32+ random chars)
- `BETTER_AUTH_URL=http://localhost:3000`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` (for seed)

### 3. Install, migrate, seed, run

```bash
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Default seeded login (if unchanged):

- Email: `admin@snooker.club`
- Password: `Admin@12345`

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run db:push` | Sync Prisma schema |
| `npm run db:seed` | Seed admin + sample tables/products |
| `npm run db:setup` | Push + seed |

## Architecture notes

- Timers persist on the server (`GameSession` start/pause timestamps). The UI ticks locally for display; stop recalculates charge on the server.
- Auth: Better Auth with `disableSignUp: true` — only the seeded admin can sign in.
- Profit: `actualProfit = completed session revenue − expenses` for the selected period.

## Design system

UI follows `design-system/snooker-club-manager/MASTER.md` (championship red + gold, Fira Code / Fira Sans).
