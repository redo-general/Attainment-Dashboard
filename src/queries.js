/* ============================================================
   SQL generators for the Deal Attainment Dashboard.

   Every query is a single read-only SELECT/WITH accepted by
   fridge.snowflake.query(). Cohort month is HubSpot CLOSED_WON
   converted to America/Denver (Mountain Time) then truncated.
   Join key: STG_DEALS.TEAM_ID = INGR_MONTHLY_REPORT_V2."Merchant ID".
   Expected monthly = DEAL_AMOUNT / 12 (HubSpot amount is annualized).
   Attribution: latest deal closed on/before a month wins that
   month's revenue for a merchant + deal type (re-signs never
   double count).
   ============================================================ */

export const DEALS = "STAGING.HUBSPOT.STG_DEALS";
export const REPORT = "KITCHEN.PANTRY.INGR_MONTHLY_REPORT_V2";
export const START = "2023-01-01";

/* SQL string literal escape (single quotes). */
const sq = (s) => `'${String(s).replace(/'/g, "''")}'`;
/* SQL quoted identifier for a column with spaces / special chars. */
const qid = (s) => `"${String(s).replace(/"/g, '""')}"`;
/* slug -> UNPIVOT alias (letters/digits/underscore only). */
const alias = (slug) => "t_" + slug.replace(/[^a-z0-9_]/gi, "_").toLowerCase();

/* Mapped revenue expression for one type: ZEROIFNULL sum of its columns. */
const revExpr = (cols) =>
  cols.length ? cols.map((c) => `ZEROIFNULL(${qid(c)})`).join(" + ") : "0";

/* Number of calendar months in the spine, START .. current month inclusive. */
export function monthSpan(nowKey) {
  const [y, m] = nowKey.split("-").map(Number);
  return (y - 2023) * 12 + (m - 1) + 1;
}

/* Common CTEs: month spine + report merchant ids + matched closed-won deals
   for the given type slugs. `types` is [{slug, cols}]. */
function baseCTEs(types, span) {
  const slugs = types.map((t) => sq(t.slug)).join(",");
  return `
months AS (
  SELECT DATEADD(month, ROW_NUMBER() OVER (ORDER BY seq4())-1, DATE '${START}') AS m
  FROM TABLE(GENERATOR(ROWCOUNT => ${span}))
),
report_mids AS (SELECT DISTINCT ${qid("Merchant ID")} AS mid FROM ${REPORT}),
deals AS (
  SELECT TEAM_ID AS mid, PRODUCT AS type, DEAL_AMOUNT AS arr,
         DATE_TRUNC('month', CONVERT_TIMEZONE('America/Denver', CLOSED_WON))::date AS close_m,
         DEAL_ID
  FROM ${DEALS}
  WHERE HS_IS_CLOSED_WON = TRUE AND CLOSED_WON IS NOT NULL AND TEAM_ID IS NOT NULL
    AND PRODUCT IN (${slugs})
    AND CONVERT_TIMEZONE('America/Denver', CLOSED_WON) >= DATE '${START}'
    AND TEAM_ID IN (SELECT mid FROM report_mids)
)`;
}

/* rev_long CTE: long-format mapped revenue per merchant + month + type,
   built from a single scan of the report via UNPIVOT. */
function revLongCTE(types, extraWhere = "") {
  const inner = types
    .map((t) => `${revExpr(t.cols)} AS ${alias(t.slug)}`)
    .join(",\n      ");
  const aliases = types.map((t) => alias(t.slug));
  const cases = types
    .map((t) => `WHEN ${sq(alias(t.slug))} THEN ${sq(t.slug)}`)
    .join(" ");
  return `
rev_long AS (
  SELECT mid, m, CASE LOWER(typecol) ${cases} END AS type, rev
  FROM (
    SELECT ${qid("Merchant ID")} AS mid, ${qid("Date")} AS m,
      ${inner}
    FROM ${REPORT} WHERE ${qid("Date")} >= DATE '${START}' ${extraWhere}
  ) UNPIVOT (rev FOR typecol IN (${aliases.join(",")}))
),
rev AS (SELECT mid, m, type, SUM(rev) AS rev FROM rev_long GROUP BY 1,2,3)`;
}

