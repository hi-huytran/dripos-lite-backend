# Dripos Lite — Backend

## Overview

Backend for Dripos Lite, a phone-first point-of-sale app. Built with Node.js, Express, and TypeScript, backed by PostgreSQL, and deployed on Railway.

## Architecture

The codebase follows a 3-layer structure:

```
routes/       HTTP only — parse req params/body, call a service, map the result to a status code + JSON response
services/     Validation and business logic — including all money/tax math — plus snake_case -> camelCase conversion
repositories/ All SQL — raw queries and the ticket-creation transaction live here, nowhere else
```

Routes never touch the database or contain business rules. Services never run SQL directly — they call repository functions. This keeps request handling, business logic, and persistence independently testable and easy to trace.

## Local Setup

**Prerequisites**
- Node 18+
- A Postgres database (e.g. a Railway Postgres instance)

**Steps**

```bash
git clone <repo-url>
cd dripos-lite-backend
npm install
```

Create a `.env` file in the project root:

```
DATABASE_URL=<your postgres connection string>
```

Run the migration to create all tables from [`schema.sql`](schema.sql):

```bash
npm run migrate
```

Seed the database with products and modifier groups from the Dripos mock API (`https://crema.dripos.com/api/mock/VFP9EVKH`):

```bash
npm run seed
```

The seed script uses `INSERT ... ON CONFLICT DO NOTHING`, so it's safe to re-run — it won't create duplicate rows.

Start the server locally:

```bash
npm run dev
```

Or run it the way Railway does — compile first, then run the compiled output:

```bash
npm run build && npm start
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string. The server throws on startup if this is unset. |
| `PORT` | No | Port the Express server listens on. Defaults to `3000` if not set. |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/products` | List all products, including sold-out ones, with nested modifier groups/options. |
| `GET` | `/products/:id` | Get a single product with nested modifier groups/options. |
| `POST` | `/tickets` | Create a ticket from cart items; server validates and prices everything server-side. |
| `GET` | `/tickets` | List tickets, newest first (lightweight — no nested items). |
| `GET` | `/tickets/:id` | Get full ticket detail, including line items and their modifiers. |

## Deployment

Deployed on Railway, with the Postgres database and the backend service in the same Railway project. The backend's `DATABASE_URL` references the Postgres service's internal connection string via Railway's internal networking, rather than a public URL.

## Notes on Money Handling

- All monetary values are integer cents (`priceCents`, `totalCents`, etc.) — no floating-point currency math. (for example, $1.01 is 101)
- Tax is `8.875%` of the subtotal, rounded with `Math.round`.
- The server never trusts client-submitted prices or totals. `POST /tickets` recomputes every unit price, line total, subtotal, tax, and total from the product and modifier data currently stored in the database.
