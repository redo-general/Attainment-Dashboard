# Deal Attainment Dashboard — notes for Claude

**Live app:** https://deal-attainment.fridge.redo.builders
Fridge site, slug **`deal-attainment`**, static single-file deployment.

**Source of truth:** `index.html` in this repo — a self-contained vanilla-JS app
that imports the Fridge SDK from `/api/sdk` at runtime. `src/` is a reference
React variant and is **not** what gets served. Edit `index.html`.

## Publishing changes to the live app — READ BEFORE DEPLOYING

Publish with **one MCP call** (Redo Unified server). Do **not** `git push` to the
Fridge Git remote from a web/remote session — this environment's network policy
blocks `git.fridge.redo.builders`, and every session that tries it wastes a lot
of time re-debugging egress before falling back to this tool:

```js
fridge_publish_site_files({
  slug:       "deal-attainment",
  entrypoint: "index.html",
  html:       /* full contents of index.html */,
})
```

It commits server-side through hidden Git; a build worker deploys it a few
seconds later. Then verify:

```js
fridge_get_site({ slug: "deal-attainment" })
// check latestDeployment.version bumped
// and latestDeployment.metadata.worker.status === "succeeded"
// (optional) compare files[].sha256 for index.html vs `sha256sum index.html`
```

`fridge.db` config + cached data survive every redeploy. Always keep the repo
`index.html` and the deployed file identical: edit here → commit → publish the
same bytes.

Full runbook, verification, rollback tools, and the "why it felt slow"
explanation are in **README.md → "Publishing changes to the live app"**.
