# Deal Attainment Dashboard

A live cohort-attainment dashboard for Redo's usage-based deals, hosted in the
**Fridge** at **https://deal-attainment.fridge.redo.builders**.

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

## Files

- **`index.html`** — the deployed app. Self-contained: theme, SQL generators,
  the client-side attainment model, and a vanilla-JS UI, importing the Fridge
  SDK from `/api/sdk` at runtime. This is what is served by the Fridge.
- **`src/`** — the same app as modular React components (reference / alternate
  implementation). `npm run build` bundles it via esbuild.
- **`build.mjs`, `package.json`** — esbuild config for the React variant.

## Publishing changes to the live app

The Fridge site is a static-only deployment (slug **`deal-attainment`**, a single
`index.html`). There is one reliable, one-step way to republish — use it every
time:

**Call the `fridge_publish_site_files` MCP tool** (Redo Unified server):

```js
fridge_publish_site_files({
  slug:       "deal-attainment",
  entrypoint: "index.html",
  html:       /* the entire contents of index.html */,
})
```

That's the whole deploy. The tool uploads the file and **commits it through
Fridge's hidden Git server-side**, then a build worker publishes it a few
seconds later. Config and cached data live in `fridge.db` and survive every
redeploy — you never lose the deal-type→column mapping or the cached grid.

Then verify (recommended):

- `fridge_get_site({ slug: "deal-attainment" })` → confirm
  `latestDeployment.version` bumped and
  `latestDeployment.metadata.worker.status === "succeeded"`.
- Compare the deployed `index.html` `sha256` in that response against your local
  file (`sha256sum index.html`) if you want byte-for-byte proof.

### Do NOT `git push` to the Fridge remote from a web/remote session

The site *does* have a hidden Git remote
(`https://git.fridge.redo.builders/deal-attainment.git`), and cloning/pushing to
it works from a normal workstation. **But Claude Code web/remote sessions run
behind a network policy that blocks outbound traffic to that host**, so a push
fails with a DNS/egress error and sends you down a debugging rabbit hole. This
is the single biggest reason republishing has felt slow. In these sessions,
always publish with `fridge_publish_site_files` — it does the commit server-side
and never touches local egress.

### Keep the repo copy in sync

`index.html` in this repo is the source of truth. Edit it here, commit to the
working branch, then publish the *same* file with the tool above so the live app
and the repo never drift.

### Other deployment tools (rarely needed)

- `fridge_read_deployed_file` — read the live artifact back.
- `fridge_list_deployments` / `fridge_diff_revisions` — history and diffs.
- `fridge_redeploy_commit` — redeploy an existing commit without re-uploading.
- `fridge_rollback_site` — roll back to a previous good deployment.

### Why republishing has felt slow

The publish itself is fast — a few seconds. What eats the time is *rediscovery*:
with no runbook, the natural first move is `git push` to the hidden remote, which
this environment silently blocks, so each session re-debugs egress before landing
on the MCP tool. Two smaller factors: the whole ~80 KB `index.html` is sent
inline in the tool call (it's a single-file app, so there's no incremental
upload), and the deploy is asynchronous — the tool queues a build that a worker
finishes a few seconds later, so verifying means a short poll. Following the
runbook above removes the only genuinely slow part.

## Why not a claude.ai artifact?

The original was a claude.ai artifact, but artifacts can only reach Snowflake by
routing SQL through a Claude API call, where an intermediary model decides
whether to run each query — and it kept (reasonably) refusing. Hosting in the
Fridge replaces that with a real, authenticated, deterministic Snowflake runtime
bound to the signed-in Redo user.
