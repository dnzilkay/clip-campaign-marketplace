# Clip Campaign Marketplace

A focused campaign marketplace for brands and short-form video creators. Admins can manage campaigns and review submissions; creators can browse active campaigns, submit platform-valid post URLs, and track views and estimated earnings.

The application uses Next.js 15 App Router, strict TypeScript, tRPC v11, Drizzle ORM, PostgreSQL, Tailwind CSS, shadcn/ui, React Hook Form, shared Zod schemas, and Vitest.

## Local setup

Prerequisites:

- Node.js 20 or 22 LTS
- pnpm 10+
- Docker with Docker Compose

From a clean checkout:

```bash
cp .env.example .env
pnpm install --frozen-lockfile
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm test
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Next.js will select the next free port if `3000` is occupied.

The seed command is safe to repeat and creates these demo users:

| Role | Email |
| --- | --- |
| Admin | `admin@example.com` |
| Creator | `creator.one@example.com` |
| Creator | `creator.two@example.com` |

Use the user switcher in the header to exercise both role-protected flows.

## Useful commands

```bash
pnpm dev          # Start the development server
pnpm test         # Run unit and PostgreSQL integration tests
pnpm typecheck    # Check strict TypeScript types
pnpm lint         # Run ESLint
pnpm build        # Create a production build
pnpm ingest       # Run the idempotent daily metrics sync
pnpm db:migrate   # Apply committed Drizzle migrations
pnpm db:seed      # Seed the reviewer demo data
pnpm db:studio    # Open Drizzle Studio
```

`pnpm test` expects the Docker database to be running and the migration and seed steps to have completed.

## Architecture notes

- `/api/trpc/[trpc]` is the only application-data HTTP transport. There are no REST endpoints for application data.
- Role and ownership checks run in tRPC middleware and procedures, independent of the UI.
- Approval freezes the latest-metric payout as a committed amount. PostgreSQL row locks serialize approval and campaign-budget changes.
- Unique indexes provide the final guard for one normalized post URL per campaign and one metric row per submission per day.
- All money values are integer cents, displayed explicitly as USD, and all application date boundaries use UTC.

See [NOTES.md](./NOTES.md) for assumptions, concurrency details, deliberate omissions, and AI usage.

## Deployment

The app can be deployed on any Next.js host with a reachable PostgreSQL database. For a Vercel deployment:

1. Provision a PostgreSQL database such as Neon or Supabase.
2. Run `pnpm db:migrate` and `pnpm db:seed` against that database.
3. Import this repository into Vercel.
4. Configure `DATABASE_URL`, a random `AUTH_COOKIE_SECRET` of at least 32 characters, and `DEV_AUTH_ENABLED=true` for the reviewer demo.
5. Deploy with the default Next.js build command.

The local Docker database is intentionally not used by the hosted application.
