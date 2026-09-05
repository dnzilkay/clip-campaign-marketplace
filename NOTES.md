# Project Notes

## Live demo

[https://casestudy.dnzilkay.com](https://casestudy.dnzilkay.com)

The demo runs on Vercel with a Neon PostgreSQL database.

## Local setup

Requirements: Node.js 22, pnpm 10+, and Docker with Docker Compose.

```bash
git clone https://github.com/dnzilkay/clip-campaign-marketplace.git
cd clip-campaign-marketplace
cp .env.example .env
pnpm install --frozen-lockfile
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm test
pnpm dev
```

Before starting the application, replace `AUTH_COOKIE_SECRET` in `.env` with a random value of at least 32 characters. Keep the supplied database URL for local Docker and `DEV_AUTH_ENABLED=true` for the demo user switcher.

Open `http://localhost:3000`. Select one of the seeded accounts:

- Admin: `admin@example.com`
- Creator: `creator.one@example.com`
- Creator: `creator.two@example.com`

Run the simulated daily metrics sync with:

```bash
pnpm ingest
```

It uses the database configured in `.env`. It processes approved submissions, keeps views non-decreasing, skips existing records for the same UTC day, and reports individual failures without stopping the remaining submissions.

## Concurrent approvals and budget protection

Approval runs inside a PostgreSQL transaction. It locks the campaign row using `SELECT … FOR UPDATE`, then locks and rechecks the submission.

The payout is calculated from the latest metric using integer cents:

```text
floor(views / 1000) * payout_per_1k_views
```

While holding the campaign lock, the transaction checks existing committed payouts. If the new approval would exceed the budget, it fails with the typed `CAMPAIGN_BUDGET_EXCEEDED` error.

Concurrent approvals for the same campaign therefore run sequentially at the database level. If the budget only covers one, the second transaction sees the first transaction’s committed allocation and cannot overspend. Campaign budget edits use the same campaign-row lock. A campaign is automatically marked completed when its remaining budget reaches zero.

This avoids relying on a UI check or an in-memory lock, which would not protect requests running on separate server instances. A PostgreSQL integration test covers competing approvals.

## Assumptions and scope

An approval fixes the committed payout using the latest metric available at approval time. Later metrics update views and earnings estimates, but do not increase that committed allocation. This is an explicit interpretation of the payout lifecycle, not a continuously accruing payment system.

Real authentication, third-party social API integrations, and actual payment processing are outside this demo’s scope. Authentication uses signed cookies and a demo user switcher; authorization is enforced on the server.

The metrics sync is a manually invoked script. An automatic scheduler was not added.

## With another day

I would first expand the automated tests, especially end-to-end user flows and additional edge cases, then use those results to improve usability and error handling.

## AI usage

I used AI tooling throughout the project. Providing prompts, reviewing the generated outputs, and checking the application helped me move much faster.

I did not manually edit the generated code. When changes were needed, I described the issue through follow-up prompts and reviewed the resulting revisions. My role focused on directing the implementation, checking the outputs, and making decisions about the final result.
