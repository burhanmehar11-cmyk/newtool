import type { ResourceDef } from "@/lib/mcp/protocol";

/**
 * Visual cards shown inside AI apps (ChatGPT plugins, MCP Apps hosts) for
 * some tool results. Each is one self-contained HTML file: no external
 * scripts, styles or images, so it runs inside the host's sandbox with no
 * extra permissions. The data is the tool's structuredContent, received
 * either through ChatGPT's window.openai bridge or the MCP Apps messages.
 * If a host shows no cards, the tool's text result is used as before.
 */

export const MCP_APP_MIME = "text/html;profile=mcp-app";
export const SEARCH_CARD_URI = "ui://locenti/search-results.html";
export const LEAD_CARD_URI = "ui://locenti/lead.html";

/** Tool metadata that points a tool's result at a card (MCP Apps, plus ChatGPT's alias). */
export function cardMeta(uri: string, invoking: string, invoked: string) {
  return { ui: { resourceUri: uri }, "openai/outputTemplate": uri, "openai/toolInvocation/invoking": invoking, "openai/toolInvocation/invoked": invoked, "openai/widgetAccessible": false };
}

const BASE_STYLE = `
:root{--bg:#fff;--card:#fff;--ink:#0b1a17;--slate:#5b6b67;--line:#e3e8e6;--green:#0f6b4f;--mint:#d9f7e8;--warn:#9a5b00;--chip:#f2f5f4}
@media (prefers-color-scheme:dark){:root{--bg:#0d1513;--card:#121c1a;--ink:#eef5f2;--slate:#9fb1ac;--line:#24322f;--green:#5fd3a2;--mint:#173a2e;--warn:#f0b35a;--chip:#1a2724}}
html[data-theme=dark]{--bg:#0d1513;--card:#121c1a;--ink:#eef5f2;--slate:#9fb1ac;--line:#24322f;--green:#5fd3a2;--mint:#173a2e;--warn:#f0b35a;--chip:#1a2724}
*{box-sizing:border-box}body{margin:0;background:transparent;color:var(--ink);font:14px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{padding:4px}.head{display:flex;align-items:center;gap:8px;margin:0 0 10px}.logo{width:22px;height:22px;border-radius:6px;background:#0b1a17;color:#7ff0bd;display:grid;place-items:center;font-weight:800;font-size:12px}
.title{font-weight:650}.muted{color:var(--slate);font-size:12.5px}.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.chip{display:inline-block;background:var(--chip);border-radius:999px;padding:2px 8px;font-size:12px;margin:4px 4px 0 0;word-break:break-all}.badge{display:inline-block;border-radius:999px;padding:1px 8px;font-size:11.5px;font-weight:600;background:var(--mint);color:var(--green)}
a{color:var(--green);text-decoration:none;cursor:pointer}a:hover{text-decoration:underline}.btn{display:inline-block;margin-top:10px;background:var(--green);color:#fff;border-radius:10px;padding:7px 12px;font-weight:600;font-size:13px}
.btn:hover{text-decoration:none;opacity:.92}.empty{color:var(--slate);padding:8px 2px}
`;

/** Shared bridge: gets the data from the host, opens links, follows the host's theme. */
const BRIDGE = `
var LOCENTI = (function(){
  var listeners = [], seq = 1;
  function emit(data){ if (data) listeners.forEach(function(f){ f(data); }); }
  function rpc(method, params, isNote){ var m = { jsonrpc: "2.0", method: method, params: params || {} }; if (!isNote) m.id = seq++; try { window.parent.postMessage(m, "*"); } catch (e) {} }
  function theme(t){ if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t); }
  window.addEventListener("message", function(ev){
    var m = ev.data; if (!m || m.jsonrpc !== "2.0") return;
    if (m.method === "ui/notifications/tool-result" && m.params) emit(m.params.structuredContent);
    if (m.result && m.result.hostContext && m.result.hostContext.theme) theme(m.result.hostContext.theme);
    if (m.method === "ui/notifications/host-context-changed" && m.params && m.params.theme) theme(m.params.theme);
  });
  window.addEventListener("openai:set_globals", function(){ if (window.openai) { theme(window.openai.theme); emit(window.openai.toolOutput); } });
  return {
    onData: function(f){ listeners.push(f); if (window.openai) { theme(window.openai.theme); if (window.openai.toolOutput) f(window.openai.toolOutput); } else { rpc("ui/initialize", { protocolVersion: "2026-01-26", appInfo: { name: "Locenti", version: "1.0.0" }, appCapabilities: {} }); rpc("ui/notifications/initialized", {}, true); } },
    open: function(href){ if (!/^https:\\/\\//.test(href)) return; if (window.openai && window.openai.openExternal) window.openai.openExternal({ href: href }); else { rpc("ui/open-link", { url: href }); } },
    el: function(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = String(text); return e; },
    link: function(text, href){ var a = document.createElement("a"); a.textContent = text; a.addEventListener("click", function(ev){ ev.preventDefault(); LOCENTI.open(href); }); return a; }
  };
})();
`;

