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

## Data-integrity checks

Every refresh (and every cached load) re-runs a set of reconciliation checks over
the loaded data, surfaced as a **Data checks** chip next to *Advanced* (click for
detail). They are living tests against real numbers, not fixtures:

- **Cloud columns sum to Total Revenue** — the report's six `… Cloud Revenue`
  columns must equal `Total Revenue` exactly. This is the identity the All-products
  rollup relies on.
- **All-products total row reconciles to Total Revenue** — attributed revenue never
  exceeds the measured `Total Revenue` in any month, so the Orphaned row balances
  every month and the Total row ties out.
- **Products track their cloud** — for each cloud, the sum of the Configure-mapped
  product columns is compared to that cloud's rollup column. An **over** means the
  product columns overlap (double-count — the reason All products measures via
  `Total Revenue`, not by summing products); an **under** means the cloud earns
  revenue from columns not mapped to any deal type. These render as *review*
  warnings, so taxonomy drift (a new revenue stream, a re-bucketed product) shows
  up immediately. As of this writing Reverse Logistics products overlap ~4.6% and
  Platform is ~39% under (Landed Cost sits in the report's Finance cloud, and
  Platform includes unmapped streams like Catalog / Support AI).

Checks that don't pass are also `console.warn`-ed for devtools.

## Initial-load performance

The initial data load is bounded by Snowflake **query compilation**, not the data
scan. The report pre-aggregates to merchant×month in ~1s; the time goes to the
services-layer compiler on the first (cold) query of a session (~12–17s), after
which every query in that session compiles warm (~5s). Column width is *not* the
driver — a one-column query over the 292-column report compiles as slowly as a
21-column one — so trimming columns doesn't help.

What does help: the grid (thousands of `(cohort, type, rep)` rows, capped at 500
per query by the runtime) is paged, and the pages are now fetched in **parallel
waves** (`fetchPagedParallel`) so their warm compilations overlap instead of
running one-per-page in series. A 5-page grid costs about one wave instead of five.

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
Fridge's hidden Git server-side**, then a build worker publishes it. Config and
cached data live in `fridge.db` and survive every redeploy — you never lose the
deal-type→column mapping or the cached grid.

### Then force the build and verify by sha — do NOT poll `get_site`

The commit is instant; the *build worker* is the variable part, and two traps
turn a ~1-minute deploy into a ~5-minute one:

- **The push-webhook that kicks off the build is often slow or missed** (observed
  it sit 50s+ before the worker even started). Don't wait for it — force it.
- **`fridge_get_site` / `fridge_list_deployments` keep reporting `pending` for
  minutes after the deploy has actually succeeded.** Their status field is a
  lagging cache; polling it is the single biggest time-waster and makes a live
  deploy look stuck.

So, right after publishing:

```js
// publish returns the commit sha:
const sha = pub.deployment.metadata.uploadCommit.after;
// force the worker instead of waiting on the webhook — its response is truthful:
const r = fridge_redeploy_commit({ slug:"deal-attainment", branch:"main",
                                   commitSha: sha, confirmRedeploy:true });
// done when: r.deployment.metadata.worker.status === "succeeded"
//        and r.deployment.metadata.files[0].sha256 === `sha256sum index.html`
```

If that response shows `worker.status:"succeeded"` and the sha matches your local
file, it's live — stop there. For an independent confirmation, use
`fridge_read_deployed_file` (or fetch the live URL) and compare sha; never treat
the `pending`/`active` field on the list/get endpoints as a completion signal.
Also check the publish response's `totalBytes` equals `wc -c index.html` — a
quick guard that the inline upload wasn't truncated.

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

The build itself is fast (~2s). The wasted time is almost always one of these,
in rough order of impact:

1. **Polling the lagging status endpoints.** `get_site`/`list_deployments` show
   `pending` for minutes after success — wait on them and you burn time on a
   deploy that already finished. Fix: force with `fridge_redeploy_commit` and
   trust *its* response + the deployed sha (above).
2. **Waiting on the slow/missed push-webhook** instead of forcing the build.
3. **`git push` to the hidden remote** — this environment's network policy blocks
   `git.fridge.redo.builders`, so a push fails and sends you down an egress
   rabbit hole. Always use `fridge_publish_site_files`.
4. **Fixed cost:** the whole ~80 KB `index.html` is sent inline every publish
   (single-file app, no incremental upload). Unavoidable, not a bug.

A plain "publish the latest code" following the runbook is ~1 minute. Anything
longer is usually a real bug being diagnosed (measure queries against Snowflake
directly — see the deploy history in git for examples), which is separate from
the deploy itself.

## Why not a claude.ai artifact?

The original was a claude.ai artifact, but artifacts can only reach Snowflake by
routing SQL through a Claude API call, where an intermediary model decides
whether to run each query — and it kept (reasonably) refusing. Hosting in the
Fridge replaces that with a real, authenticated, deterministic Snowflake runtime
bound to the signed-in Redo user.
