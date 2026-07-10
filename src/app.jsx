import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  SlidersHorizontal, X, AlertTriangle, Grid3X3, CalendarDays,
  RefreshCw, Check, Loader2, Settings2, Database, ExternalLink,
} from "lucide-react";
import {
  T, SANS, SERIF, LOGO_WHITE, CLOUDS, keyToLabel, addMonths, monthDiff,
  fmtMoney, fmtMoneyFull, fmtPct, heat,
} from "./theme.js";
import {
  seedConfig, mergeDiscovery, prettify, activeTypes, cloudSlugs, mappedCloudIds,
  refreshAll, discover, saveConfig, loadConfig, saveData, loadData, computeModel,
  runSql,
} from "./data.js";
import * as Q from "./queries.js";
import { ConfigDrawer, CellModal, NoMatchModal } from "./components.jsx";

const nowMonthKey = () => {
  // Mountain Time month, matching the SQL cohort timezone.
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit" }).format(new Date());
  return parts.slice(0, 7);
};

const btn = (active) => ({
  display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px",
  fontSize: 12, fontWeight: 600, fontFamily: SANS, letterSpacing: "0.01em",
  cursor: "pointer", border: `1px solid ${active ? "#F7F6F4" : T.divider2}`,
  background: active ? "#F7F6F4" : "transparent", color: active ? T.page : T.body,
  borderRadius: 0,
});

const selectedTypeList = (config, selected) =>
  config.order.filter((s) => config.types[s].on && config.types[s].cols.length && selected.has(s))
    .map((s) => ({ slug: s, cols: config.types[s].cols }));