/* ---- 1. Deal-type discovery: PRODUCT values, counts, ARR ---- */
export function qDealTypes() {
  return `SELECT PRODUCT AS slug, COUNT(*) AS n, ROUND(SUM(DEAL_AMOUNT)) AS arr,
    COUNT(DISTINCT PRODUCT_CLOUD) AS clouds,
    MAX(PRODUCT_CLOUD) AS product_cloud
  FROM ${DEALS}
  WHERE HS_IS_CLOSED_WON = TRUE AND CLOSED_WON IS NOT NULL
    AND CONVERT_TIMEZONE('America/Denver', CLOSED_WON) >= DATE '${START}'
    AND PRODUCT IS NOT NULL AND PRODUCT <> ''
  GROUP BY 1 ORDER BY n DESC`;
}

/* ---- 2. Revenue-column discovery: every %Revenue% column ---- */
export function qRevenueColumns() {
  return `SELECT column_name AS col, ordinal_position AS pos
  FROM KITCHEN.INFORMATION_SCHEMA.COLUMNS
  WHERE table_schema = 'PANTRY' AND table_name = 'INGR_MONTHLY_REPORT_V2'
    AND column_name ILIKE '%Revenue%'
  ORDER BY ordinal_position`;
}

/* ---- 3. Cohort grid: per (cohort, type) monthly expected/actual/count arrays ---- */
export function qGrid(types, span) {
  return `WITH ${baseCTEs(types, span)},
deal_months AS (
  SELECT d.mid, d.type, d.arr, d.close_m, d.DEAL_ID, mo.m,
         ROW_NUMBER() OVER (PARTITION BY d.mid, d.type, mo.m ORDER BY d.close_m DESC, d.DEAL_ID DESC) AS rn
  FROM deals d JOIN months mo ON mo.m >= d.close_m
),
attributed AS (SELECT mid, type, m, arr, close_m FROM deal_months WHERE rn = 1),
${revLongCTE(types)},
joined AS (
  SELECT a.close_m AS cohort, a.type, a.m, a.arr/12 AS expected, COALESCE(r.rev,0) AS actual, a.mid
  FROM attributed a LEFT JOIN rev r ON r.mid = a.mid AND r.type = a.type AND r.m = a.m
),
per_month AS (
  SELECT cohort, type, m, SUM(expected) AS expected, SUM(actual) AS actual, COUNT(DISTINCT mid) AS merchants
  FROM joined GROUP BY 1,2,3
)
SELECT TO_CHAR(cohort,'YYYY-MM') AS cohort, type,
  ARRAY_AGG(ROUND(expected)::int) WITHIN GROUP (ORDER BY m) AS exp_arr,
  ARRAY_AGG(ROUND(actual)::int)   WITHIN GROUP (ORDER BY m) AS act_arr,
  ARRAY_AGG(merchants)            WITHIN GROUP (ORDER BY m) AS cnt_arr
FROM per_month GROUP BY cohort, type ORDER BY cohort, type`;
}

/* ---- 4. Total mapped revenue per type per calendar month (all merchants) ----
   Used with the grid's attributed totals to derive Unattributed revenue. */
export function qTotalMapped(types, span) {
  return `WITH ${baseCTEs(types, span)},
${revLongCTE(types)},
tm AS (SELECT type, m, SUM(rev) AS rev FROM rev GROUP BY 1,2)
SELECT tm.type,
  ARRAY_AGG(ROUND(ZEROIFNULL(tm.rev))::int) WITHIN GROUP (ORDER BY tm.m) AS rev_arr,
  ARRAY_AGG(TO_CHAR(tm.m,'YYYY-MM'))         WITHIN GROUP (ORDER BY tm.m) AS mon_arr
FROM tm GROUP BY tm.type ORDER BY tm.type`;
}

/* ---- 5. No-match aggregate: closed-won deals with no report match ---- */
export function qNoMatchAgg(types) {
  const slugs = types.map((t) => sq(t.slug)).join(",");
  return `WITH report_mids AS (SELECT DISTINCT ${qid("Merchant ID")} AS mid FROM ${REPORT})
SELECT TO_CHAR(DATE_TRUNC('month', CONVERT_TIMEZONE('America/Denver', CLOSED_WON))::date,'YYYY-MM') AS cohort,
  PRODUCT AS type, COUNT(*) AS n, ROUND(SUM(DEAL_AMOUNT)) AS arr
FROM ${DEALS}
WHERE HS_IS_CLOSED_WON = TRUE AND CLOSED_WON IS NOT NULL
  AND CONVERT_TIMEZONE('America/Denver', CLOSED_WON) >= DATE '${START}'
  AND PRODUCT IN (${slugs})
  AND (TEAM_ID IS NULL OR TEAM_ID NOT IN (SELECT mid FROM report_mids))
GROUP BY 1,2 ORDER BY 1,2`;
}

