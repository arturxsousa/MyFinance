# My Finance

A multi-tenant personal finance web app for tracking monthly incomes, expenses, and investments.

## Features

- Track incomes, expenses, and investments by month
- Credit card management with installment purchases and monthly statements
- Recurring entries (salary, rent, etc.) generated automatically
- Dashboard with charts: trends, category breakdown, investment growth
- CSV export of your own data
- Admin area for user management (never sees financial data)
- Strict per-user data isolation via PostgreSQL Row-Level Security

## Stack

- **Frontend:** Next.js (App Router, TypeScript) + Tailwind CSS + Recharts
- **Backend:** Next.js route handlers
- **Database:** PostgreSQL 16 (Neon)
- **ORM:** Drizzle ORM
- **Validation:** Zod
- **Tests:** Vitest
- **Deploy:** Vercel

## Getting started

```bash
# Install dependencies
npm install

# Copy env file and fill in the values
cp .env.example .env.local

# Run database migrations
npm run db:migrate

# Seed the database (system categories + first admin)
npm run db:seed

# Start the dev server
npm run dev
```

## Environment variables

See `.env.example` for the full list. Required:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `DATABASE_URL_UNPOOLED` | Neon direct connection (migrations) |
| `AUTH_SECRET` | Random secret for JWT signing |
| `EMAIL_API_KEY` | Resend or SES API key |
| `NEXT_PUBLIC_APP_URL` | Full app URL (e.g. https://myfinance.app) |

## Project structure

```
src/
  app/          # Next.js App Router pages and route handlers
  components/   # Shared UI components
  lib/          # DB client, auth helpers, utilities
  db/           # Drizzle schema and migrations
```

## License

Private.