/* ============================================================ */
export default function App() {
  const [fridge, setFridge] = useState(null);
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [discovered, setDiscovered] = useState(null);
  const [data, setData] = useState(null);
  const [phase, setPhase] = useState("init"); // init | needsConnect | busy | ready | error
  const [busyMsg, setBusyMsg] = useState("");
  const [error, setError] = useState(null);

  const [selected, setSelected] = useState(() => new Set());
  const [view, setView] = useState("msc");
  const [metric, setMetric] = useState("pct");
  const [typesOpen, setTypesOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState(null);

  // boot: connect SDK, load cached config + data
  useEffect(() => {
    (async () => {
      try {
        const { createFridge } = await import("/api/sdk");
        const f = createFridge();
        setFridge(f);
        let me = null;
        try { me = await f.identity.me(); } catch {}
        setUser(me);
        const savedCfg = await loadConfig(f);
        const cfg = savedCfg && savedCfg.order ? savedCfg : seedConfig();
        setConfig(cfg);
        const cached = await loadData(f);
        if (cached && cached.grid) {
          setData(cached);
          setSelected(defaultSelection(cfg));
          setPhase("ready");
        } else {
          setPhase("needsConnect");
        }
      } catch (e) {
        setError(String(e?.message || e));
        setPhase("error");
      }
    })();
  }, []);

  const doRefresh = useCallback(async (cfgOverride) => {
    if (!fridge) return;
    const cfg = cfgOverride || config;
    setPhase("busy"); setError(null);
    try {
      setBusyMsg("Discovering deal types & revenue columns…");
      const disc = await discover(fridge);
      setDiscovered(disc);
      const merged = mergeDiscovery(cfg, disc);
      setConfig(merged);
      try { await saveConfig(fridge, merged); } catch (e) { console.warn("config cache failed", e); }

      setBusyMsg("Querying Snowflake — cohort grid, revenue totals, no-match…");
      const fresh = await refreshAll(fridge, merged, nowMonthKey());
      setData(fresh);
      setSelected((prev) => (prev.size ? prev : defaultSelection(merged)));
      setPhase("ready");
      // cache is best-effort: a failed write must never break a completed refresh
      try { await saveData(fridge, fresh); } catch (e) { console.warn("data cache failed", e); }
    } catch (e) {
      setError(String(e?.message || e));
      setPhase(data ? "ready" : "error");
    }
  }, [fridge, config, data]);

  const saveConfigAndRefresh = useCallback(async (newCfg) => {
    setConfig(newCfg);
    if (fridge) { try { await saveConfig(fridge, newCfg); } catch (e) { console.warn("config cache failed", e); } }
    setSelected(defaultSelection(newCfg));
    setDrawer(false);
    await doRefresh(newCfg);
  }, [fridge, doRefresh]);

  const model = useMemo(
    () => (data && config ? computeModel(data, selected, config) : null),
    [data, selected, config]
  );

  const mCLOUDS = useMemo(() => (config ? mappedCloudIds(config) : []), [config]);
  const allSelSlugs = useMemo(
    () => (config ? config.order.filter((s) => config.types[s].on && config.types[s].cols.length) : []),
    [config]
  );

  const activeCloud = useMemo(() => {
    if (!config) return "all";
    if (selected.size === allSelSlugs.length && allSelSlugs.length) return "all";
    for (const cl of mCLOUDS) {
      const codes = cloudSlugs(config, cl.id);
      if (codes.length && codes.length === selected.size && codes.every((c) => selected.has(c))) return cl.id;
    }
    return "custom";
  }, [selected, config, allSelSlugs, mCLOUDS]);

  const columns = useMemo(() => {
    if (!model) return [];
    return view === "cal"
      ? model.MONTHS.map((m) => ({ key: m, label: keyToLabel(m) + (m === model.last ? " · MTD" : "") }))
      : Array.from({ length: model.maxSpan }, (_, i) => ({ key: i, label: `M${i}` }));
  }, [view, model]);

  const scopeLabel = !config ? "" : activeCloud === "all" ? "All products"
    : activeCloud === "custom" ? `${selected.size} of ${allSelSlugs.length} products`
    : (CLOUDS.find((c) => c.id === activeCloud)?.label || "");

  const refreshedLabel = data?.refreshedAt
    ? new Date(data.refreshedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "";

  return (
    <div style={{ minHeight: "100vh", background: T.page, color: T.text, fontFamily: SANS }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { height: 10px; width: 10px; }
        ::-webkit-scrollbar-track { background: ${T.page}; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); }
        .cell:hover, .cell:focus-visible { outline: 1px solid #F7F6F4; outline-offset: -1px; }
        button:focus-visible { outline: 1px solid #F7F6F4; outline-offset: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } .spin { animation: none; } }
      `}</style>

      {/* Header */}
      <header style={{ borderBottom: `1px solid ${T.divider}` }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 48px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src={LOGO_WHITE} alt="Redo" style={{ height: 28, display: "block" }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, border: `1px solid ${T.divider2}`, padding: "3px 8px" }}>Live · Fridge</span>
            <span style={{ marginLeft: "auto" }} />
            {user?.email && <span style={{ fontSize: 11, color: T.muted }}>{user.email}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 24, flexWrap: "wrap", padding: "24px 0" }}>
            <div style={{ marginRight: "auto" }}>
              <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSynthesis: "none", fontSize: 48, lineHeight: "56px", letterSpacing: "-0.02em" }}>
                Deal attainment
              </h1>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Database size={12} />
                Live from Snowflake via Redo Unified{refreshedLabel ? ` · refreshed ${refreshedLabel}` : ""} · cohorts from Jan ’23 (MST) · current month is MTD
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, paddingBottom: 4, flexWrap: "wrap" }}>
              <Toggle value={view} onChange={setView} options={[
                { v: "msc", label: "Months since close", icon: <Grid3X3 size={12} /> },
                { v: "cal", label: "Calendar", icon: <CalendarDays size={12} /> },
              ]} />
              <Toggle value={metric} onChange={setMetric} options={[{ v: "pct", label: "%" }, { v: "usd", label: "$" }]} />
              <button style={btn(false)} onClick={() => setDrawer(true)} disabled={!config}>
                <Settings2 size={13} /> Configure
              </button>
              <button style={{ ...btn(false), border: `1px solid ${T.orange}`, color: T.orange }} onClick={() => doRefresh()} disabled={phase === "busy" || !fridge}>
                <RefreshCw size={13} className={phase === "busy" ? "spin" : ""} /> Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 48px 64px" }}>
        {error && (
          <div style={{ border: `1px solid ${T.red}`, background: "rgba(220,38,38,0.10)", padding: "12px 16px", marginBottom: 20, fontSize: 12, color: "#F5A399", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <AlertTriangle size={15} style={{ flex: "0 0 auto", marginTop: 1 }} />
            <div><strong style={{ color: T.text }}>Query error.</strong> {error}</div>
          </div>
        )}

        {phase === "init" && <Splash msg="Connecting to Fridge runtime…" />}
        {phase === "error" && !data && <Splash msg="Could not load. Check Snowflake access, then Refresh." error />}
        {phase === "needsConnect" && (
          <div style={{ border: `1px solid ${T.divider2}`, background: T.surface, padding: 48, textAlign: "center" }}>
            <div style={{ fontFamily: SERIF, fontSize: 28, color: T.text, marginBottom: 8 }}>Connect & pull live data</div>
            <p style={{ fontSize: 13, color: T.muted, maxWidth: 520, margin: "0 auto 24px", lineHeight: "20px" }}>
              This runs a handful of read-only Snowflake queries through the Fridge runtime — deal types, the cohort attainment grid,
              revenue totals, and unmatched deals. It takes a few seconds and is cached for next time.
            </p>
            <button style={{ ...btn(true), padding: "12px 24px" }} onClick={() => doRefresh()} disabled={!fridge}>
              <RefreshCw size={14} /> Connect & refresh
            </button>
          </div>
        )}
        {phase === "busy" && !data && <Splash msg={busyMsg || "Working…"} spin />}

        {model && (
          <>
            {phase === "busy" && (
              <div style={{ fontSize: 12, color: T.orange, marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
                <Loader2 size={13} className="spin" /> {busyMsg}
              </div>
            )}
            {/* Scope: cloud chips + type filter */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", position: "relative" }}>
              <button style={btn(activeCloud === "all")} onClick={() => setSelected(new Set(allSelSlugs))}>All products</button>
              {mCLOUDS.map((cl) => (
                <button key={cl.id} style={btn(activeCloud === cl.id)} onClick={() => setSelected(new Set(cloudSlugs(config, cl.id)))}>
                  {cl.label}
                </button>
              ))}
              <button style={{ ...btn(typesOpen || activeCloud === "custom"), marginLeft: 8 }} onClick={() => setTypesOpen((o) => !o)}>
                <SlidersHorizontal size={13} /> Deal types{activeCloud === "custom" ? ` · ${selected.size}` : ""}
              </button>
              {typesOpen && (
                <TypePanel config={config} selected={selected} setSelected={setSelected} onClose={() => setTypesOpen(false)} />
              )}
            </div>

            {/* Stat strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", border: `1px solid ${T.divider}`, background: T.surface, marginTop: 24 }}>
              <Stat label={`Overall attainment · ${scopeLabel}`} accent value={fmtPct(model.overall)} sub={`through ${keyToLabel(model.detailMonth)}`} />
              <Stat label="Closed ARR in view" value={fmtMoney(model.totArr)} sub={`${model.cohorts.length ? keyToLabel(model.cohorts[0]) : ""} – ${keyToLabel(model.last)}`} />
              <Stat label="Merchant-deals in view" value={model.totDeals.toLocaleString()} sub="matched to Monthly Report" />
              <Stat label={`${keyToLabel(model.detailMonth)} attainment`} value={fmtPct(model.junPct)} sub="last complete month" />
            </div>

            {/* Table */}
            <div style={{ marginTop: 24 }}>
              <CohortTable
                model={model} columns={columns} view={view} metric={metric}
                onCell={(cohort, month) => setModal({ kind: "cell", cohort, month })}
                onNoMatch={() => setModal({ kind: "nomatch" })}
              />
            </div>

            <div style={{ marginTop: 24, display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-start" }}>
              <Legend />
              <p style={{ fontSize: 12, color: T.muted, maxWidth: 640, margin: 0, lineHeight: "20px" }}>
                Attainment = attributed revenue ÷ (closed ARR ÷ 12), matched on Redo ID. Per merchant and deal type, each
                month’s revenue credits the most recent deal closed on or before that month, so re-signs never double count.
                Click any cell for a live deal-level view. Toggling deal types recomputes every number on this page.
              </p>
            </div>
          </>
        )}
      </main>

      {drawer && config && (
        <ConfigDrawer
          config={config} discovered={discovered} data={data}
          onSave={saveConfigAndRefresh} onClose={() => setDrawer(false)}
        />
      )}
      {modal?.kind === "cell" && model && (
        <CellModal fridge={fridge} config={config} selected={selected}
          cohort={modal.cohort} month={modal.month} model={model} onClose={() => setModal(null)} />
      )}
      {modal?.kind === "nomatch" && model && (
        <NoMatchModal config={config} data={data} selected={selected} model={model} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

function defaultSelection(config) {
  return new Set(config.order.filter((s) => config.types[s].on && config.types[s].cols.length));
}

/* ---------------- small pieces ---------------- */
function Splash({ msg, spin, error }) {
  return (
    <div style={{ border: `1px solid ${T.divider}`, background: T.surface, padding: 64, textAlign: "center", color: error ? "#F5A399" : T.muted, fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      {spin ? <Loader2 size={22} className="spin" /> : error ? <AlertTriangle size={22} /> : <Database size={22} />}
      {msg}
    </div>
  );
}

function Toggle({ value, onChange, options }) {
  return (
    <div style={{ display: "inline-flex", border: `1px solid ${T.divider2}` }}>
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px",
          fontSize: 12, fontWeight: 600, fontFamily: SANS, cursor: "pointer", border: "none",
          background: value === o.v ? "#F7F6F4" : "transparent", color: value === o.v ? T.page : T.body,
        }}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value, sub, accent }) {
  return (
    <div style={{ padding: 24, borderRight: `1px solid ${T.divider}` }}>
      <div style={{ fontFamily: SERIF, fontWeight: 400, fontSynthesis: "none", fontSize: 32, lineHeight: "32px", letterSpacing: "-0.02em", color: accent ? T.orange : T.text }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>{label}</div>
      {sub && <div style={{ marginTop: 4, fontSize: 11, color: T.muted }}>{sub}</div>}
    </div>
  );
}

function TypePanel({ config, selected, setSelected, onClose }) {
  const clouds = mappedCloudIds(config);
  const toggle = (code) => {
    const next = new Set(selected);
    next.has(code) ? next.delete(code) : next.add(code);
    setSelected(next);
  };
  const setCloud = (id, on) => {
    const next = new Set(selected);
    cloudSlugs(config, id).forEach((c) => (on ? next.add(c) : next.delete(c)));
    setSelected(next);
  };
  return (
    <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 40, background: T.surface, border: `1px solid ${T.divider2}`, padding: 24, width: "min(760px, 92vw)" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted, marginRight: "auto" }}>Deal types in view</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", padding: 0 }}><X size={16} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24 }}>
        {clouds.map((cl) => {
          const codes = cloudSlugs(config, cl.id);
          const allOn = codes.every((c) => selected.has(c));
          return (
            <div key={cl.id}>
              <button onClick={() => setCloud(cl.id, !allOn)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 8, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: allOn ? T.text : T.muted, fontFamily: SANS }}>
                {cl.label}
              </button>
              {codes.map((code) => (
                <label key={code} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer", fontSize: 13, color: selected.has(code) ? T.body : T.muted }}>
                  <span style={{ width: 14, height: 14, border: `1px solid ${selected.has(code) ? "#F7F6F4" : T.divider2}`, background: selected.has(code) ? "#F7F6F4" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                    {selected.has(code) && <Check size={11} color={T.page} strokeWidth={3} />}
                  </span>
                  <input type="checkbox" checked={selected.has(code)} onChange={() => toggle(code)} style={{ display: "none" }} />
                  {config.types[code].name}
                </label>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend() {
  const stops = [["< 50%", heat(0.3)], ["50–75%", heat(0.6)], ["75–90%", heat(0.8)], ["90–110%", heat(1.0)], ["110–150%", heat(1.3)], ["> 150%", heat(2)]];
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
      {stops.map(([label, h]) => (
        <span key={label} style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", padding: "4px 8px", background: h.bg, color: h.fg }}>{label}</span>
      ))}
    </div>
  );
}

function CohortTable({ model, columns, view, metric, onCell, onNoMatch }) {
  const th = { position: "sticky", top: 0, zIndex: 2, background: T.surface, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted, padding: "8px 8px", borderBottom: `2px solid ${T.divider2}`, textAlign: "right", whiteSpace: "nowrap" };
  const num = { fontSize: 11, fontVariantNumeric: "tabular-nums", textAlign: "right", padding: "8px", borderBottom: `1px solid ${T.divider}`, whiteSpace: "nowrap", color: T.body };
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.divider}`, overflow: "auto", maxHeight: "70vh" }}>
      <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: 280 + columns.length * 72 }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left", left: 0, zIndex: 3, minWidth: 140, paddingLeft: 16 }}>Cohort</th>
            <th style={{ ...th, minWidth: 88 }}>Closed ARR</th>
            <th style={{ ...th, minWidth: 56 }}>Deals</th>
            {columns.map((c) => <th key={c.key} style={{ ...th, minWidth: 64 }}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {model.rows.map((r, ri) => {
            const rowBg = ri % 2 ? T.surfaceAlt : T.surface;
            return (
              <tr key={r.c} style={{ background: rowBg }}>
                <td style={{ position: "sticky", left: 0, zIndex: 1, background: rowBg, padding: "8px 16px", borderBottom: `1px solid ${T.divider}`, fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", color: T.text }}>{keyToLabel(r.c)}</td>
                <td style={num}>{fmtMoney(r.arr)}</td>
                <td style={num}>{r.deals0 || "—"}</td>
                {columns.map((col) => {
                  const i = view === "cal" ? monthDiff(r.c, col.key) : col.key;
                  if (i < 0 || i >= r.span) return <td key={col.key} style={{ ...num, color: "rgba(255,255,255,0.14)" }}>·</td>;
                  const e = r.exp[i] ?? 0, a = r.act[i] ?? 0, d = r.dls[i] ?? 0;
                  if (e <= 0 && a === 0) return <td key={col.key} style={{ ...num, color: "rgba(255,255,255,0.14)" }}>·</td>;
                  const pct = e > 0 ? a / e : (a > 0 ? Infinity : null);
                  const h = heat(pct);
                  const m = view === "cal" ? col.key : addMonths(r.c, i);
                  return (
                    <td key={col.key} style={{ padding: 2, borderBottom: `1px solid ${T.divider}` }}>
                      <button className="cell" onClick={() => onCell(r.c, m)}
                        title={`${keyToLabel(r.c)} cohort · ${keyToLabel(m)}\nExpected ${fmtMoneyFull(e)} · Actual ${fmtMoneyFull(a)} · ${d} active`}
                        style={{ width: "100%", border: "none", cursor: "pointer", background: h.bg, color: h.fg, fontFamily: SANS, fontVariantNumeric: "tabular-nums", fontSize: 11, fontWeight: 600, padding: "6px 6px", textAlign: "right" }}>
                        {metric === "pct" ? (pct === Infinity ? "∞" : fmtPct(pct)) : fmtMoney(a)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}

          {/* No match */}
          <tr>
            <td style={{ position: "sticky", left: 0, zIndex: 1, background: T.surface, padding: "8px 16px", borderTop: `2px solid ${T.divider2}`, borderBottom: `1px solid ${T.divider}`, whiteSpace: "nowrap" }}>
              <button onClick={onNoMatch} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: SANS, fontWeight: 600, fontSize: 13, color: T.muted, display: "inline-flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={13} /> No match · {model.nmTotals.n} deals
              </button>
            </td>
            <td style={{ ...num, borderTop: `2px solid ${T.divider2}`, color: T.muted }}>{fmtMoney(model.nmTotals.amt)}</td>
            <td style={{ ...num, borderTop: `2px solid ${T.divider2}`, color: T.muted }}>{model.nmTotals.n || "—"}</td>
            {columns.map((c) => {
              const style = { ...num, borderTop: `2px solid ${T.divider2}`, color: T.muted };
              if (view === "msc") return <td key={c.key} style={style}>·</td>;
              let e = 0;
              Object.entries(model.nmByCohort).forEach(([co, amt]) => { if (co <= c.key) e += amt / 12; });
              return <td key={c.key} style={style} title="Expected revenue from deals whose Redo ID has no Monthly Report match">{e >= 1 ? fmtMoney(e) : "·"}</td>;
            })}
          </tr>

          {/* Unattributed */}
          <tr>
            <td style={{ position: "sticky", left: 0, zIndex: 1, background: T.surface, padding: "8px 16px", borderBottom: `1px solid ${T.divider}`, fontWeight: 600, fontSize: 13, color: T.blue, whiteSpace: "nowrap" }}
              title="Mapped-column revenue from merchants with no included deal of that type — ties the table to Monthly Report totals">Unattributed revenue</td>
            <td style={num}>—</td>
            <td style={num}>—</td>
            {columns.map((c) => {
              if (view === "msc") return <td key={c.key} style={{ ...num, color: "rgba(255,255,255,0.14)" }}>·</td>;
              const v = model.unatt[model.MIDX[c.key]] || 0;
              return <td key={c.key} style={{ ...num, color: T.blue }}>{v >= 1 ? fmtMoney(v) : "·"}</td>;
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export { btn };
