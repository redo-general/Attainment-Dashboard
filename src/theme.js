/* ============================================================
   REDO · DEAL ATTAINMENT — theme, brand, helpers
   Shared constants extracted from the original snapshot so the
   live app is visually identical to the artifact.
   ============================================================ */

export const T = {
  page: "#0D0D0D", surface: "#1A1A18", surfaceAlt: "#161614",
  text: "#FFFFFF", muted: "#9B9A96", body: "#C8C7C2",
  divider: "rgba(255,255,255,0.08)", divider2: "rgba(255,255,255,0.16)",
  orange: "#FF4405", blue: "#088AB2",
  green: "#16A34A", red: "#DC2626",
};
export const SERIF = "'Instrument Serif', Georgia, serif";
export const SANS = "'Inter', 'Segoe UI', sans-serif";

export const LOGO_WHITE = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjI1NSIgdmlld0JveD0iMCAwIDgwMCAyNTUiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNODAwIDBIMFYyNTVIODAwVjBaTTc0NS41NyAxMjYuMTQ5Qzc0NS41NyAxMzguMjM0IDc0My4wODggMTY1LjQ3MiA3MTUuNzkgMTg0LjA3OEM3MDguNzI3IDE4OC44NzQgNzAxLjg1NSAxOTIuMTM1IDY5My44MzcgMTk0LjQzN0M2ODYuMDExIDE5Ni43MzkgNjc0LjE3NSAxOTkuMDQgNjU1LjA4NSAxOTkuMDRDNjI2LjQ1MSAxOTkuMDQgNjA5LjA3OSAxOTIuNzEgNTk4LjE5OCAxODYuMTg4QzU5NC41NzEgMTg0LjA3OCA1ODcuODkgMTc5LjY2NyA1ODEuMjA5IDE3MS42MUM1NjYuODkxIDE1NC4xNTUgNTY2LjMxOSAxMzYuNTA3IDU2Ni4zMTkgMTI3Ljg3NkM1NjYuMzE5IDkzLjczMTggNTg0LjQ1NCA3Ni42NTk5IDU5NS41MjYgNjkuMTc5QzYwNi45NzkgNjEuMzE0NCA2MjMuMzk3IDU0LjQwODkgNjUzLjU1OCA1NC4wMjUzQzY1OS42NjcgNTQuMDI1MyA2NjUuNTg1IDU0LjAyNTMgNjcxLjY5MyA1NC42MDA4QzcwNy4zOTEgNTcuNDc4IDcyMy45OTkgNzEuNjcyNiA3MzMuMzUzIDg1LjA5OTlDNzM3Ljc0MyA5MS42MjE4IDc0NS41NyAxMDUuNjI1IDc0NS41NyAxMjYuMTQ5Wk02OTUuOTM3IDEyNi41MzNDNjk1LjkzNyAxMDkuMjY5IDY4OC42ODMgOTguMzM1NCA2ODMuNzIgOTMuOTIzNkM2ODEuODExIDkyLjAwNTQgNjc3LjIyOSA4OC41NTI3IDY3MC43MzkgODYuMjUwOUM2NjcuMzAzIDg1LjA5OTkgNjYzLjY3NiA4NC4xNDA5IDY1Ni40MjIgODQuMTQwOUM2NTAuMTIyIDg0LjE0MDkgNjQ0Ljk2OCA4NC43MTYzIDYzOS4wNSA4Ny4yMUM2MjMuMjA2IDkzLjkyMzYgNjE1Ljk1MiAxMTAuMjI4IDYxNS45NTIgMTI2LjcyNUM2MTUuOTUyIDEyOS4yMTggNjE2LjE0MyAxMzYuMTI0IDYxOC42MjQgMTQzLjIyMUM2MjYuNjQyIDE2Ny4zOSA2NDguNDA0IDE2OS4xMTcgNjU2LjYxMiAxNjkuMTE3QzY1OC45MDMgMTY5LjExNyA2NjcuNDk0IDE2OS4xMTcgNjc0Ljc0OCAxNjUuODU2QzY4OS44MjggMTU5LjE0MiA2OTUuOTM3IDE0MS44NzggNjk1LjkzNyAxMjYuNTMzWk01NTMuMTA2IDEyOC4yNTlDNTUzLjEwNiAxMzQuMzk3IDU1Mi41MzMgMTU2LjQ1NyA1MzguNzg5IDE3Mi41NjlDNTM2LjQ5OCAxNzUuNDQ3IDUzMS43MjUgMTgwLjI0MiA1MjMuNzA4IDE4NC44NDZDNTIwLjg0NCAxODYuMzggNTE0LjczNiAxODkuNjQxIDUwNi41MjcgMTkxLjc1MUM0OTkuNjU1IDE5My40NzggNDk0LjY5MSAxOTQuNDM3IDQ4MS4xMzggMTk0LjQzN0gzOTUuNjE2VjU5LjAxMjdINDcyLjE2NkM0NzcuNTExIDU5LjAxMjcgNDgyLjg1NiA1OS4yMDQ1IDQ4OC4yMDEgNTkuNTg4MUM1MTkuNTA4IDYyLjI3MzYgNTMzLjI1MyA3NS41MDkxIDU0MS4yNyA4Ny4yMUM1NTIuNzI0IDEwMy43MDYgNTUzLjEwNiAxMjAuOTcgNTUzLjEwNiAxMjguMjU5Wk01MDUuOTU0IDEyNy4xMDhDNTA1Ljk1NCAxMjIuODg4IDUwNS4zODIgMTA3LjczNSA0OTMuNTQ2IDk4LjUyNzNDNDgzLjgzNiA5MS4xNjM2IDQ3MC4yNTggOTEuMjIwNCA0NjYuMzExIDkxLjIzNjlDNDY2LjE0NiA5MS4yMzc2IDQ2NS45OTcgOTEuMjM4MiA0NjUuODY2IDkxLjIzODJINDQyLjc2OFYxNjMuNzQ2SDQ2Ny4zOTNDNDcwLjA2NiAxNjMuNzQ2IDQ3Mi45MjkgMTYzLjU1NCA0NzUuNzkzIDE2My4xN0M0OTIuNDAxIDE2MS4wNiA0OTguMzE5IDE1My41NzkgNTAxLjU2NCAxNDYuNjc0QzUwNS43NjMgMTM4LjA0MiA1MDUuOTU0IDEzMC43NTMgNTA1Ljk1NCAxMjcuMTA4Wk0yMjguNjg1IDE5NC40MzdIMzcyLjYyMVYxNjMuNzQ2SDI3Ni45ODJWMTQyLjA3SDM2My44MzlWMTExLjU3MUgyNzYuOTgyVjg5LjMySDM3MC45MDNWNTkuMDEyN0gyMjguNjg1VjE5NC40MzdaTTIwOS4xMDcgMTk0LjQzN0gxNTUuODQ3TDEyNy45NzYgMTQ1LjEzOUgxMDIuMzk2VjE5NC40MzdINTMuOTA4MlY1OS4wMTI3SDE1My4xNzRDMTcxLjMwOSA1OS4wMTI3IDE4OC42ODEgNjAuMzU1NCAxOTkuNTYyIDc3LjYxOTFDMjAyLjA0NCA4MS42NDczIDIwNi40MzQgODkuNzAzNyAyMDYuNDM0IDEwMS45OEMyMDYuNDM0IDEwOC4zMSAyMDUuMDk4IDEyNi4zNDEgMTg4LjEwOCAxMzUuNzRDMTg0Ljg2MyAxMzcuNjU4IDE4Mi4zODEgMTM4LjYxNyAxNzUuNTA5IDE0MC4zNDRMMjA5LjEwNyAxOTQuNDM3Wk0xNTguMzI4IDEwMi4xNzJDMTU4LjMyOCAxMDEuMDIxIDE1OC4xMzcgOTcuOTUxOSAxNTYuMjI4IDk1LjI2NjRDMTUyLjk4MyA5MC40NzA5IDE0Ny42MzggODkuNzAzNyAxNDIuNDg0IDg5LjcwMzdIMTAyLjM5NlYxMTQuNjRIMTM4LjY2NkMxNDcuODI5IDExNC42NCAxNTIuNjAxIDExMy40ODkgMTU1LjY1NiAxMDkuODQ1QzE1OC4xMzcgMTA2Ljc3NiAxNTguMzI4IDEwMy43MDYgMTU4LjMyOCAxMDIuMTcyWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==";

