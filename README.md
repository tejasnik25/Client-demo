# Stock Analysis App – Vercel + MySQL Deployment Guide

This project is a Next.js application with serverless API routes and a MySQL backend. It supports wallet transactions, admin payment verification, and strategy management. This guide walks you through deploying the app to Vercel and connecting it to a managed MySQL database.

## Overview
- Frontend: Next.js App Router
- Auth: `next-auth` (Credentials provider)
- Database: MySQL via `mysql2/promise`
- Serverless APIs: Next.js API routes
- Cloud: Vercel (deploy + environment management)

## Prerequisites
- Vercel account and access to GitHub/GitLab/Bitbucket
- Managed MySQL instance (e.g., PlanetScale, Aiven, Railway, AWS RDS)
- Node.js 18+ locally

## Environment Variables
Set the following variables both locally (`.env.local`) and in Vercel Project Settings → Environment Variables.

- `DB_HOST` – MySQL host
- `DB_USER` – MySQL user
- `DB_PASSWORD` – MySQL password
- `DB_NAME` – MySQL database name
- `DB_PORT` – MySQL port (default `3306`)
- `NEXTAUTH_SECRET` – secret for NextAuth; generate one with `npx next-auth secret`
- `NEXTAUTH_URL` – app base URL (e.g., `https://your-project.vercel.app`)
- `COOKIE_DOMAIN` – optional; set to your domain in production to align cookies
- `NEXT_PUBLIC_USDT_ERC20_ADDRESS` – public USDT ERC20 wallet address
- `NEXT_PUBLIC_USDT_TRC20_ADDRESS` – public USDT TRC20 wallet address
- `NEXT_PUBLIC_USDT_WALLET_APP_LINK` – optional deep link to your wallet app

Notes:
- The code reads DB config from `src/db/db.ts`. SSL/TLS is provider-specific; see Troubleshooting if your provider requires client-side TLS options.
- Admin and test users are seeded automatically by `dbService` on startup.

## Local Setup
1. Clone the repo and install dependencies:
   - `npm install`
2. Create `.env.local` in the project root with the variables above.
3. Apply schema migrations to your MySQL database:
   - `node scripts/migrate.js`
   - Ensure your `.env.local` points to the remote database you intend to use; the migrator reads `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
4. Start the dev server:
   - `npm run dev`
   - Open `http://localhost:3000`

## Deploy to Vercel
1. Push your repository to GitHub/GitLab/Bitbucket.
2. In Vercel, import the project and pick your repo.
3. Configure Build & Output:
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
   - Framework Preset: Next.js
4. Add environment variables (see list above) in Vercel → Settings → Environment Variables.
   - Add to “Production” and optionally “Preview/Development” as needed.
5. Run your database migrations against the same production DB:
   - Option A: Locally, set `.env.local` to production DB values, then run `node scripts/migrate.js`.
   - Option B: Use your provider’s migration tools/console to apply `src/db/mysql_schema.sql`.
6. Deploy. Vercel will build and serve the app. Once live, verify:
   - `https://your-project.vercel.app/login` – user login
   - `https://your-project.vercel.app/admin-login` – admin login (admin@example.com / admin123 by default)
   - `https://your-project.vercel.app/strategies` – explore and deploy strategies

## Admin & Strategy Flow Verification
- After a user pays and an admin approves a payment, approved strategies appear:
  - On `/strategies` under the “Deployed Strategies” tab
  - On `/strategies/running` under approved and active strategies
- The app forwards `strategyId` and `plan` to `/wallet/topup`, persists `strategy_id` and `plan_level` in wallet transactions, and those are fetched post-approval to populate these views.

## DB Schema & Seeding
- Schema lives at `src/db/mysql_schema.sql` and is applied via `scripts/migrate.js`.
- On startup, `dbService` attempts to auto-migrate missing columns and seed users/strategies:
  - Admin: `admin@example.com` / `admin123`
  - Test users for local testing

## Troubleshooting
- MySQL TLS/SSL errors:
  - Some providers (e.g., PlanetScale/Aiven) require TLS. The migration script includes `ssl`, but runtime pool in `src/db/db.ts` may need `ssl` options. If your provider requires it, update the pool config to include `ssl: { rejectUnauthorized: false }` or provide CA certs per provider docs.
- NextAuth session/cookie issues:
  - Ensure `NEXTAUTH_URL` matches your Vercel domain.
  - Optionally set `COOKIE_DOMAIN` to your apex domain.
- Serverless timeouts:
  - `vercel.json` sets function `maxDuration` and region. Adjust if needed for your account/region.
- `/api/test-db` route:
  - This test endpoint uses `src/lib/db.js` (local-only config). For production DB verification, prefer `/api/wallet/transactions` or add a new test using the primary pool (`src/db/db.ts`).

## Useful Commands
- `npm run dev` – start local dev server
- `npm run build` – build the app
- `npm start` – run production build locally
- `node scripts/migrate.js` – apply SQL schema to configured MySQL DB

## Environment Reference
- Auth: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `COOKIE_DOMAIN`
- DB: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
- Payments: `NEXT_PUBLIC_USDT_ERC20_ADDRESS`, `NEXT_PUBLIC_USDT_TRC20_ADDRESS`, `NEXT_PUBLIC_USDT_WALLET_APP_LINK`

## Notes
- Keep your secrets safe; do not commit `.env*` files.
- The admin workflow simulates email notifications in logs; integrate a real SMTP provider if needed.
