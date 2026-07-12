/* Local dev server for the single-file dashboard. No dependencies.
   - GET /            -> index.html (the deployed app, unmodified)
   - GET /api/sdk     -> dev/mock-sdk.js (fakes the Fridge runtime)
   - everything else  -> static files from the repo root
   Run: npm run dev   (then open http://localhost:5173)
*/
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extname, join, normalize } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = process.env.PORT || 5173;
const MIME = { ".html":"text/html", ".js":"text/javascript", ".mjs":"text/javascript",
  ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".webp":"image/webp",
  ".png":"image/png", ".ico":"image/x-icon" };

async function send(res, path, type){
  try { const body = await readFile(path);
    res.writeHead(200, { "Content-Type": type || MIME[extname(path)] || "application/octet-stream",
      "Cache-Control":"no-store" });
    res.end(body);
  } catch { res.writeHead(404); res.end("Not found: " + path); }
}

createServer(async (req, res) => {
  let url = decodeURIComponent((req.url || "/").split("?")[0]);
  if (url === "/" || url === "/index.html") return send(res, join(ROOT, "index.html"), "text/html");
  // The app imports the Fridge SDK from /api/sdk at runtime — serve the local mock.
  if (url === "/api/sdk") return send(res, join(ROOT, "dev", "mock-sdk.js"), "text/javascript");
  const safe = normalize(url).replace(/^(\.\.[/\\])+/, "");
  return send(res, join(ROOT, safe));
}).listen(PORT, () => {
  console.log(`\n  Deal Attainment — local dev\n  ▸ http://localhost:${PORT}\n  (Fridge SDK is mocked with fixture data — see dev/mock-sdk.js)\n`);
});
