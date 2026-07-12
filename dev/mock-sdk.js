/* ============================================================
   LOCAL DEV MOCK of the Fridge SDK (/api/sdk).
   Served by dev/server.mjs at the /api/sdk path so index.html's
   `import("/api/sdk")` resolves offline. It fakes the three surfaces the app
   uses — snowflake.query, db, identity — with a small synthetic fixture so the
   dashboard renders WITHOUT Snowflake or auth. Numbers are fake; use a Fridge
   branch preview (see DEVELOPING.md) when you need real data.
   ============================================================ */

// --- synthetic fixture (mapped shapes, exactly what the app caches) ----------
const MONTHS3 = ["2026-05", "2026-06", "2026-07"];
const grid = [
  { cohort:"2026-05", type:"returns", rep:"Alice", exp:[1000,1000,1000], act:[820,910,690], cnt:[2,2,2] },
  { cohort:"2026-06", type:"returns", rep:"Bob",   exp:[520,520],        act:[430,470],     cnt:[1,1]   },
  { cohort:"2026-05", type:"oms",     rep:"Alice", exp:[300,300,300],    act:[250,260,240], cnt:[1,1,1] },
];
const mgrid = [
  { cohort:"2026-05", type:"__all__", rep:"Alice", exp:[1300,1300,1300], act:[1090,1180,940], cnt:[3,3,3] },
  { cohort:"2026-06", type:"__all__", rep:"Bob",   exp:[520,520],        act:[430,470],       cnt:[1,1]   },
];
const totalMapped = [
  { type:"returns", rev:[5000,5200,5100], months:MONTHS3 },
  { type:"oms",     rev:[900,950,920],    months:MONTHS3 },
];
const mrev = [ { type:"__all__", rev:[8000,8500,8200], months:MONTHS3 } ];
const mpreclose = [ { cohort:"2026-05", rep:"Alice", rev:[200,150], months:["2026-03","2026-04"] } ];
const recon = { total:8000, c_relo:6000, c_ship:900, c_conv:500, c_mktg:400, c_finance:0, c_plat:200,
                p_relo:6100, p_ship:900, p_conv:500, p_mktg:400, p_plat:180 };
const SNAPSHOT = { v:7, chunks:1, mchunks:1, rows:grid.length, mrows:mgrid.length,
  totalMapped, mrev, recon, mpreclose, nowKey:"2026-07", refreshedAt:new Date().toISOString() };

// Raw SQL-result shapes (what snowflake.query returns; the app maps them).
const rawGrid  = grid.map(r =>  ({cohort:r.cohort, type:r.type, rep:r.rep, exp_arr:r.exp, act_arr:r.act, cnt_arr:r.cnt}));
const rawMgrid = mgrid.map(r => ({cohort:r.cohort, type:r.type, rep:r.rep, exp_arr:r.exp, act_arr:r.act, cnt_arr:r.cnt}));
const rawTM    = totalMapped.map(r => ({type:r.type, rev_arr:r.rev, mon_arr:r.months}));
const rawMrev  = mrev.map(r => ({type:r.type, rev_arr:r.rev, mon_arr:r.months}));
const rawPre   = mpreclose.map(r => ({cohort:r.cohort, type:"__all__", rep:r.rep, rev_arr:r.rev, mon_arr:r.months}));

// --- fake snowflake.query: best-effort routing by SQL markers ----------------
function routeSql(sql){
  const has = s => sql.includes(s);
  const page1 = !/BETWEEN\s+(\d+)/.test(sql) || /BETWEEN 1 AND/.test(sql); // paged queries: only page 1 has rows
  if(has(") AS total,") && has("c_relo")) return [recon];
  if(has("preclose AS")) return rawPre;
  if(has("column_name AS col")) return [{col:"Returns Revenue"},{col:"OMS Revenue"},{col:"Support AI Revenue"}];
  if(has("AS slug") && has("PRODUCT_CLOUD"))
    return [{slug:"returns",n:120,arr:6000000,product_cloud:"Reverse Logistics"},{slug:"oms",n:40,arr:1200000,product_cloud:"Shipping"}];
  if(has("exp_arr") && has("'__all__' AS type")) return page1 ? rawMgrid : [];
  if(has("exp_arr")) return page1 ? rawGrid : [];
  if(has("'__all__' AS type") && has("rev_arr") && !has("exp_arr")) return rawMrev;
  if(has("rev_arr") && has("mon_arr")) return rawTM;
  if(has("AS merchant")) return [{merchant:"Cuts", type:"returns", rep:"Alice", arr:120000, actual:9200, active:1, matched:1}];
  return [];
}

// --- fake fridge.db: in-memory collections, seeded with the snapshot ---------
function makeDb(){
  const store = { attainment_data:{}, attainment_config:{} };
  // seed the data cache so the app boots straight into a rendered dashboard
  store.attainment_data["latest"] = { value: SNAPSHOT };
  store.attainment_data["grid_0"] = { value: grid };
  store.attainment_data["mgrid_0"] = { value: mgrid };
  const collection = name => {
    store[name] = store[name] || {};
    return {
      async list(){ return Object.entries(store[name]).map(([key,value]) => ({key, value})); },
      async create(obj, key){ store[name][key] = obj; return {key}; },
    };
  };
  return { collection };
}

export function createFridge(){
  return {
    snowflake: { async query(sql /*, opts */){ return { rows: routeSql(String(sql)) }; } },
    db: makeDb(),
    identity: { async me(){ return { email:"you@local.dev", name:"Local Dev" }; } },
  };
}
