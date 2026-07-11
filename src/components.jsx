import React, { useState, useMemo, useEffect } from "react";
import { X, AlertTriangle, Loader2, Check, Wand2 } from "lucide-react";
import { T, SANS, SERIF, CLOUDS, keyToLabel, monthDiff, fmtMoney, fmtMoneyFull, fmtPct, heat } from "./theme.js";
import { runSql } from "./data.js";
import * as Q from "./queries.js";

const selList = (config, selected) =>
  config.order.filter((s) => config.types[s].on && config.types[s].cols.length && selected.has(s))
    .map((s) => ({ slug: s, cols: config.types[s].cols }));

/* ---------------- shared bits ---------------- */
const Section = ({ label, children }) => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted, marginBottom: 8 }}>{label}</div>
    <div>{children}</div>
  </div>
);
const Mono = ({ children }) => (
  <span style={{ fontSize: 11, background: "rgba(255,255,255,0.06)", padding: "1px 5px", color: T.text }}>{children}</span>
);

function ModalShell({ eyebrow, title, subtitle, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(13,13,13,0.72)" }} />
      <div style={{ position: "relative", background: T.surface, border: `1px solid ${T.divider2}`, width: "min(960px, 100%)", maxHeight: "85vh", display: "flex", flexDirection: "column", color: T.body }}>
        <div style={{ padding: "24px", borderBottom: `1px solid ${T.divider}`, display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ marginRight: "auto" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>{eyebrow}</div>
            <div style={{ fontFamily: SERIF, fontWeight: 400, fontSynthesis: "none", fontSize: 28, lineHeight: "32px", color: T.text, marginTop: 4 }}>{title}</div>
            {subtitle}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted }}><X size={18} /></button>
        </div>
        <div style={{ overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

const mtd = { padding: "8px 16px", borderBottom: `1px solid ${T.divider}`, fontSize: 12 };
const mtdNum = { ...mtd, fontVariantNumeric: "tabular-nums", textAlign: "right", whiteSpace: "nowrap" };
const thModal = (right) => ({
  fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted,
  textAlign: right ? "right" : "left", padding: "8px 16px", borderBottom: `2px solid ${T.divider2}`,
  position: "sticky", top: 0, background: T.surface, zIndex: 1,
});

/* ---------------- Cell modal (live deal-level query) ---------------- */
export function CellModal({ fridge, config, selected, cohort, month, model, onClose }) {
  const [state, setState] = useState({ loading: true, rows: [], error: null });
  const types = useMemo(() => selList(config, selected), [config, selected]);

  const row = model.rows.find((r) => r.c === cohort);
  const i = row ? monthDiff(cohort, month) : -1;
  const e = row && i >= 0 && i < row.span ? row.exp[i] : 0;
  const a = row && i >= 0 && i < row.span ? row.act[i] : 0;
  const d = row && i >= 0 && i < row.span ? row.dls[i] : 0;
  const pct = e > 0 ? a / e : null;

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!types.length) { setState({ loading: false, rows: [], error: null }); return; }
      try {
        const rows = await runSql(fridge, Q.qCellDeals(types, cohort, month),
          ["name", "rep", "merchant", "type", "arr", "actual", "active"]);
        if (alive) setState({ loading: false, rows, error: null });
      } catch (err) {
        if (alive) setState({ loading: false, rows: [], error: String(err?.message || err) });
      }
    })();
    return () => { alive = false; };
  }, [fridge, cohort, month, types]);

  return (
    <ModalShell
      eyebrow="Deal-level detail · live"
      title={`${keyToLabel(cohort)} cohort · ${keyToLabel(month)}`}
      onClose={onClose}
      subtitle={
        <div style={{ fontSize: 12, color: T.muted, marginTop: 8, fontVariantNumeric: "tabular-nums" }}>
          Cell: expected {fmtMoneyFull(e)} · actual {fmtMoneyFull(a)} ·{" "}
          <span style={{ color: T.text, fontWeight: 600 }}>{fmtPct(pct)} attained</span> · {d} active in view
        </div>
      }
    >
      <div style={{ padding: "16px 24px 0", fontSize: 12, color: T.muted, lineHeight: "20px" }}>
        Every closed-won deal in this cohort for the deal types in view, with revenue attributed for {keyToLabel(month)}
        {" "}(latest deal wins; superseded re-signs are dimmed). Queried live from Snowflake.
      </div>
      {state.error && (
        <div style={{ margin: "12px 24px", border: `1px solid ${T.red}`, background: "rgba(220,38,38,0.10)", padding: "10px 14px", fontSize: 12, color: "#F5A399" }}>{state.error}</div>
      )}
      {state.loading ? (
        <div style={{ padding: 48, textAlign: "center", color: T.muted, fontSize: 13, display: "flex", gap: 10, justifyContent: "center", alignItems: "center" }}>
          <Loader2 size={16} className="spin" /> Querying deals…
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
          <thead>
            <tr>
              <th style={thModal()}>Deal</th>
              <th style={thModal()}>Rep</th>
              <th style={thModal()}>Merchant</th>
              <th style={thModal()}>Type</th>
              <th style={thModal(1)}>Deal ARR</th>
              <th style={thModal(1)}>Expected / mo</th>
              <th style={thModal(1)}>Actual ({keyToLabel(month)})</th>
              <th style={thModal(1)}>Attainment</th>
            </tr>
          </thead>
          <tbody>
            {state.rows.map((r, idx) => {
              const active = Number(r.active) === 1;
              const arr = Number(r.arr) || 0;
              const actual = r.actual == null ? null : Number(r.actual);
              const expected = arr / 12;
              const p = active && expected > 0 && actual != null ? actual / expected : null;
              const h = heat(p);
              return (
                <tr key={idx} style={{ opacity: active ? 1 : 0.4 }}>
                  <td style={{ ...mtd, color: T.text }}>{r.name}{!active && <span style={{ fontSize: 9, color: T.muted }}> · superseded</span>}</td>
                  <td style={mtd}>{r.rep || "—"}</td>
                  <td style={mtd}>{r.merchant}</td>
                  <td style={mtd}>{config.types[r.type]?.name || r.type}</td>
                  <td style={mtdNum}>{fmtMoneyFull(arr)}</td>
                  <td style={mtdNum}>{fmtMoneyFull(expected)}</td>
                  <td style={mtdNum}>{active && actual != null ? fmtMoneyFull(actual) : "—"}</td>
                  <td style={mtdNum}>{p != null ? <span style={{ background: h.bg, color: h.fg, padding: "2px 8px", fontWeight: 600 }}>{fmtPct(p)}</span> : "—"}</td>
                </tr>
              );
            })}
            {!state.rows.length && !state.error && (
              <tr><td colSpan={8} style={{ ...mtd, textAlign: "center", color: T.muted, padding: 32 }}>No matched deals for this cohort in the current deal-type view.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </ModalShell>
  );
}

/* ---------------- No-match modal ---------------- */
export function NoMatchModal({ config, data, selected, model, onClose }) {
  const isUnmapped = (t) => !(config && config.types[t] && config.types[t].cols && config.types[t].cols.length);
  const rows = (data.noMatchDeals || []).filter((r) => selected.has(r.type) || isUnmapped(r.type));
  return (
    <ModalShell
      eyebrow="Unmeasured closed-won"
      title="No match / unmapped deals"
      onClose={onClose}
      subtitle={
        <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>
          {rows.length} of the largest deals shown ({model.nmTotals.n} deals, {fmtMoney(model.nmTotals.amt)} ARR in view).
          NB+XSell closed-won deals we can’t score — unmatched Redo ID (not yet live, or a typo) or a product type with no mapped revenue column.
        </div>
      }
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thModal()}>Deal</th>
            <th style={thModal()}>Rep</th>
            <th style={thModal()}>Redo ID</th>
            <th style={thModal()}>Type</th>
            <th style={thModal(1)}>Deal ARR</th>
            <th style={thModal(1)}>Cohort</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ ...mtd, color: T.text }}>{r.name}</td>
              <td style={mtd}>{r.rep}</td>
              <td style={{ ...mtd, fontSize: 10, color: T.muted }}>{r.redoId}</td>
              <td style={mtd}>{config.types[r.type]?.name || r.type}</td>
              <td style={mtdNum}>{fmtMoneyFull(r.arr)}</td>
              <td style={mtdNum}>{keyToLabel(r.cohort)}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={6} style={{ ...mtd, textAlign: "center", color: T.muted, padding: 32 }}>No unmatched deals in the current view.</td></tr>
          )}
        </tbody>
      </table>
    </ModalShell>
  );
}