/* Product clouds — group deal types in the UI. Keyed by slug; unknown
   types fall into "other". */
export const CLOUDS = [
  { id: "relo", label: "Reverse Logistics" },
  { id: "ship", label: "Shipping" },
  { id: "mktg", label: "Marketing" },
  { id: "conv", label: "Conversion" },
  { id: "plat", label: "Platform & other" },
  { id: "other", label: "Other" },
];

/* Default catalog: deal-type slug (HubSpot PRODUCT) -> display name, cloud,
   and default mapped revenue column(s) in Monthly Report v2. Validated 1:1
   against the snapshot. Fully editable at runtime via the Configure drawer. */
export const DEFAULT_TYPES = {
  returns:                  { name: "Returns",               cloud: "relo", cols: ["Returns Revenue"] },
  final_sale_returns:       { name: "Final Sale Returns",     cloud: "relo", cols: ["Final Sale Returns Revenue"] },
  package_protection_plus:  { name: "Package Protection+",    cloud: "relo", cols: ["Package Protection+ Revenue"] },
  extended_warranties:      { name: "Extended Warranties",    cloud: "relo", cols: ["Extended Warranties Revenue"] },
  international_returns:     { name: "International Returns",  cloud: "relo", cols: ["International Returns Revenue"] },
  redo_managed_returns:     { name: "Managed Returns",        cloud: "relo", cols: ["Managed Returns Revenue"] },
  oms:                      { name: "OMS",                    cloud: "ship", cols: ["OMS Revenue"] },
  wms:                      { name: "WMS",                    cloud: "ship", cols: ["WMS Revenue"] },
  ims:                      { name: "IMS",                    cloud: "ship", cols: ["IMS Revenue"] },
  redo_supply:              { name: "Redo Supply",            cloud: "ship", cols: ["Redo Supply Revenue"] },
  email:                    { name: "Email",                  cloud: "mktg", cols: ["Email Revenue"] },
  sms:                      { name: "SMS",                    cloud: "mktg", cols: ["SMS Revenue"] },
  recover:                  { name: "Recover",                cloud: "mktg", cols: ["Recover Revenue"] },
  order_tracking:           { name: "Order Tracking",         cloud: "mktg", cols: ["Order Tracking Revenue"] },
  checkout_optimization:    { name: "Checkout Optimization",  cloud: "conv", cols: ["Checkout Optimization Revenue"] },
  shopperai:                { name: "Shopper AI",             cloud: "conv", cols: ["Shopper AI Revenue"] },
  helpdesk:                 { name: "Helpdesk",               cloud: "plat", cols: ["Helpdesk Revenue"] },
  aeo:                      { name: "AEO",                    cloud: "plat", cols: ["AEO Revenue"] },
  reclaim:                  { name: "Reclaim",                cloud: "plat", cols: ["Reclaim Revenue"] },
  landed_cost:              { name: "Landed Cost",            cloud: "plat", cols: ["Landed Cost Revenue"] },
  post_purchase_upsell:     { name: "Post-Purchase Upsell",   cloud: "plat", cols: ["Post-Purchase Upsell Revenue"] },
};

