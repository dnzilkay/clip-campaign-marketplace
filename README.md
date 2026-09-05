# Clip Campaign Marketplace

A focused campaign marketplace for brands and short-form video creators. Admins can manage campaigns and review submissions; creators can browse active campaigns, submit platform-valid post URLs, and track views and estimated earnings.

The application uses Next.js 15 App Router, strict TypeScript, tRPC v11, Drizzle ORM, PostgreSQL, Tailwind CSS, shadcn/ui, React Hook Form, shared Zod schemas, and Vitest.

## Live demo

[Open the live application](https://casestudy.dnzilkay.com/)

Hosted on Vercel with Neon PostgreSQL. Choose a seeded demo user on the opening screen to explore the admin or creator flow. No registration is required. The user switcher is enabled intentionally for this reviewer demo, not as production authentication.

## Local setup

Prerequisites:

- Node.js 22
- pnpm 10+
- Docker with Docker Compose

From a clean checkout:

```bash
git clone https://github.com/dnzilkay/clip-campaign-marketplace.git
cd clip-campaign-marketplace
cp .env.example .env
```

In `.env`, replace `AUTH_COOKIE_SECRET` with a random value of at least 32 characters. You can generate one with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep the supplied `DATABASE_URL` for local Docker and `DEV_AUTH_ENABLED=true` for the demo user switcher. Do not commit `.env` or database credentials.

Then install dependencies, start PostgreSQL, apply migrations, seed the demo, and run the tests:

```bash
pnpm install --frozen-lockfile
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm test
```

Start the application:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Next.js will select the next free port if `3000` is occupied.

The seed command is safe to repeat and creates these demo users:

| Role | Email |
| --- | --- |
| Admin | `admin@example.com` |
| Creator | `creator.one@example.com` |
| Creator | `creator.two@example.com` |

Select a user on the opening screen. Once signed in, use the header switcher to change accounts. Admins can manage campaigns and review submissions; creators can browse active campaigns and view their own submissions.

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

`pnpm test` expects the Docker database to be running and the migration and seed steps to have completed. Run tests against the local database, not the hosted demo database.

## Metrics sync

```bash
pnpm ingest
```

This script generates simulated views, likes, and comments; it does not call social media APIs. It writes to the database selected by `DATABASE_URL`, loaded from `.env` unless already set in the process environment.

- Only approved submissions are processed.
- Each submission receives at most one metric record per UTC day.
- Views never decrease.
- Repeating the command on the same day leaves existing records unchanged.
- A failure for one submission is reported without stopping the others.

The output reports `created`, `skipped`, and `failed` counts. A skipped record means that day's metric already exists. Refresh the campaign detail after a successful run to see the latest data. No automatic scheduler is configured.

## Architecture notes

- `/api/trpc/[trpc]` is the only application-data HTTP transport. There are no REST endpoints for application data.
- Role and ownership checks run in tRPC middleware and procedures, independent of the UI.
- Approval freezes the latest-metric payout as a committed amount. PostgreSQL row locks serialize approval and campaign-budget changes.
- Unique indexes provide the final guard for one normalized post URL per campaign and one metric row per submission per day.
- All money values are integer cents, displayed explicitly as USD, and all application date boundaries use UTC.

See [NOTES.md](./NOTES.md) for assumptions, concurrency details, deliberate omissions, and AI usage.

## Deployment

The live demo uses Vercel and Neon. To deploy your own instance:

1. Provision a PostgreSQL database such as Neon or Supabase.
2. Run `pnpm db:migrate` and `pnpm db:seed` against that database.
3. Import this repository into Vercel.
4. Configure `DATABASE_URL`, a random `AUTH_COOKIE_SECRET` of at least 32 characters, and `DEV_AUTH_ENABLED=true` for the reviewer demo.
5. Deploy with the default Next.js build command.

The `DATABASE_URL` value must be the connection URL alone, starting with `postgresql://`, without a `DATABASE_URL=` prefix or wrapping quotes. Set `DEV_AUTH_ENABLED` to the literal value `true` for the reviewer demo.

The local Docker database is intentionally separate from the hosted application. Migration, seed, and ingestion scripts run against whichever database their environment selects; confirm the target before running them. Never put database URLs containing credentials in the repository.