/* ---------------- Config drawer (editable mapping) ---------------- */
export function ConfigDrawer({ config, discovered, data, onSave, onClose }) {
  const [draft, setDraft] = useState(() => cloneCfg(config));
  const [expanded, setExpanded] = useState(null);

  const revCols = useMemo(() => {
    const s = new Set(discovered?.revCols || []);
    for (const slug of draft.order) draft.types[slug].cols.forEach((c) => s.add(c));
    return [...s].sort();
  }, [discovered, draft]);

  const clouds = CLOUDS;
  const setType = (slug, patch) =>
    setDraft((d) => ({ ...d, types: { ...d.types, [slug]: { ...d.types[slug], ...patch } } }));
  const toggleCol = (slug, col) => setDraft((d) => {
    const cur = d.types[slug].cols;
    const cols = cur.includes(col) ? cur.filter((c) => c !== col) : [...cur, col];
    return { ...d, types: { ...d.types, [slug]: { ...d.types[slug], cols } } };
  });

  // duplicate column detection across included, mapped types
  const dupes = useMemo(() => {
    const seen = {};
    for (const slug of draft.order) {
      const t = draft.types[slug];
      if (!t.on) continue;
      for (const c of t.cols) (seen[c] = seen[c] || []).push(t.name);
    }
    return Object.entries(seen).filter(([, ts]) => ts.length > 1);
  }, [draft]);

  const autoMap = () => setDraft((d) => {
    const nd = cloneCfg(d);
    for (const slug of nd.order) {
      const t = nd.types[slug];
      if (t.cols.length) continue;
      const guess = (discovered?.revCols || []).find((c) => c.toLowerCase() === `${t.name} revenue`.toLowerCase())
        || (discovered?.revCols || []).find((c) => c.toLowerCase().startsWith(t.name.toLowerCase()) && c.toLowerCase().endsWith("revenue"));
      if (guess) t.cols = [guess];
    }
    return nd;
  });

  const grouped = clouds.map((cl) => ({ cl, slugs: draft.order.filter((s) => (draft.types[s].cloud || "other") === cl.id) })).filter((g) => g.slugs.length);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(13,13,13,0.72)" }} />
      <aside style={{ position: "relative", width: "min(680px, 100vw)", background: T.surface, borderLeft: `1px solid ${T.divider2}`, height: "100%", overflowY: "auto", color: T.body }}>
        <div style={{ padding: "24px", borderBottom: `1px solid ${T.divider}`, display: "flex", alignItems: "flex-start", position: "sticky", top: 0, background: T.surface, zIndex: 2 }}>
          <div style={{ marginRight: "auto" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>Configuration</div>
            <div style={{ fontFamily: SERIF, fontWeight: 400, fontSynthesis: "none", fontSize: 28, lineHeight: "32px", color: T.text, marginTop: 4 }}>Deal type → revenue column</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}><X size={18} /></button>
        </div>

        <div style={{ padding: 24, fontSize: 13, lineHeight: "20px" }}>
          <Section label="How it works">
            <Mono>STAGING.HUBSPOT.STG_DEALS</Mono> (New Business + XSell, closed-won) joins <Mono>KITCHEN.PANTRY.INGR_MONTHLY_REPORT_V2</Mono> on Redo ID
            (<Mono>TEAM_ID</Mono> = <Mono>Merchant ID</Mono>). Expected monthly = deal ARR ÷ 12. Each deal type sums one or more
            revenue columns below; edit the mapping whenever the report’s columns change, then <strong style={{ color: T.text }}>Save &amp; refresh</strong>.
          </Section>

          {dupes.length > 0 && (
            <div style={{ border: `1px solid ${T.orange}`, background: "rgba(255,68,5,0.08)", padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#FFB59B", display: "flex", gap: 8 }}>
              <AlertTriangle size={15} style={{ flex: "0 0 auto", marginTop: 1 }} />
              <div>Same revenue column mapped to multiple included types — this double-counts revenue:
                {dupes.map(([c, ts]) => <div key={c} style={{ marginTop: 4 }}><Mono>{c}</Mono> → {ts.join(", ")}</div>)}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button onClick={autoMap} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, fontFamily: SANS, cursor: "pointer", border: `1px solid ${T.divider2}`, background: "transparent", color: T.body }}>
              <Wand2 size={13} /> Auto-map unmapped by name
            </button>
          </div>

          {grouped.map(({ cl, slugs }) => (
            <div key={cl.id} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted, marginBottom: 8 }}>{cl.label}</div>
              {slugs.map((slug) => {
                const t = draft.types[slug];
                const open = expanded === slug;
                return (
                  <div key={slug} style={{ borderBottom: `1px solid ${T.divider}`, padding: "8px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <label style={{ cursor: "pointer", display: "inline-flex" }}>
                        <span style={{ width: 15, height: 15, border: `1px solid ${t.on ? "#F7F6F4" : T.divider2}`, background: t.on ? "#F7F6F4" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          {t.on && <Check size={11} color={T.page} strokeWidth={3} />}
                        </span>
                        <input type="checkbox" checked={t.on} onChange={() => setType(slug, { on: !t.on })} style={{ display: "none" }} />
                      </label>
                      <div style={{ minWidth: 150 }}>
                        <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{t.name}</div>
                        <div style={{ fontSize: 10, color: T.muted }}>{slug}{t.count != null ? ` · ${t.count} deals · ${fmtMoney(t.arr)} ARR` : ""}</div>
                      </div>
                      <button onClick={() => setExpanded(open ? null : slug)} style={{ marginLeft: "auto", textAlign: "right", background: "none", border: `1px solid ${T.divider2}`, color: t.cols.length ? T.body : T.orange, cursor: "pointer", fontSize: 11, padding: "4px 10px", fontFamily: SANS, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.cols.length ? t.cols.join(" + ") : "unmapped — click to map"}
                      </button>
                    </div>
                    {open && (
                      <ColumnPicker cols={revCols} selected={t.cols} onToggle={(c) => toggleCol(slug, c)} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ position: "sticky", bottom: 0, background: T.surface, borderTop: `1px solid ${T.divider2}`, padding: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 18px", fontSize: 12, fontWeight: 600, fontFamily: SANS, cursor: "pointer", border: `1px solid ${T.divider2}`, background: "transparent", color: T.body }}>Cancel</button>
          <button onClick={() => onSave(draft)} style={{ padding: "10px 18px", fontSize: 12, fontWeight: 600, fontFamily: SANS, cursor: "pointer", border: "1px solid #F7F6F4", background: "#F7F6F4", color: T.page }}>Save &amp; refresh</button>
        </div>
      </aside>
    </div>
  );
}

function ColumnPicker({ cols, selected, onToggle }) {
  const [q, setQ] = useState("");
  const shown = cols.filter((c) => c.toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ marginTop: 8, marginLeft: 25, border: `1px solid ${T.divider}`, background: T.surfaceAlt, padding: 10 }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter revenue columns…"
        style={{ width: "100%", padding: "6px 8px", fontSize: 12, fontFamily: SANS, background: T.page, border: `1px solid ${T.divider2}`, color: T.text, marginBottom: 8 }} />
      <div style={{ maxHeight: 200, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px" }}>
        {shown.map((c) => {
          const on = selected.includes(c);
          return (
            <label key={c} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", cursor: "pointer", fontSize: 11, color: on ? T.text : T.body }}>
              <span style={{ width: 13, height: 13, flex: "0 0 auto", border: `1px solid ${on ? "#F7F6F4" : T.divider2}`, background: on ? "#F7F6F4" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                {on && <Check size={10} color={T.page} strokeWidth={3} />}
              </span>
              <input type="checkbox" checked={on} onChange={() => onToggle(c)} style={{ display: "none" }} />
              {c}
            </label>
          );
        })}
        {!shown.length && <div style={{ fontSize: 11, color: T.muted, padding: 4 }}>No columns match “{q}”.</div>}
      </div>
    </div>
  );
}

function cloneCfg(config) {
  const types = {};
  for (const k in config.types) types[k] = { ...config.types[k], cols: [...config.types[k].cols] };
  return { types, order: [...config.order] };
}