export const START_MONTH = "2023-01";

/* ---------------- month helpers ---------------- */
export const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const keyToLabel = (k) => `${MONTH_NAMES[+k.split("-")[1] - 1]} ’${k.slice(2, 4)}`;
export const addMonths = (k, n) => {
  let [y, m] = k.split("-").map(Number);
  m += n; y += Math.floor((m - 1) / 12); m = ((m - 1) % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
};
export const monthDiff = (a, b) => {
  const [ay, am] = a.split("-").map(Number), [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
};
/* ISO date (yyyy-mm-01) -> yyyy-mm month key */
export const dateToKey = (d) => String(d).slice(0, 7);

/* ---------------- number formatting ---------------- */
export const fmtMoney = (v) => {
  if (v == null || isNaN(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(0)}k`;
  return `$${Math.round(v)}`;
};
export const fmtMoneyFull = (v) =>
  v == null || isNaN(v) ? "—" : v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const fmtPct = (v) => (v == null || !isFinite(v) ? "—" : `${Math.round(v * 100)}%`);

export const heat = (pct) => {
  if (pct == null) return { bg: "transparent", fg: T.muted };
  if (!isFinite(pct)) return { bg: T.green, fg: T.page };
  if (pct < 0.5) return { bg: "rgba(220,38,38,0.30)", fg: "#F5A399" };
  if (pct < 0.75) return { bg: "rgba(220,38,38,0.15)", fg: "#DBA79F" };
  if (pct < 0.9) return { bg: "rgba(155,154,150,0.14)", fg: "#C8C7C2" };
  if (pct <= 1.1) return { bg: "rgba(22,163,74,0.18)", fg: "#7FCFA2" };
  if (pct <= 1.5) return { bg: "rgba(22,163,74,0.34)", fg: "#9BE7B7" };
  return { bg: T.green, fg: T.page };
};
