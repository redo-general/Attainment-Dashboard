# Developing locally (and with Claude Code)

The live app is a single self-contained file, **`index.html`**, served by the
Fridge at https://deal-attainment.fridge.redo.builders. You can develop it
entirely on your own machine — edit, preview in a browser, run tests, then push
to deploy — which is far faster than editing and re-publishing one change at a
time.

> Everything below runs on **your workstation**. Unlike the Claude *web/remote*
> sandbox, your machine can reach the Fridge Git remote, so you deploy with a
> plain `git push` (see [Deploy](#deploy)).

## 1. Prerequisites

- **Node 18+** and **git**.
- Clone the repo and install dev deps (jsdom, for the test runner):
  ```bash
  git clone https://github.com/redo-general/Attainment-Dashboard.git
  cd Attainment-Dashboard
  npm install
  ```

## 2. Claude Code in the CLI

```bash
npm install -g @anthropic-ai/claude-code   # or see https://code.claude.com/docs
claude                                       # run inside the repo
```

Point it at the source of truth and the guardrails:

- **Edit `index.html`** — that's the deployed app. (`src/` is an old React
  variant and is *not* what ships. Ignore it.)
- `CLAUDE.md` has the deploy runbook and gotchas; Claude Code reads it
  automatically.
- Ask it to run the checks after a change: **“run npm test”** (below).

A good loop: describe the change → let Claude edit `index.html` → `npm test` →
eyeball it at `npm run dev` → commit → push.

## 3. Preview in a browser (`npm run dev`)

```bash
npm run dev      # http://localhost:5173
```

`dev/server.mjs` serves `index.html` and maps the app's runtime import
`import("/api/sdk")` to **`dev/mock-sdk.js`**, a fake Fridge SDK. It seeds the
local cache with a tiny fixture so the dashboard boots straight into a rendered
state — **the numbers are synthetic**, but every view, toggle, and modal works,
so it's ideal for UI/layout/logic changes. Edit the fixture in `dev/mock-sdk.js`
if you want different shapes. For **real** numbers, use a
[branch preview](#real-data-branch-previews).

## 4. Headless tests (`npm test`)

```bash
npm test         # tests/smoke.mjs
```

Loads `index.html`'s script into jsdom (no browser, no Snowflake) and renders
every major view + modal, plus the data-integrity checks, against fixture data.
It catches template-literal breakage, render throws, and model mistakes in about
a second. Run it before every commit.

To sanity-check the **SQL** a change generates, paste a generator's output
(e.g. `qMerchantGrid(...)`) into any Snowflake console, or ask Claude Code to run
it via the Snowflake MCP if you have it connected.

## 5. Deploy

`index.html` is the only artifact; config and cached data live in `fridge.db`
and survive every deploy.

### Push to deploy (workstation)

The Fridge site has a hidden Git remote; pushing to it triggers the build worker.
Mint a **write** Git token (Fridge site settings, or ask a Claude session with
the Redo Unified MCP to run `fridge_create_git_token`), then:

```bash
# one-time: add the deploy remote (keep the token out of git history — see below)
git remote add fridge https://git.fridge.redo.builders/deal-attainment.git

# deploy main
git push fridge main
```

Authentication: use the token as the password when prompted, or configure a
credential helper. **Do not** hard-code the token into the remote URL you commit;
store it with `git credential` or an env var. The build takes ~2s after the push
webhook fires; confirm at the live URL.

### Real data (branch previews)

To validate against **real Snowflake data** before touching production, push a
branch to the Fridge remote — Fridge builds it as an isolated preview at a
`<branch>--deal-attainment…` URL (find the exact URL in the Fridge site page).
That preview runs the real, authenticated runtime, so you see true numbers
without changing `main`. Merge/push to `main` when it looks right.

### Keep GitHub in sync

`origin` (GitHub `redo-general/Attainment-Dashboard`) is for branches/PRs/review;
the `fridge` remote is the deploy target. Typical flow: commit → `git push origin
<branch>` (review) → `git push fridge main` (deploy).

### Fallback: publish via MCP

If you can't reach the Fridge Git remote (e.g. from a Claude web/remote session,
whose network policy blocks it), use the `fridge_publish_site_files` MCP tool
with the **`html`** parameter — never the `files`/`contentBase64` path, which
truncates ~8 KB. Verify `totalBytes === wc -c index.html`, then roll back with
`fridge_rollback_site` if a bad upload ever goes live. Full runbook in
`README.md` and `CLAUDE.md`.

## Layout

| Path | What |
| --- | --- |
| `index.html` | The deployed app (edit this). |
| `dev/server.mjs` | Local static server + `/api/sdk` shim. |
| `dev/mock-sdk.js` | Fake Fridge SDK + fixture for offline preview. |
| `tests/smoke.mjs` | Headless jsdom render test (`npm test`). |
| `CLAUDE.md`, `README.md` | Deploy runbook + methodology. |
| `src/`, `build.mjs` | Old React variant — not shipped. |
