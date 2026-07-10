/* ============================================================
   Data layer: Fridge Snowflake calls, persistence, and the
   client-side attainment model (recomputed on every deal-type
   toggle, exactly like the original snapshot).
   ============================================================ */
import {
  START_MONTH, addMonths, monthDiff, dateToKey, CLOUDS, DEFAULT_TYPES,
} from "./theme.js";
import * as Q from "./queries.js";

/* ---- SDK query helper ---------------------------------------------------- */
/* Normalizes a Snowflake row to a lowercase-keyed object whether the SDK
   hands back objects or positional arrays. */
export function toObj(row, cols) {
  if (Array.isArray(row)) {
    const o = {};
    cols.forEach((c, i) => (o[c] = row[i]));
    return o;
  }
  const o = {};
  for (const k in row) o[k.toLowerCase()] = row[k];
  return o;
}
export function num(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}
/* Snowflake ARRAY cells may arrive as JS arrays or JSON strings. */
export function parseArr(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(num);
  if (typeof v === "string") {
    try { return JSON.parse(v).map(num); } catch { return []; }
  }
  return [];
}

export async function runSql(fridge, sql, cols) {
  const res = await fridge.snowflake.query(sql, { limit: 500 });
  const rows = (res && res.rows) || [];
  return rows.map((r) => toObj(r, cols));
}

/* ---- config seed / merge ------------------------------------------------- */
/* config = { types: { slug: {name, cloud, cols[], on} }, order: [slug...] } */
export function seedConfig() {
  const types = {};
  const order = [];
  for (const [slug, v] of Object.entries(DEFAULT_TYPES)) {
    types[slug] = { name: v.name, cloud: v.cloud, cols: [...v.cols], on: true };
    order.push(slug);
  }
  return { types, order };
}

/* Merge freshly discovered deal types + revenue columns into the config,
   adding any new types (off + unmapped) without disturbing existing mappings. */
export function mergeDiscovery(config, discovered) {
  const cfg = { types: { ...config.types }, order: [...config.order] };
  for (const dt of discovered.dealTypes) {
    if (!cfg.types[dt.slug]) {
      const def = DEFAULT_TYPES[dt.slug];
      cfg.types[dt.slug] = def
        ? { name: def.name, cloud: def.cloud, cols: [...def.cols], on: true }
        : { name: prettify(dt.slug), cloud: "other", cols: [], on: false };
      cfg.order.push(dt.slug);
    }
    cfg.types[dt.slug].count = dt.n;
    cfg.types[dt.slug].arr = dt.arr;
  }
  return cfg;
}
export const prettify = (slug) =>
  slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* Deal types that are "in the model": switched on AND have >=1 mapped column. */
export function activeTypes(config) {
  return config.order
    .filter((s) => config.types[s].on && config.types[s].cols.length)
    .map((s) => ({ slug: s, cols: config.types[s].cols }));
}

/* ---- run all refresh queries -------------------------------------------- */
export async function refreshAll(fridge, config, nowKey) {
  const types = activeTypes(config);
  if (!types.length) throw new Error("No deal types are mapped to a revenue column. Open Configure to map at least one.");
  const span = Q.monthSpan(nowKey);

  const [grid, totalMapped, noMatchAgg, noMatchDeals] = await Promise.all([
    runSql(fridge, Q.qGrid(types, span), ["cohort", "type", "exp_arr", "act_arr", "cnt_arr"]),
    runSql(fridge, Q.qTotalMapped(types, span), ["type", "rev_arr", "mon_arr"]),
    runSql(fridge, Q.qNoMatchAgg(types), ["cohort", "type", "n", "arr"]),
    runSql(fridge, Q.qNoMatchDeals(types), ["name", "rep", "redo_id", "type", "arr", "cohort"]),
  ]);

  return {
    grid: grid.map((r) => ({
      cohort: r.cohort, type: r.type,
      exp: parseArr(r.exp_arr), act: parseArr(r.act_arr), cnt: parseArr(r.cnt_arr),
    })),
    totalMapped: totalMapped.map((r) => ({
      type: r.type, rev: parseArr(r.rev_arr),
      months: (parseStrArr(r.mon_arr)),
    })),
    noMatchAgg: noMatchAgg.map((r) => ({ cohort: r.cohort, type: r.type, n: num(r.n), arr: num(r.arr) })),
    noMatchDeals: noMatchDeals.map((r) => ({
      name: r.name, rep: r.rep, redoId: r.redo_id, type: r.type, arr: num(r.arr), cohort: r.cohort,
    })),
    nowKey, refreshedAt: new Date().toISOString(),
  };
}
function parseStrArr(v) {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") { try { return JSON.parse(v).map(String); } catch { return []; } }
  return [];
}