const page = (title: string, script: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${BASE_STYLE}</style></head><body><div class="wrap" id="root"><div class="empty">Loading…</div></div><script>${BRIDGE}${script}</script></body></html>`;

const SEARCH_SCRIPT = `
LOCENTI.onData(function(d){
  var root = document.getElementById("root"); root.innerHTML = ""; var el = LOCENTI.el;
  var results = (d && d.results) || [];
  var head = el("div", "head"); head.appendChild(el("div", "logo", "L"));
  var t = el("div"); t.appendChild(el("div", "title", results.length + " business" + (results.length === 1 ? "" : "es") + " found"));
  if (d && d.query) t.appendChild(el("div", "muted", typeof d.query === "string" ? d.query : JSON.stringify(d.query)));
  head.appendChild(t); root.appendChild(head);
  if (!results.length) { root.appendChild(el("div", "empty", "No businesses matched. Try a bigger area or fewer filters.")); return; }
  var list = el("div"); list.style.display = "grid"; list.style.gap = "8px";
  results.slice(0, 60).forEach(function(r){
    var c = el("div", "card");
    var top = el("div"); top.style.display = "flex"; top.style.justifyContent = "space-between"; top.style.gap = "8px";
    top.appendChild(el("div", "title", r.name || "Business"));
    if (r.already_saved) top.appendChild(el("span", "badge", "Saved"));
    c.appendChild(top);
    var meta = [r.category, r.rating ? "\\u2605 " + r.rating + (r.reviews ? " (" + r.reviews + ")" : "") : null].filter(Boolean).join(" \\u00b7 ");
    if (meta) c.appendChild(el("div", "muted", meta));
    if (r.address) c.appendChild(el("div", "muted", r.address));
    var line = el("div");
    (r.emails || []).slice(0, 3).forEach(function(e){ line.appendChild(el("span", "chip", e)); });
    if (r.phone) line.appendChild(el("span", "chip", r.phone));
    c.appendChild(line);
    if (r.website) { var w = el("div"); w.style.marginTop = "6px"; w.appendChild(LOCENTI.link(r.website.replace(/^https?:\\/\\//, "").replace(/\\/$/, ""), r.website)); c.appendChild(w); }
    list.appendChild(c);
  });
  root.appendChild(list);
  root.appendChild(el("p", "muted", "Ask to save the ones you want as leads in Locenti."));
});
`;

const LEAD_SCRIPT = `
LOCENTI.onData(function(d){
  var root = document.getElementById("root"); root.innerHTML = ""; var el = LOCENTI.el;
  if (!d || !d.business) { root.appendChild(el("div", "empty", "No lead details.")); return; }
  var b = d.business, brief = d.brief;
  var head = el("div", "head"); head.appendChild(el("div", "logo", "L"));
  var t = el("div"); t.appendChild(el("div", "title", b.name || "Lead"));
  t.appendChild(el("div", "muted", [b.niche, b.city, b.source].filter(Boolean).join(" \\u00b7 ")));
  head.appendChild(t);
  if (brief && brief.fit) { var f = el("span", "badge", "Fit: " + brief.fit); f.style.marginLeft = "auto"; head.appendChild(f); }
  root.appendChild(head);
  var c = el("div", "card");
  if (!brief) c.appendChild(el("div", "empty", d.research && d.research.status ? "Research: " + d.research.status : "Not researched yet. Ask to research this lead."));
  function section(title, items, render){ if (!items || !items.length) return; c.appendChild(el("div", "title", title)).style.marginTop = "8px"; var ul = el("ul"); ul.style.margin = "4px 0 0"; ul.style.paddingLeft = "18px"; items.slice(0, 8).forEach(function(i){ ul.appendChild(render(i)); }); c.appendChild(ul); }
  if (brief) {
    section("What the website shows", brief.facts, function(fct){ var li = el("li", null, fct.text); (fct.sources || []).slice(0, 2).forEach(function(s){ if (s && s.url) { li.appendChild(document.createTextNode(" ")); var a = LOCENTI.link("source", s.url); a.className = "muted"; li.appendChild(a); } }); return li; });
    section("Opportunities", brief.opportunities_suggested, function(o){ return el("li", null, o.text); });
  }
  if (d.contacts && d.contacts.length) { var line = el("div"); line.style.marginTop = "8px"; d.contacts.slice(0, 4).forEach(function(x){ line.appendChild(el("span", "chip", x.email)); }); c.appendChild(line); }
  if (d.latest_draft) { var dr = el("div"); dr.style.marginTop = "10px"; dr.appendChild(el("div", "title", "Latest draft: " + (d.latest_draft.subject || ""))); var body = el("div", "muted", (d.latest_draft.body || "").slice(0, 400)); body.style.whiteSpace = "pre-wrap"; dr.appendChild(body); c.appendChild(dr); }
  root.appendChild(c);
  if (d.url) { var btn = LOCENTI.link("Open in Locenti", d.url); btn.className = "btn"; root.appendChild(btn); }
});
`;

export const MCP_RESOURCES: ResourceDef[] = [
  {
    uri: SEARCH_CARD_URI,
    name: "Search results card",
    description: "Businesses found on Google Maps, with ratings, emails and websites.",
    mimeType: MCP_APP_MIME,
    text: page("Locenti search results", SEARCH_SCRIPT),
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: false }, "openai/widgetDescription": "Shows the businesses Locenti found, with ratings, public emails and websites." },
  },
  {
    uri: LEAD_CARD_URI,
    name: "Lead card",
    description: "A lead's website research: facts with sources, opportunities, contacts and the latest draft.",
    mimeType: MCP_APP_MIME,
    text: page("Locenti lead", LEAD_SCRIPT),
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: false }, "openai/widgetDescription": "Shows a lead's research brief, contacts and latest draft, with a link to open it in Locenti." },
  },
];
