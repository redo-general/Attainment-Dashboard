# Deal Attainment Dashboard

A live analytics dashboard for Redo's usage-based deals, hosted in the
**Fridge** at **https://deal-attainment.fridge.redo.builders**. A left-hand menu
switches between two dashboards:

- **Deal Attainment** — the cohort-attainment grid (below).
- **Product Adoption** — merchant product breadth over time (see *Product
  adoption* below).

## Deal Attainment

It answers: for the deals a rep closed in a given month (a *cohort*), what
percentage of the expected monthly revenue (deal ARR ÷ 12) are we actually
*attaining* from the relevant revenue streams, month by month?

A cohort's booked ARR always equals the **total closed-won amount** for that
month, regardless of whether a deal has revenue tied to it. A deal whose Redo ID
never matched the Monthly Report (e.g. Marc Jacobs), or whose product type has no
mapped revenue column, still counts toward its cohort — it simply attains $0 and
drags attainment down. Only *orphaned revenue* (Monthly Report revenue with no
deal behind it) lives outside the cohorts, in its own row.

## Data sources

Everything runs as read-only SQL through the **Fridge Snowflake runtime API**
(`fridge.snowflake.query`) — deterministic, server-side, no model in the loop.

| Source | Role |
| --- | --- |
| `STAGING.HUBSPOT.STG_DEALS` | Closed-won deals in the **New Business (`default`) + XSell (`702972541`)** pipelines: `PRODUCT` (deal type), `DEAL_AMOUNT` (annualized ARR), `CLOSED_WON`, `TEAM_ID` (Redo ID) |
| `KITCHEN.PANTRY.INGR_MONTHLY_REPORT_V2` | One row per merchant per platform per month; per-product revenue columns |

**Join key:** `STG_DEALS.TEAM_ID` = `INGR_MONTHLY_REPORT_V2."Merchant ID"` (Redo /
Merchant / Team ID).

## Method

- **Cohort month** = `CLOSED_WON` converted to **America/Denver (MST)** then
  truncated to the month.
- **Expected monthly** = deal `DEAL_AMOUNT` ÷ 12 (HubSpot amount is annualized).
- **Cohort scope — every closed-won deal counts.** A cohort's ARR is the sum of
  every NB+XSell closed-won deal that month, matched or not, mapped type or not.
  Unmatched deals (no Redo ID in the report) and unmapped product types are still
  in the cohort — they attain $0, so they lower attainment rather than disappear.
  This makes each cohort's booked ARR tie out to HubSpot closed-won (e.g. Jun '26
  = $12.03M).
- **Attribution — latest deal wins:** for each merchant + deal type, each
  month's attributed revenue credits the most recent deal closed on or before
  that month. Superseded re-signs go inactive from that month on, so re-signed
  merchants never double-count revenue (their ARR still stays in the original
  cohort's bookings).
- **Attainment** = Σ attributed revenue ÷ Σ expected, recomputed live for
  whatever deal types are in view.
- **Bookings scope** — only the **New Business + XSell** pipelines count as
  closed-won bookings (Upsell, Churn, Acquisitions, etc. are excluded), matching
  HubSpot's closed-won figures.
- **Orphaned revenue** row — mapped-column revenue from merchants with *no*
  deal of that type behind it. This is the only bucket that lives outside the
  cohorts; it reconciles the table to Monthly Report totals.

The deal-type → revenue-column mapping is fully editable in the **Configure**
drawer (a type can sum multiple columns), and persists in `fridge.db`. The last
refresh is cached in `fridge.db` too, so the dashboard loads instantly and
re-queries only on **Refresh** or a config change.

## Product adoption

A stacked bar chart of **how many Redo products each merchant is on**, one bar
per calendar month since **Jan 2024**. A merchant is counted as *on* a product
in a month when that product has **positive revenue** in
`INGR_MONTHLY_REPORT_V2` — "products" are the same mapped deal-type revenue
columns configured on the Deal Attainment tab, so the two dashboards stay in
sync. Each merchant's product count is bucketed into **1, 2, 3, 4, 5+**.

Two toggles:

- **Merchants ↔ Revenue** — measure each month by the *number of merchants* in
  each bucket, or by the *revenue* those merchants contributed (each merchant's
  revenue summed across the products they're on).
- **Absolute ↔ 100%** — read raw magnitudes, or normalize every bar to 100% to
  compare the *mix* month over month.

The buckets use a single-hue **ordinal ramp** (dim → bright orange with product
count), validated colorblind-safe on the dark surface. The query
(`qProductAdoption`) counts distinct positive-revenue products per merchant per
month, caps at 5+, and aggregates to a merchant count and revenue sum per month
+ bucket; results are cached alongside the cohort grid in `fridge.db`.

## Files

- **`index.html`** — the deployed app. Self-contained: theme, SQL generators,
  the client-side attainment model, both dashboards (Deal Attainment + Product
  Adoption), and a vanilla-JS UI, importing the Fridge SDK from `/api/sdk` at
  runtime. This is what is served by the Fridge, and the source of truth.
- **`src/`** — the Deal Attainment view as modular React components (reference /
  alternate implementation). It predates the left-hand menu and the Product
  Adoption tab, so it currently lags `index.html`. `npm run build` bundles it
  via esbuild.
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
