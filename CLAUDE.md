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

It commits server-side through hidden Git, then a build worker deploys it. The
commit is instant; the worker is what varies.

### Deploy FAST — force the build, verify by sha, do NOT poll status

The slow part is never the build (~2s). It's two traps that cost ~5 min if you
fall for them:

1. **The push-webhook that triggers the build is often slow or missed** (seen it
   sit 50s+ before the worker starts). Do not wait on it.
2. **`fridge_get_site` / `fridge_list_deployments` report stale `pending`** for
   minutes *after* the deploy has already succeeded. Polling them is pure wasted
   time and will make you think it's still deploying when it's live.

Do this instead — the whole thing is ~1 min:

```js
// 1. publish (returns the deployment with its commitSha)
const pub = fridge_publish_site_files({ slug:"deal-attainment", entrypoint:"index.html", html:/* full file */ })
const sha = pub.deployment.metadata.uploadCommit.after   // the commitSha

// 2. immediately FORCE the build — don't wait for the webhook.
//    Its response carries the TRUTHFUL worker.status + deployed sha256.
const r = fridge_redeploy_commit({ slug:"deal-attainment", branch:"main", commitSha: sha, confirmRedeploy:true })
// r.deployment.metadata.worker.status === "succeeded"
// r.deployment.metadata.files[0].sha256  === `sha256sum index.html`  -> byte-perfect & live
```

If `redeploy_commit` returns `worker.status:"succeeded"` and the sha matches your
local `sha256sum index.html`, it's done — stop, do not open `get_site`. If you
still want an independent read, use `fridge_read_deployed_file` (or fetch the live
URL) and compare sha; never trust the `pending`/`active` field on the list/get
endpoints as a completion signal.

`totalBytes` in the publish response should equal `wc -c index.html` — a fast
first sanity check that the inline upload wasn't truncated.

### Notes

- `fridge.db` config + cached data survive every redeploy. Keep the repo
  `index.html` and the deployed file identical: edit here → commit → publish the
  same bytes.
- This is a single-file app, so every publish re-sends the whole ~80 KB inline
  (no incremental diff) — that upload is a fixed cost, not a bug.
- Separate diagnosis from deploy: a plain "publish latest code" is ~1 min; only
  a real bug adds investigation time on top.

Full runbook, rollback tools, and the "why it felt slow" explanation are in
**README.md → "Publishing changes to the live app"**.
