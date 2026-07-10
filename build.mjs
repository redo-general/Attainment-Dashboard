import { build } from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });

await build({
  entryPoints: ["src/index.jsx"],
  bundle: true,
  format: "esm",
  target: ["es2020"],
  jsx: "automatic",
  minify: true,
  sourcemap: false,
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
  // The Fridge browser SDK is served at runtime from the site origin.
  external: ["/api/sdk"],
  outfile: "dist/app.js",
});

copyFileSync("public/index.html", "dist/index.html");
console.log("built dist/app.js + dist/index.html");