export async function discover(fridge) {
  const [dealTypes, revCols] = await Promise.all([
    runSql(fridge, Q.qDealTypes(), ["slug", "n", "arr", "clouds", "product_cloud"]),
    runSql(fridge, Q.qRevenueColumns(), ["col", "pos"]),
  ]);
  return {
    dealTypes: dealTypes.map((r) => ({ slug: r.slug, n: num(r.n), arr: num(r.arr), productCloud: r.product_cloud })),
    revCols: revCols.map((r) => r.col),
  };
}

/* ---- persistence (fridge.db) -------------------------------------------- */
const STORE = { config: "attainment_config", data: "attainment_data" };
export async function saveConfig(fridge, config) {
  await fridge.db.collection(STORE.config).create({ value: config }, "v1");
}
export async function loadConfig(fridge) {
  try {
    const docs = await fridge.db.collection(STORE.config).list();
    const doc = docs.find((d) => d.key === "v1") || docs[0];
    return doc ? (doc.value?.value || doc.value) : null;
  } catch { return null; }
}
/* The cohort grid dwarfs fridge.db's 64 KB/doc limit, so the cache is chunked:
   a "latest" manifest doc plus grid_N docs of ~25 rows each. */
export async function saveData(fridge, data) {
  const col = fridge.db.collection(STORE.data);
  const CHUNK = 25;
  const chunks = [];
  for (let i = 0; i < data.grid.length; i += CHUNK) chunks.push(data.grid.slice(i, i + CHUNK));
  for (let i = 0; i < chunks.length; i++) await col.create({ value: chunks[i] }, "grid_" + i);
  await col.create({ value: {
    v: 2, chunks: chunks.length, totalMapped: data.totalMapped,
    noMatchAgg: data.noMatchAgg, noMatchDeals: data.noMatchDeals,
    nowKey: data.nowKey, refreshedAt: data.refreshedAt,
  } }, "latest");
}
export async function loadData(fridge) {
  try {
    const docs = await fridge.db.collection(STORE.data).list();
    const map = {};
    for (const d of docs) map[d.key] = (d.value && d.value.value !== undefined) ? d.value.value : d.value;
    const man = map["latest"];
    if (!man) return null;
    if (man.v === 2) {
      const grid = [];
      for (let i = 0; i < man.chunks; i++) { const c = map["grid_" + i]; if (Array.isArray(c)) grid.push(...c); }
      if (grid.length !== 0 || man.chunks === 0)
        return { grid, totalMapped: man.totalMapped, noMatchAgg: man.noMatchAgg, noMatchDeals: man.noMatchDeals, nowKey: man.nowKey, refreshedAt: man.refreshedAt };
      return null;
    }
    return man.grid ? man : null;
  } catch { return null; }
}

/* ---- cloud helpers ------------------------------------------------------- */
export function cloudSlugs(config, cloudId) {
  return config.order.filter((s) => (config.types[s].cloud || "other") === cloudId && config.types[s].on && config.types[s].cols.length);
}
export function mappedCloudIds(config) {
  const ids = new Set();
  for (const s of config.order) {
    const t = config.types[s];
    if (t.on && t.cols.length) ids.add(t.cloud || "other");
  }
  return CLOUDS.filter((c) => ids.has(c.id));
}

