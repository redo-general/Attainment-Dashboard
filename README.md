# Deal Attainment Dashboard

A live cohort-attainment dashboard for Redo's usage-based deals, hosted in the
**Fridge** at **https://deal-attainment.fridge.redo.builders**.

It answers: for the deals a rep closed in a given month (a *cohort*), what
percentage of the expected monthly revenue (deal ARR ÷ 12) are we actually
*attaining* from the relevant revenue streams, month by month?

## Data sources

Everything runs as read-only SQL through the **Fridge Snowflake runtime API**
(`fridge.snowflake.query`) — deterministic, server-side, no model in the loop.

| Source | Role |
| --- | --- |
| `STAGING.HUBSPOT.STG_DEALS` | Closed-won deals: `PRODUCT` (deal type), `DEAL_AMOUNT` (annualized ARR), `CLOSED_WON`, `TEAM_ID` (Redo ID) |
| `KITCHEN.PANTRY.INGR_MONTHLY_REPORT_V2` | One row per merchant per platform per month; per-product revenue columns |

**Join key:** `STG_DEALS.TEAM_ID` = `INGR_MONTHLY_REPORT_V2."Merchant ID"` (Redo /
Merchant / Team ID).

## Method

- **Cohort month** = `CLOSED_WON` converted to **America/Denver (MST)** then
  truncated to the month.
- **Expected monthly** = deal `DEAL_AMOUNT` ÷ 12 (HubSpot amount is annualized).
- **Attribution — latest deal wins:** for each merchant + deal type, each
  month's revenue and expected value credit the most recent deal closed on or
  before that month. Superseded re-signs drop out of both numerator and
  denominator from that month on, so re-signed merchants never double-count.
- **Attainment** = Σ attributed revenue ÷ Σ expected, recomputed live for
  whatever deal types are in view.
- **No match** row — closed-won deals whose Redo ID is null or absent from the
  Monthly Report (unmeasurable, kept out of cohort attainment but surfaced).
- **Unattributed revenue** row — mapped-column revenue from merchants with no
  included deal of that type, so the table reconciles to Monthly Report totals.

The deal-type → revenue-column mapping is fully editable in the **Configure**
drawer (a type can sum multiple columns), and persists in `fridge.db`. The last
refresh is cached in `fridge.db` too, so the dashboard loads instantly and
re-queries only on **Refresh** or a config change.

## Files

- **`index.html`** — the deployed app. Self-contained: theme, SQL generators,
  the client-side attainment model, and a vanilla-JS UI, importing the Fridge
  SDK from `/api/sdk` at runtime. This is what is served by the Fridge.
- **`src/`** — the same app as modular React components (reference / alternate
  implementation). `npm run build` bundles it via esbuild.
- **`build.mjs`, `package.json`** — esbuild config for the React variant.

## Deploying updates

The Fridge site is a static-only deployment. To update the served app, edit
`index.html` and republish through the Redo Unified MCP
(`fridge_publish_site_files`, `html` param) or push to the site's hidden Git
remote. Config and cached data survive redeploys (they live in `fridge.db`).

## Why not a claude.ai artifact?

The original was a claude.ai artifact, but artifacts can only reach Snowflake by
routing SQL through a Claude API call, where an intermediary model decides
whether to run each query — and it kept (reasonably) refusing. Hosting in the
Fridge replaces that with a real, authenticated, deterministic Snowflake runtime
bound to the signed-in Redo user.