/* ---- 6. No-match deals list: largest unmatched deals for the modal ---- */
export function qNoMatchDeals(types, limit = 100) {
  const slugs = types.map((t) => sq(t.slug)).join(",");
  return `WITH report_mids AS (SELECT DISTINCT ${qid("Merchant ID")} AS mid FROM ${REPORT})
SELECT DEAL_NAME AS name, COALESCE(AE_NAME,'—') AS rep, COALESCE(TEAM_ID,'—') AS redo_id,
  PRODUCT AS type, ROUND(DEAL_AMOUNT) AS arr,
  TO_CHAR(DATE_TRUNC('month', CONVERT_TIMEZONE('America/Denver', CLOSED_WON))::date,'YYYY-MM') AS cohort
FROM ${DEALS}
WHERE HS_IS_CLOSED_WON = TRUE AND CLOSED_WON IS NOT NULL
  AND CONVERT_TIMEZONE('America/Denver', CLOSED_WON) >= DATE '${START}'
  AND PRODUCT IN (${slugs})
  AND (TEAM_ID IS NULL OR TEAM_ID NOT IN (SELECT mid FROM report_mids))
ORDER BY DEAL_AMOUNT DESC NULLS LAST LIMIT ${limit}`;
}

/* ---- 7. Cell drill-in: deal-level detail for one cohort + calendar month ----
   `cohort` and `month` are yyyy-mm keys. Revenue for a merchant+type in the
   month is credited to the latest deal(s) closed on/before it, pro-rata by ARR
   among ties. Deals superseded by a later re-sign show active=0. */
export function qCellDeals(types, cohort, month) {
  const slugs = types.map((t) => sq(t.slug)).join(",");
  const cohortDate = `${cohort}-01`;
  const monthDate = `${month}-01`;
  return `WITH report_mids AS (SELECT DISTINCT ${qid("Merchant ID")} AS mid FROM ${REPORT}),
mnames AS (SELECT ${qid("Merchant ID")} AS mid, MAX_BY(${qid("Merchant Name")}, ${qid("Date")}) AS name
           FROM ${REPORT} GROUP BY 1),
cohort_deals AS (
  SELECT DEAL_ID, DEAL_NAME AS name, COALESCE(AE_NAME,'—') AS rep, TEAM_ID AS mid,
         PRODUCT AS type, DEAL_AMOUNT AS arr
  FROM ${DEALS}
  WHERE HS_IS_CLOSED_WON = TRUE AND CLOSED_WON IS NOT NULL AND TEAM_ID IS NOT NULL
    AND PRODUCT IN (${slugs})
    AND TEAM_ID IN (SELECT mid FROM report_mids)
    AND DATE_TRUNC('month', CONVERT_TIMEZONE('America/Denver', CLOSED_WON))::date = DATE '${cohortDate}'
),
latest AS (
  SELECT TEAM_ID AS mid, PRODUCT AS type,
         MAX(DATE_TRUNC('month', CONVERT_TIMEZONE('America/Denver', CLOSED_WON))::date) AS max_close
  FROM ${DEALS}
  WHERE HS_IS_CLOSED_WON = TRUE AND CLOSED_WON IS NOT NULL AND TEAM_ID IS NOT NULL
    AND PRODUCT IN (${slugs})
    AND DATE_TRUNC('month', CONVERT_TIMEZONE('America/Denver', CLOSED_WON))::date <= DATE '${monthDate}'
  GROUP BY 1,2
),
${revLongCTE(types, `AND ${qid("Date")} = DATE '${monthDate}'`)},
alloc AS (
  SELECT cd.*, l.max_close, SUM(cd.arr) OVER (PARTITION BY cd.mid, cd.type) AS grp_arr
  FROM cohort_deals cd JOIN latest l ON l.mid = cd.mid AND l.type = cd.type
)
SELECT a.name, a.rep, COALESCE(mn.name, a.mid) AS merchant, a.type, ROUND(a.arr) AS arr,
  CASE WHEN a.max_close = DATE '${cohortDate}'
       THEN ROUND(COALESCE(r.rev,0) * a.arr / NULLIF(a.grp_arr,0)) END AS actual,
  CASE WHEN a.max_close = DATE '${cohortDate}' THEN 1 ELSE 0 END AS active
FROM alloc a
LEFT JOIN rev r ON r.mid = a.mid AND r.type = a.type
LEFT JOIN mnames mn ON mn.mid = a.mid
ORDER BY a.arr DESC NULLS LAST LIMIT 500`;
}
