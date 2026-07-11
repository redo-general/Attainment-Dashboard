# CLAUDE.md

Guidance for Claude Code working in this repo. See `README.md` for the full
product/data story; this file is the operational quick reference.

## What this is

A single-file, Fridge-hosted dashboard (`index.html`) showing cohort attainment
of Redo's usage-based deals — HubSpot closed-won ARR vs Monthly Report v2
revenue, queried live server-side through the Fridge Snowflake runtime.

- **`index.html`** is the deployed app and the only file the Fridge serves. It's
  self-contained (theme, SQL generators, client-side model, vanilla-JS UI).
- **`src/`** is the same app as modular React components — a reference/alternate
  implementation. Editing it does **not** change the live site unless the result
  is written into `index.html`.

## Deploying to the live Fridge site

**Site slug: `deal-attainment`.** Live at
`https://deal-attainment.fridge.redo.builders`. Static-only deployment.

To publish edits to `index.html`:

1. Call the Redo Unified MCP tool **`fridge_publish_site_files`** with:
   - `slug: "deal-attainment"`
   - `entrypoint: "index.html"`
   - `html`: the **entire** contents of `index.html`
   It commits the bundle to the site's hidden repo and queues a Git-backed
   deploy; a new version goes `active` in a few seconds.
2. Verify with **`fridge_get_site`** (slug `deal-attainment`): the served
   `index.html` `sha256` / `byteSize` should equal your local
   `sha256sum index.html` / `wc -c index.html`.

### Do NOT `git push` to the Fridge remote from a sandbox session

`git.fridge.redo.builders` is on a private Tailscale IP that a Claude Code /
web sandbox cannot reach — the egress proxy returns **502** on CONNECT and a
direct connection hits an SSRF guard (**403**, "Destination IP is in a
private/reserved range"). Don't burn time retrying git; use
`fridge_publish_site_files` (above). Only the MCP server, inside Redo's network,
can write to the Fridge repo.

### Handy Fridge MCP tools (Redo Unified)

- `fridge_get_site` — deployed manifest, active version, per-file sha256.
- `fridge_list_deployments` — version history + statuses.
- `fridge_rollback_site` — revert to a prior deployment if a publish is wrong.
- `fridge_create_git_token` — mints an HTTPS token, but see the sandbox caveat
  above; it only helps from a machine that can actually reach the remote.

## Persistence

Config (deal-type → revenue-column mapping) and the cached cohort grid live in
`fridge.db` and survive redeploys. The grid is chunked because it exceeds
`fridge.db`'s ~64 KB/doc limit — see `saveData`/`loadData` in `index.html`.

## Gotcha: no comments inside SQL template literals

The Fridge Snowflake runtime **rejects SQL containing comments**. The SQL
generators in `index.html` (`qGrid`, `qCellDeals`, `baseCTEs`, etc.) must keep
all `/* … */` and `--` comments *outside* the backtick template literals.
Explanatory comments belong in the surrounding JS, never in the emitted SQL.

## Git branch

Feature work happens on the designated branch (e.g.
`claude/fridge-site-deploy-*`). Publishing to the Fridge is separate from
pushing to GitHub — do both: push code to the branch, and deploy `index.html`
via `fridge_publish_site_files`.
