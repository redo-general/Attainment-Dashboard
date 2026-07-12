/* Headless render smoke test for index.html. No browser, no Snowflake.
   Extracts the app's <script type="module">, mounts it in jsdom, and renders
   every major view/modal to catch template/logic breakage fast.
   Run: npm test
*/
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const html = await readFile(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
let js = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
// Drop the boot IIFE (it touches the real /api/sdk) and expose what we test.
js = js.replace(/\/\* -+ boot -+ \*\/\s*\(async function boot\(\)\{[\s\S]*?\}\)\(\);/, "/* boot removed for test */");
js += "\nexport { render, state, seedConfig };\nexport function __setFridge(f){ fridge=f; }\n";

const dom = new JSDOM('<!doctype html><body><div id="app"></div><div id="overlay"></div></body>', { url:"https://x.test/" });
global.window = dom.window; global.document = dom.window.document;

const mod = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const { render, state, seedConfig, __setFridge } = mod;
__setFridge({ snowflake:{ query:async()=>({rows:[]}) }, db:{ collection:()=>({ list:async()=>[], create:async()=>{} }) }, identity:{ me:async()=>({email:"t@t"}) } });

state.config = seedConfig();
state.data = {
  nowKey:"2026-06", refreshedAt:"2026-06-15T12:00:00.000Z",
  grid:[
    {cohort:"2026-05", type:"returns", rep:"Alice", exp:[100,100], act:[80,120], cnt:[2,2]},
    {cohort:"2026-06", type:"returns", rep:"Bob",   exp:[90],      act:[70],     cnt:[1]},
    {cohort:"2026-05", type:"oms",     rep:"Alice", exp:[50,50],    act:[40,60],  cnt:[1,1]},
  ],
  totalMapped:[{type:"returns", rev:[1000,1200], months:["2026-05","2026-06"]}, {type:"oms", rev:[300,350], months:["2026-05","2026-06"]}],
  mgrid:[
    {cohort:"2026-05", type:"__all__", rep:"Alice", exp:[500,500], act:[400,600], cnt:[3,3]},
    {cohort:"2026-06", type:"__all__", rep:"Bob",   exp:[700],     act:[900],     cnt:[2]},
  ],
  mrev:[{type:"__all__", rev:[6000,7000], months:["2026-05","2026-06"]}],
  mpreclose:[{cohort:"2026-05", rep:"Alice", rev:[300], months:["2026-04"]}],
  recon:{total:1000, c_relo:600, c_ship:100, c_conv:100, c_mktg:100, c_finance:0, c_plat:100, p_relo:650, p_ship:100, p_conv:100, p_mktg:100, p_plat:80},
};
state.phase = "ready";

const app = document.getElementById("app");
const results = [];
const run = (name, mutate) => { try { mutate(); render();
  const ok = app.innerHTML.length > 200 && app.innerHTML.includes("Total");
  results.push([name, ok ? "OK" : "THIN", "merchantView=" + state._merchantView]);
} catch(e){ results.push([name, "THROW", String(e && e.stack || e).split("\n").slice(0,3).join(" | ")]); } };

run("product msc",     () => { state.selected=new Set(["returns"]); state.view="msc"; state.runRate=false; state.showPreClose=false; });
run("product cal",     () => { state.view="cal"; });
run("merchant msc",    () => { state.selected=new Set(state.types); state.view="msc"; });
run("merchant cal+rr", () => { state.view="cal"; state.runRate=true; });
run("merchant preclose",() => { state.advancedOpen=true; state.showPreClose=true; state.showEarly=true; });
run("mcell modal",     () => { state.modal={kind:"mcell", cohort:"2026-05", month:"2026-06"}; });
run("checks modal",    () => { state.modal={kind:"checks"}; });

let bad = 0;
for (const r of results){ if (r[1] !== "OK") bad++; console.log(r[1].padEnd(8), r[0].padEnd(18), r[2]); }
console.log(bad ? `\nFAIL: ${bad} case(s)` : "\nALL RENDER CASES OK");
process.exit(bad ? 1 : 0);