/* ---- the model: recomputed from data + selected set ---------------------- */
export function computeModel(data, selected, config) {
  const series = data.grid.filter((s) => selected.has(s.type));
  // month spine START..LAST
  let last = START_MONTH;
  for (const s of data.grid) {
    const end = addMonths(s.cohort, s.exp.length - 1);
    if (end > last) last = end;
  }
  if (data.nowKey && data.nowKey > last) last = data.nowKey;
  const MONTHS = [];
  for (let k = START_MONTH; k <= last; k = addMonths(k, 1)) MONTHS.push(k);
  const MIDX = Object.fromEntries(MONTHS.map((m, i) => [m, i]));
  const detailMonth = addMonths(last, -1);

  const cohorts = [...new Set(series.map((s) => s.cohort))].sort();

  const rows = [];
  let maxSpan = 0;
  for (const c of cohorts) {
    const cs = series.filter((s) => s.cohort === c);
    if (!cs.length) continue;
    const span = monthDiff(c, last) + 1;
    const exp = Array(span).fill(0), act = Array(span).fill(0), dls = Array(span).fill(0);
    let arr = 0, deals0 = 0;
    for (const s of cs) {
      arr += (s.exp[0] || 0) * 12; deals0 += (s.cnt[0] || 0);
      s.exp.forEach((v, i) => { if (i < span) exp[i] += v; });
      s.act.forEach((v, i) => { if (i < span) act[i] += v; });
      s.cnt.forEach((v, i) => { if (i < span) dls[i] += v; });
    }
    if (deals0 === 0 && arr === 0 && act.every((v) => v === 0)) continue;
    maxSpan = Math.max(maxSpan, span);
    rows.push({ c, span, exp, act, dls, arr, deals0 });
  }

  // attributed revenue per type per calendar month, from the grid
  const ATTR = {};
  for (const s of data.grid) {
    if (!ATTR[s.type]) ATTR[s.type] = Array(MONTHS.length).fill(0);
    const base = MIDX[s.cohort];
    if (base == null) continue;
    s.act.forEach((v, i) => { const mi = base + i; if (mi < MONTHS.length) ATTR[s.type][mi] += v; });
  }
  // total mapped revenue per type aligned to MONTHS
  const REVT = {};
  for (const t of data.totalMapped) {
    const arr = Array(MONTHS.length).fill(0);
    t.months.forEach((mk, i) => { const mi = MIDX[mk]; if (mi != null) arr[mi] = t.rev[i] || 0; });
    REVT[t.type] = arr;
  }
  const unatt = MONTHS.map((_, mi) => {
    let u = 0;
    selected.forEach((t) => { u += Math.max(0, (REVT[t]?.[mi] || 0) - (ATTR[t]?.[mi] || 0)); });
    return u;
  });

  // no match
  const nm = data.noMatchAgg.filter((r) => selected.has(r.type));
  const nmTotals = nm.reduce((a, r) => ({ n: a.n + r.n, amt: a.amt + r.arr }), { n: 0, amt: 0 });
  const nmByCohort = {};
  nm.forEach((r) => { nmByCohort[r.cohort] = (nmByCohort[r.cohort] || 0) + r.arr; });

  // overall stats (exclude MTD month = last)
  let se = 0, sa = 0, jE = 0, jA = 0, totArr = 0, totDeals = 0;
  const jIdx = MIDX[detailMonth];
  for (const r of rows) {
    totArr += r.arr; totDeals += r.deals0;
    r.exp.forEach((e, i) => {
      const mi = MIDX[r.c] + i;
      if (mi < MONTHS.length - 1) { se += e; sa += r.act[i]; }
      if (mi === jIdx) { jE += e; jA += r.act[i]; }
    });
  }

  return {
    rows, maxSpan, unatt, nmTotals, nmByCohort, MONTHS, MIDX, last, detailMonth, cohorts,
    overall: se > 0 ? sa / se : null, junPct: jE > 0 ? jA / jE : null, totArr, totDeals,
  };
}
