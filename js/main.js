/* The GJU Internship Board page: loads the data files, builds the filters, draws the list and the charts.
 * Everything runs in the browser; the data files are plain JSON next to the page. */
import { Combo } from "./combo.js";
import { createCharts, areaColor } from "./charts.js";
import { el, icon, theme, toast, invalid, notice, pickDay, showDetails, showHelp, showMenu, closeMenu, copyText, countUp, revealOnScroll } from "./ui.js";

const L = window.BoardLogic;
const $ = (id) => document.getElementById(id);
const PAGE = 60;
const VIEW_KEY = "gjub-view";
const DEFAULT_RULES = { minWeeks: 20, minMonthlySalary: 861, approvedCountries: ["Germany", "Austria", "Switzerland", "Luxembourg"] };

const state = {
  all: [], byId: new Map(), index: { days: [], generatedAt: "" }, rules: DEFAULT_RULES, majorNames: {}, cityNames: {},
  areaOrder: [], areaOf: {}, areaMajors: {}, // the areas of study, the area of each major, and the majors of each area
  f: L.defaultFilters(), sort: "new", view: "table", filtered: [], shown: 0, selected: new Set(), body: null,
};
const combos = {};
let charts = null;

const get = (path) => fetch(path, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(`${path} ${r.status}`); return r.json(); });
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------------------------------------------------------------- loading

async function load() {
  const [index, postings, majors] = await Promise.all([get("data/index.json"), get("data/postings.json"), get("board/majors.json")]);
  const [skills, rules] = await Promise.all([get("data/skills.json").catch(() => ({ groups: [] })), get("data/rules.json").catch(() => DEFAULT_RULES)]);
  return { index, postings, majors, skills, rules };
}

function showSkeleton() {
  const box = el("div", "table-card skeleton-rows");
  for (let i = 0; i < 6; i++) box.append(el("div", "skeleton"));
  $("list").replaceChildren(box);
}

// ---------------------------------------------------------------- the filter controls

const levelItems = [{ value: "", label: "Any level", icon: "fa-infinity" }, ...L.LEVELS.filter((l) => l !== "none").map((l) => ({ value: l, label: `${l} · ${L.LEVEL_NAMES[l]}` }))];
const gjuItems = [
  { value: "", label: "All internships", icon: "fa-list" }, { value: "meets", label: L.GJU_LABELS.meets, icon: "fa-circle-check" },
  { value: "check", label: L.GJU_LABELS.check, icon: "fa-triangle-exclamation" }, { value: "fails", label: L.GJU_LABELS.fails, icon: "fa-circle-xmark" },
  { value: "hide-fails", label: "Hide the ones below a limit", icon: "fa-eye-slash" },
];
const sortItems = [
  { value: "new", label: "Newest first", icon: "fa-clock" }, { value: "company", label: "Company A–Z", icon: "fa-arrow-down-a-z" },
  { value: "weeks", label: "Longest duration", icon: "fa-hourglass-half" }, { value: "pay", label: "Highest pay", icon: "fa-euro-sign" },
];

function buildCombos({ majors, skills }) {
  const set = (key) => (value) => { state.f[key] = value; refresh(); };
  const byCount = (list, valueOf) => {
    const counts = new Map();
    list.forEach((p) => valueOf(p).forEach((v) => counts.set(v, (counts.get(v) || 0) + 1)));
    return counts;
  };

  // majors, in the order of the areas
  const majorItems = majors.areas.flatMap((area) => majors.majors.filter((m) => m.area === area).sort((a, b) => a.name.localeCompare(b.name)).map((m) => ({ value: m.id, label: m.name, group: area })));
  combos.majors = new Combo($("f-major"), { id: "c-major", label: "Major", icon: "fa-graduation-cap", multiple: true, placeholder: "Any major", items: majorItems, onChange: set("majors") });

  // skills: the library's groups, plus anything an advert had that the library does not list
  const known = new Set();
  const skillItems = skills.groups.flatMap((g) => g.skills.map((s) => { known.add(s); return { value: s, label: s, group: g.group }; }));
  const extra = [...new Set(state.all.flatMap((p) => p.skills || []))].filter((s) => !known.has(s)).sort();
  extra.forEach((s) => skillItems.push({ value: s, label: s, group: "Other" }));
  combos.skills = new Combo($("f-skills"), {
    id: "c-skills", label: "Skills", icon: "fa-screwdriver-wrench", multiple: true, placeholder: "Any skill", hideZero: true, items: skillItems, onChange: set("skills"),
    footer: (slot) => {
      slot.append(el("span", null, "Match"));
      const seg = el("div", "seg");
      seg.setAttribute("role", "group");
      seg.setAttribute("aria-label", "How many of the chosen skills must be in the advert");
      for (const [mode, text] of [["all", "All"], ["any", "Any"]]) {
        const b = el("button", null, text);
        b.type = "button"; b.dataset.mode = mode;
        b.addEventListener("click", () => { state.f.skillMode = mode; syncSkillMode(); refresh(); });
        seg.append(b);
      }
      slot.append(seg);
      syncSkillMode();
    },
  });

  // countries and cities, most common first
  const countryCounts = byCount(state.all, (p) => (p.country ? [p.country] : []));
  combos.countries = new Combo($("f-country"), {
    id: "c-country", label: "Country", icon: "fa-earth-europe", multiple: true, placeholder: "Any country", onChange: set("countries"),
    items: [...countryCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => ({ value: c, label: c === "unknown" ? "Not stated" : c })),
  });
  const cityForms = new Map();
  state.all.forEach((p) => { if (!p.city) return; const k = L.norm(p.city); const e = cityForms.get(k) || { n: 0, forms: new Map() }; e.n++; e.forms.set(p.city, (e.forms.get(p.city) || 0) + 1); cityForms.set(k, e); });
  const cityItems = [...cityForms.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0])).map(([k, e]) => ({ value: k, label: [...e.forms.entries()].sort((a, b) => b[1] - a[1])[0][0] }));
  cityItems.forEach((c) => { state.cityNames[c.value] = c.label; });
  combos.cities = new Combo($("f-city"), { id: "c-city", label: "City", icon: "fa-location-dot", multiple: true, placeholder: "Any city", hideZero: true, items: cityItems, onChange: set("cities") });

  combos.kinds = new Combo($("f-kind"), {
    id: "c-kind", label: "Kind", icon: "fa-briefcase", multiple: true, placeholder: "Any kind", onChange: set("kinds"),
    items: [{ value: "Praktikum", label: "Praktikum" }, { value: "Pflichtpraktikum", label: "Pflichtpraktikum (mandatory)" }, { value: "Internship", label: "Internship" }],
  });
  combos.gju = new Combo($("f-gju"), { id: "c-gju", label: "GJU rules", icon: "fa-scale-balanced", placeholder: "All internships", items: gjuItems, value: "", onChange: set("gju") });
  combos.german = new Combo($("f-german"), { id: "c-german", label: "My German level", icon: "fa-language", placeholder: "Any level", items: levelItems, value: "", onChange: set("german") });
  combos.english = new Combo($("f-english"), { id: "c-english", label: "My English level", icon: "fa-comments", placeholder: "Any level", items: levelItems, value: "", onChange: set("english") });
  combos.sort = new Combo($("f-sort"), { id: "c-sort", label: "Sort by", icon: "fa-arrow-down-wide-short", compact: true, placeholder: "Newest first", items: sortItems, value: "new", onChange: (v) => { state.sort = v || "new"; refresh(); } });
}

function syncSkillMode() {
  document.querySelectorAll("#f-skills .seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === state.f.skillMode)));
}

/** What each dropdown option would leave, given the other filters. */
function updateFacets() {
  const { all, f } = state;
  for (const [key, dim] of [["majors", "majors"], ["skills", "skills"], ["countries", "countries"], ["cities", "cities"], ["kinds", "kinds"]]) combos[key].setCounts(L.facetCounts(all, f, dim));
  const g = L.facetCounts(all, f, "gju");
  const meets = g.get("meets") || 0, check = g.get("check") || 0, fails = g.get("fails") || 0;
  combos.gju.setCounts(new Map([["", meets + check + fails], ["meets", meets], ["check", check], ["fails", fails], ["hide-fails", meets + check]]));
}

// ---------------------------------------------------------------- validation (SweetAlert2 windows)

const FIELD_KEY = { "min-weeks": "minWeeks", "min-pay": "minPay", "max-pay": "maxPay", from: "from", to: "to" };
const GROUPS = [["min-weeks"], ["min-pay", "max-pay"], ["from", "to"]];
let alerting = false;

/** The problem with one field (or its pair), or null. */
function check(id) {
  const box = $(id);
  const text = box.value.trim();
  const n = text === "" ? null : Number(text);
  if (box.validity && box.validity.badInput) return { title: "That is not a number", html: "Type digits only, for example <b>861</b>." };
  if (id === "min-weeks" && n != null && (!Number.isInteger(n) || n < 1 || n > 104)) return { title: "Check the duration", html: "Enter a whole number of weeks between <b>1</b> and <b>104</b>." };
  if ((id === "min-pay" || id === "max-pay") && n != null && (!Number.isFinite(n) || n < 0 || n > 20000)) return { title: "Check the pay", html: "Enter an amount between <b>0</b> and <b>20&nbsp;000</b> € per month." };
  if (id === "min-pay" || id === "max-pay") {
    const lo = $("min-pay").value.trim() === "" ? null : Number($("min-pay").value), hi = $("max-pay").value.trim() === "" ? null : Number($("max-pay").value);
    if (lo != null && hi != null && lo > hi) return { title: "Check the pay range", html: `The minimum (<b>${lo}</b> €) is higher than the maximum (<b>${hi}</b> €). Make the minimum smaller or the maximum larger.` };
  }
  if (id === "from" || id === "to") {
    const a = $("from").value, b = $("to").value;
    if (a && b && a > b) return { title: "Check the dates", html: `“Seen from” (<b>${a}</b>) is after “Seen until” (<b>${b}</b>). Swap them or pick another day.` };
  }
  return null;
}

const mark = (id, problem) => { if (problem) $(id).setAttribute("aria-invalid", "true"); else $(id).removeAttribute("aria-invalid"); };

function wireFields() {
  let timer;
  $("q").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { state.f.q = $("q").value; refresh(); }, 140); });
  for (const group of GROUPS) {
    for (const id of group) {
      // while typing: a good value filters at once; a bad one is only marked, never a window in the way
      $(id).addEventListener("input", () => {
        for (const other of group) {
          const problem = check(other);
          mark(other, problem);
          if (!problem) state.f[FIELD_KEY[other]] = $(other).value.trim();
        }
        refresh();
      });
      // on leaving the field: a bad value gets a window that says what to fix
      $(id).addEventListener("change", async () => {
        const problem = check(id);
        if (!problem || alerting) return;
        alerting = true;
        try { await invalid({ ...problem, focus: () => { $(id).focus(); if ($(id).select) $(id).select(); } }); } finally { alerting = false; }
      });
    }
  }
}

// ---------------------------------------------------------------- active filters

const GJU_CHIP = { meets: L.GJU_LABELS.meets, check: L.GJU_LABELS.check, fails: L.GJU_LABELS.fails, "hide-fails": "Hiding the ones below a limit" };

function syncControls() {
  const f = state.f;
  combos.majors.setValue(f.majors, { silent: true });
  combos.skills.setValue(f.skills, { silent: true });
  combos.countries.setValue(f.countries, { silent: true });
  combos.cities.setValue(f.cities, { silent: true });
  combos.kinds.setValue(f.kinds, { silent: true });
  combos.gju.setValue(f.gju, { silent: true });
  combos.german.setValue(f.german, { silent: true });
  combos.english.setValue(f.english, { silent: true });
  $("q").value = f.q;
  for (const [id, key] of Object.entries(FIELD_KEY)) { $(id).value = f[key]; mark(id, null); }
  syncSkillMode();
}

function change(key, value) { state.f[key] = value; syncControls(); refresh(); }

function chips() {
  const f = state.f;
  const out = [];
  const add = (iconClass, label, remove) => out.push({ iconClass, label, remove });
  if (f.q.trim()) add("fa-magnifying-glass", `“${f.q.trim()}”`, () => change("q", ""));
  f.majors.forEach((id) => add("fa-graduation-cap", state.majorNames[id] || id, () => change("majors", f.majors.filter((x) => x !== id))));
  f.skills.forEach((s) => add("fa-screwdriver-wrench", s, () => change("skills", f.skills.filter((x) => x !== s))));
  if (f.skills.length > 1 && f.skillMode === "any") add("fa-code-branch", "Any of the skills", () => { f.skillMode = "all"; syncControls(); refresh(); });
  f.countries.forEach((c) => add("fa-earth-europe", c === "unknown" ? "Country not stated" : c, () => change("countries", f.countries.filter((x) => x !== c))));
  f.cities.forEach((c) => add("fa-location-dot", state.cityNames[c] || c, () => change("cities", f.cities.filter((x) => x !== c))));
  f.kinds.forEach((k) => add("fa-briefcase", k, () => change("kinds", f.kinds.filter((x) => x !== k))));
  if (f.german) add("fa-language", `My German: ${f.german}`, () => change("german", ""));
  if (f.english) add("fa-comments", `My English: ${f.english}`, () => change("english", ""));
  if (f.gju) add("fa-scale-balanced", GJU_CHIP[f.gju], () => change("gju", ""));
  if (f.minWeeks !== "") add("fa-hourglass-half", `At least ${f.minWeeks} weeks`, () => change("minWeeks", ""));
  if (f.minPay !== "" || f.maxPay !== "") add("fa-euro-sign", f.minPay !== "" && f.maxPay !== "" ? `Pay ${f.minPay}–${f.maxPay} €` : f.minPay !== "" ? `Pay from ${f.minPay} €` : `Pay up to ${f.maxPay} €`, () => { f.minPay = ""; f.maxPay = ""; syncControls(); refresh(); });
  if (f.from) add("fa-calendar-days", `Seen from ${f.from}`, () => change("from", ""));
  if (f.to) add("fa-calendar-check", `Seen until ${f.to}`, () => change("to", ""));
  return out;
}

function renderChips() {
  const row = $("active-row");
  const list = chips();
  row.replaceChildren();
  if (!list.length) { row.append(el("span", "none", "No filters yet, so every internship is shown.")); return; }
  for (const c of list) {
    const chip = el("span", "chip");
    const lead = icon(c.iconClass);
    lead.classList.add("lead-i");
    const remove = el("button");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove filter: ${c.label}`);
    remove.append(icon("fa-xmark"));
    remove.addEventListener("click", c.remove);
    chip.append(lead, document.createTextNode(c.label), remove);
    row.append(chip);
  }
  const clear = el("button", "btn btn-ghost btn-sm");
  clear.type = "button";
  clear.append(icon("fa-filter-circle-xmark"), document.createTextNode("Clear all"));
  clear.addEventListener("click", clearAll);
  row.append(clear);
}

function clearAll() { state.f = L.defaultFilters(); syncControls(); refresh(); }

// ---------------------------------------------------------------- the list

function avatar(name) {
  const a = el("span", "avatar", L.initials(name));
  a.style.setProperty("--h", String(L.hue(name)));
  a.setAttribute("aria-hidden", "true");
  return a;
}

function stat(iconClass, text, tone) {
  const s = el("span", `stat ${tone}`);
  if (iconClass) s.append(icon(iconClass));
  s.append(document.createTextNode(text));
  return s;
}

function titleLink(p) {
  const href = L.safeUrl(p.url);
  if (!href) return el("span", "title", p.title);
  const a = el("a", "title", p.title);
  Object.assign(a, { href, target: "_blank", rel: "noopener noreferrer" });
  a.append(icon("fa-arrow-up-right-from-square"));
  return a;
}

function tags(p, withSkills) {
  const row = el("div", "tags");
  if (p.kind) row.append(el("span", "tag kind", p.kind));
  const majors = (p.majors || []).map((id) => state.majorNames[id] || id);
  majors.slice(0, 2).forEach((m) => row.append(el("span", "tag", m)));
  if (majors.length > 2) row.append(el("span", "tag", `+${majors.length - 2}`));
  if (withSkills) {
    (p.skills || []).slice(0, 4).forEach((s) => row.append(el("span", "tag skill", s)));
    if ((p.skills || []).length > 4) row.append(el("span", "tag skill", `+${p.skills.length - 4}`));
  }
  return row;
}

function langPill(code, level) {
  const pill = el("span", "lang" + (level === "unknown" || !level ? " unknown" : ""));
  pill.append(el("small", null, code), document.createTextNode(level === "none" ? "none" : level && level !== "unknown" ? level : "?"));
  const name = code === "DE" ? "German" : "English";
  pill.title = level === "none" ? `No ${name} required` : level && level !== "unknown" ? `${name} level ${level}` : `${name} level not stated`;
  return pill;
}

function gjuBadge(p) {
  const overall = (p.gju && p.gju.overall) || "check";
  const b = el("button", `badge ${overall}`);
  b.type = "button";
  b.append(icon({ meets: "fa-circle-check", check: "fa-triangle-exclamation", fails: "fa-circle-xmark" }[overall]), document.createTextNode(L.GJU_LABELS[overall]));
  b.setAttribute("aria-label", `${L.GJU_LABELS[overall]}. Show the details of ${p.title}`);
  b.dataset.action = "details";
  return b;
}

function rowMenu(p) {
  const b = el("button", "row-menu");
  b.type = "button";
  b.append(icon("fa-ellipsis-vertical"));
  b.setAttribute("aria-label", `Actions for ${p.title}`);
  b.setAttribute("aria-haspopup", "menu");
  b.setAttribute("aria-expanded", "false");
  b.dataset.action = "menu";
  return b;
}

function tone(p) {
  const by = Object.fromEntries(L.ruleLines(p, state.rules).map((l) => [l.key, l.state]));
  return { weeks: p.weeks ? by.weeks : "unknown", pay: p.pay ? by.pay : "unknown" };
}

function pick(p) {
  const box = el("input", "check");
  box.type = "checkbox";
  box.checked = state.selected.has(p.id);
  box.setAttribute("aria-label", `Tick ${p.title}`);
  return box;
}

function rowEl(p, i) {
  const t = tone(p);
  const tr = el("tr", state.selected.has(p.id) ? "picked" : "");
  tr.dataset.id = p.id;
  tr.style.setProperty("--i", String(i));
  const cell = (className, ...children) => { const td = el("td", className); td.append(...children); return td; };
  const main = cell("c-main", titleLink(p), tags(p, false));
  const company = el("div", "company");
  const name = el("span", "name", p.company || "Company not stated");
  company.append(avatar(p.company), name);
  const city = cell("c-city", document.createTextNode(p.city || "—"));
  if (p.country && p.country !== "unknown") city.append(el("span", "sub", p.country));
  const langs = el("div", "langs");
  langs.append(langPill("DE", p.germanLevel), langPill("EN", p.englishLevel));
  tr.append(
    cell("c-check", pick(p)), main, cell("c-company", company), city,
    cell("c-dur", stat("fa-hourglass-half", L.formatWeeks(p.weeks), t.weeks)), cell("c-pay", stat("fa-euro-sign", L.formatPay(p.pay), t.pay)),
    cell("c-lang", langs), cell("c-gju", gjuBadge(p)), cell("c-found", el("span", "when", L.ago(p.firstSeen))), cell("c-act", rowMenu(p)),
  );
  return tr;
}

function cardEl(p, i) {
  const t = tone(p);
  const card = el("article", "card-item" + (state.selected.has(p.id) ? " picked" : ""));
  card.dataset.id = p.id;
  card.style.setProperty("--i", String(i));
  const top = el("div", "card-top");
  const who = el("div", "who");
  who.append(el("span", "company-name", p.company || "Company not stated"), el("span", "sub", [p.city, p.country !== "unknown" ? p.country : ""].filter(Boolean).join(", ") || "Place not stated"));
  top.append(avatar(p.company), who, pick(p));
  const facts = el("dl", "facts");
  const fact = (iconClass, label, node) => { const d = el("div"); const dt = el("dt"); dt.append(icon(iconClass), document.createTextNode(label)); const dd = el("dd"); dd.append(node); d.append(dt, dd); facts.append(d); };
  fact("fa-hourglass-half", "Duration", stat(null, L.formatWeeks(p.weeks), t.weeks));
  fact("fa-euro-sign", "Pay", stat(null, L.formatPay(p.pay), t.pay));
  const langs = el("div", "langs");
  langs.append(langPill("DE", p.germanLevel), langPill("EN", p.englishLevel));
  fact("fa-language", "Languages", langs);
  fact("fa-clock", "Found", el("span", "when", L.ago(p.firstSeen)));
  const foot = el("div", "card-foot");
  foot.append(gjuBadge(p), rowMenu(p));
  const heading = el("h3");
  heading.append(titleLink(p));
  card.append(top, heading, tags(p, true), facts, foot);
  return card;
}

function createContainer() {
  if (state.view === "cards") { const grid = el("div", "cards"); return { root: grid, body: grid }; }
  const card = el("div", "table-card");
  const scroll = el("div", "table-scroll");
  const table = el("table");
  table.setAttribute("aria-label", "Internships");
  const head = el("tr");
  const th = (text, className) => { const h = el("th", className); h.setAttribute("scope", "col"); if (text) h.textContent = text; return h; };
  const first = th("", "c-check");
  first.append(el("span", "sr", "Tick"));
  const last = th("", "c-act");
  last.append(el("span", "sr", "Actions"));
  head.append(first, th("Position"), th("Company"), th("City"), th("Duration"), th("Pay / month"), th("Languages"), th("GJU rules"), th("Found"), last);
  const thead = el("thead");
  thead.append(head);
  const body = el("tbody");
  table.append(thead, body);
  scroll.append(table);
  card.append(scroll);
  return { root: card, body };
}

function emptyState(kind) {
  const box = el("div", "empty");
  const badge = el("i");
  badge.className = `fa-solid ${kind === "nodata" ? "fa-seedling" : "fa-magnifying-glass"}`;
  badge.setAttribute("aria-hidden", "true");
  box.append(badge);
  if (kind === "nodata") {
    box.append(el("h3", null, "No internships yet"), el("p", null, "The first daily update has not been published. Check back soon."));
  } else {
    box.append(el("h3", null, "No internships match"), el("p", null, "Try removing a filter, or widening the pay, duration or date range."));
    const clear = el("button", "btn btn-primary");
    clear.type = "button";
    clear.append(icon("fa-filter-circle-xmark"), document.createTextNode("Clear all filters"));
    clear.addEventListener("click", clearAll);
    box.append(clear);
  }
  return box;
}

function renderList(more) {
  const host = $("list");
  if (!more) {
    state.shown = 0;
    state.body = null;
    host.replaceChildren();
    if (!state.filtered.length) host.append(emptyState(state.all.length ? "nomatch" : "nodata"));
  }
  if (state.filtered.length) {
    if (!state.body) { const c = createContainer(); host.replaceChildren(c.root); state.body = c.body; }
    const next = state.filtered.slice(state.shown, state.shown + PAGE);
    next.forEach((p, i) => state.body.append(state.view === "cards" ? cardEl(p, i) : rowEl(p, i)));
    state.shown += next.length;
  }
  $("more").hidden = state.shown >= state.filtered.length;
  $("more").lastChild.textContent = ` Show more (${state.filtered.length - state.shown} left)`;
  syncPicks();
}

// ---------------------------------------------------------------- ticking rows

function setPicked(id, on) {
  if (on) state.selected.add(id); else state.selected.delete(id);
  document.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach((node) => {
    node.classList.toggle("picked", on);
    const box = node.querySelector("input.check");
    if (box) box.checked = on;
  });
  syncPicks();
}

function syncPicks() {
  const n = state.selected.size;
  const inView = state.filtered.filter((p) => state.selected.has(p.id)).length;
  const all = $("pick-all");
  all.checked = state.filtered.length > 0 && inView === state.filtered.length;
  all.indeterminate = inView > 0 && inView < state.filtered.length;
  $("ticked").hidden = n === 0;
  $("ticked").textContent = String(n);
}

// ---------------------------------------------------------------- downloads

let xlsxLoading = null;
const loadXlsx = () => (window.XLSX ? Promise.resolve() : (xlsxLoading ||= new Promise((resolve, reject) => {
  const s = document.createElement("script");
  s.src = "vendor/xlsx.full.min.js";
  s.onload = resolve;
  s.onerror = () => { xlsxLoading = null; reject(new Error("The Excel library did not load.")); };
  document.head.append(s);
})));

async function download(postings, name) {
  if (!postings.length) { await notice("info", "Nothing to download", "There are no internships for that choice yet."); return; }
  try { await loadXlsx(); } catch { await notice("error", "Excel could not be prepared", "The spreadsheet library did not load. Check your connection and try again."); return; }
  const sheet = window.XLSX.utils.json_to_sheet(L.toRows(postings, state.majorNames));
  sheet["!cols"] = [48, 28, 18, 12, 16, 36, 14, 14, 10, 10, 30, 16, 14, 12, 14, 12, 12, 18, 60].map((wch) => ({ wch }));
  const book = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(book, sheet, "Internships");
  window.XLSX.writeFile(book, name);
  toast("success", `Downloaded ${plural(postings.length, "internship", "internships")}`);
}

async function downloadDay() {
  const days = state.index.days || [];
  if (!days.length) { await notice("info", "No days yet", "Day files appear after the first daily update."); return; }
  const day = await pickDay(days);
  if (!day) return;
  try { await download(L.sortPostings(await get(`data/days/${day}.json`), "new"), `gju-internships-${day}.xlsx`); }
  catch { await notice("error", "That day could not be loaded", "Try again in a moment."); }
}

function openDownloadMenu() {
  showMenu($("dl-btn"), [
    { icon: "fa-filter", label: "What I see now", small: state.filtered.length, onClick: () => download(state.filtered, "gju-internships-filtered.xlsx") },
    { icon: "fa-square-check", label: "Ticked", small: state.selected.size, disabled: !state.selected.size, onClick: () => download(L.sortPostings(state.all.filter((p) => state.selected.has(p.id)), "new"), "gju-internships-ticked.xlsx") },
    { icon: "fa-database", label: "Everything", small: state.all.length, onClick: () => download(L.sortPostings(state.all, "new"), "gju-internships-all.xlsx") },
    "sep",
    { icon: "fa-calendar-day", label: "One day…", onClick: downloadDay },
  ]);
}

// ---------------------------------------------------------------- row actions

function details(p) { return showDetails(p, { rules: state.rules, majorNames: state.majorNames, copyLink }); }

async function copyLink(href) {
  const ok = await copyText(href);
  toast(ok ? "success" : "error", ok ? "Link copied" : "Could not copy. Open the advert and copy the address there.");
}

function wireList() {
  const list = $("list");
  list.addEventListener("change", (e) => {
    if (!e.target.classList.contains("check")) return;
    setPicked(e.target.closest("[data-id]").dataset.id, e.target.checked);
  });
  list.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-action]");
    if (!button) return;
    const p = state.byId.get(button.closest("[data-id]").dataset.id);
    if (button.dataset.action === "details") { details(p); return; }
    const href = L.safeUrl(p.url);
    const picked = state.selected.has(p.id);
    showMenu(button, [
      { icon: "fa-circle-info", label: "Details", onClick: () => details(p) },
      ...(href ? [{ icon: "fa-arrow-up-right-from-square", label: "Open advert", href }, { icon: "fa-link", label: "Copy link", onClick: () => copyLink(href) }] : []),
      "sep",
      { icon: picked ? "fa-square-minus" : "fa-square-check", label: picked ? "Untick" : "Tick for download", onClick: () => setPicked(p.id, !picked) },
    ]);
  });
  $("more").addEventListener("click", () => renderList(true));
  $("pick-all").addEventListener("change", (e) => {
    const on = e.target.checked;
    state.filtered.forEach((p) => (on ? state.selected.add(p.id) : state.selected.delete(p.id)));
    document.querySelectorAll("#list [data-id]").forEach((node) => {
      const picked = state.selected.has(node.dataset.id);
      node.classList.toggle("picked", picked);
      node.querySelector("input.check").checked = picked;
    });
    syncPicks();
  });
  $("dl-btn").addEventListener("click", () => ($("menu").hidden ? openDownloadMenu() : closeMenu(true)));
}

function setView(view, remember) {
  state.view = view;
  $("view-table").setAttribute("aria-pressed", String(view === "table"));
  $("view-cards").setAttribute("aria-pressed", String(view === "cards"));
  if (remember) { try { localStorage.setItem(VIEW_KEY, view); } catch { /* not remembered in a private window */ } }
  renderList(false);
}

// ---------------------------------------------------------------- charts and the hero

const GJU_KEYS = ["meets", "check", "fails"];

function pickFromChart(chart, value) {
  const f = state.f;
  if (chart === "majors") change("majors", f.majors.includes(value) ? f.majors.filter((x) => x !== value) : [...f.majors, value]);
  else if (chart === "skills") change("skills", f.skills.includes(value) ? f.skills.filter((x) => x !== value) : [...f.skills, value]);
  else if (chart === "gju") change("gju", f.gju === value ? "" : value);
  else if (chart === "areas") {
    // an area selects all its majors; when they are all selected already, it clears them
    const ids = state.areaMajors[value] || [];
    const chosen = ids.length > 0 && ids.every((id) => f.majors.includes(id));
    change("majors", chosen ? f.majors.filter((id) => !ids.includes(id)) : [...new Set([...f.majors, ...ids])]);
  }
}

/** The legend of the areas chart: a button per area with its count, pressed when all of the area's majors are chosen. */
function drawAreas(data) {
  const legend = $("area-legend");
  legend.replaceChildren();
  for (const { key, count } of data.areas) {
    const ids = state.areaMajors[key] || [];
    const li = el("li");
    const b = el("button");
    b.type = "button";
    b.title = `${key}: ${plural(count, "internship", "internships")}`;
    b.setAttribute("aria-pressed", String(ids.length > 0 && ids.every((id) => state.f.majors.includes(id))));
    const dot = el("span", "dot");
    dot.style.background = areaColor(key, state.areaOrder);
    b.append(dot, el("span", "name", key), el("b", null, String(count)));
    b.addEventListener("click", () => pickFromChart("areas", key));
    li.append(b);
    legend.append(li);
  }
}

function drawDonut(data) {
  const total = data.gju.meets + data.gju.check + data.gju.fails;
  $("gju-center").replaceChildren(el("strong", null, String(data.gju.meets)), el("span", null, "meet the rules"));
  const legend = $("gju-legend");
  legend.replaceChildren();
  const colors = { meets: "#22c55e", check: "#f59e0b", fails: "#ef4444" };
  for (const key of GJU_KEYS) {
    const li = el("li");
    const b = el("button");
    b.type = "button";
    b.setAttribute("aria-pressed", String(state.f.gju === key));
    const dot = el("span", "dot");
    dot.style.background = colors[key];
    const pct = total ? ` · ${Math.round((data.gju[key] / total) * 100)}%` : "";
    b.append(dot, el("span", null, L.GJU_LABELS[key] + pct), el("b", null, String(data.gju[key])));
    b.addEventListener("click", () => pickFromChart("gju", key));
    li.append(b);
    legend.append(li);
  }
}

let chartTimer;
function scheduleCharts() { clearTimeout(chartTimer); chartTimer = setTimeout(drawCharts, 160); }

async function drawCharts() {
  const data = L.chartData(state.all, state.f, { end: (state.index.generatedAt || "").slice(0, 10) || undefined, days: 14, areaOf: state.areaOf });
  drawDonut(data);
  drawAreas(data);
  if (!charts) return;
  await charts.update(data);
  $("insights").dataset.drawn = String(Number($("insights").dataset.drawn || 0) + 1);
}

function heroStats() {
  const end = Date.parse((state.index.generatedAt || "").slice(0, 10) || new Date().toISOString().slice(0, 10));
  const fresh = state.all.filter((p) => (end - Date.parse(p.firstSeen)) / 86400000 <= 6).length;
  const values = {
    total: state.all.length,
    meets: state.all.filter((p) => p.gju && p.gju.overall === "meets").length,
    fresh,
    companies: new Set(state.all.map((p) => L.norm(p.company)).filter(Boolean)).size,
  };
  document.querySelectorAll("[data-stat]").forEach((node) => countUp(node, values[node.dataset.stat] || 0));
}

// ---------------------------------------------------------------- one refresh for every change

function refresh() {
  const { all, f } = state;
  state.filtered = L.sortPostings(L.applyFilters(all, f), state.sort);
  renderList(false);
  updateFacets();
  renderChips();
  const n = L.activeCount(f);
  $("active-count").hidden = n === 0;
  $("active-count").textContent = String(n);
  const count = $("result-count");
  count.replaceChildren(el("strong", null, String(state.filtered.length)), document.createTextNode(` of ${plural(all.length, "internship", "internships")}`));
  scheduleCharts();
}

// ---------------------------------------------------------------- start

async function start() {
  theme.init();
  revealOnScroll();
  const topbar = $("topbar");
  const scrolled = () => topbar.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", scrolled, { passive: true });
  scrolled();
  showSkeleton();

  let data;
  try { data = await load(); } catch { data = { index: { days: [], generatedAt: "" }, postings: [], majors: await get("board/majors.json").catch(() => ({ areas: [], majors: [] })), skills: { groups: [] }, rules: DEFAULT_RULES }; }
  state.all = data.postings;
  state.byId = new Map(data.postings.map((p) => [p.id, p]));
  state.index = data.index;
  state.rules = { ...DEFAULT_RULES, ...data.rules };
  state.areaOrder = data.majors.areas.slice();
  data.majors.majors.forEach((m) => {
    state.majorNames[m.id] = m.name;
    state.areaOf[m.id] = m.area;
    (state.areaMajors[m.area] = state.areaMajors[m.area] || []).push(m.id);
  });

  if (data.index.notice) { const n = $("notice"); n.replaceChildren(icon("fa-circle-info"), document.createTextNode(` ${data.index.notice}`)); n.hidden = false; }
  buildCombos({ majors: data.majors, skills: data.skills });
  wireFields();
  wireList();
  $("open-help").addEventListener("click", () => showHelp(state.rules));
  $("open-help-2").addEventListener("click", () => showHelp(state.rules));
  $("view-table").addEventListener("click", () => setView("table", true));
  $("view-cards").addEventListener("click", () => setView("cards", true));
  let stored = null;
  try { stored = localStorage.getItem(VIEW_KEY); } catch { /* no storage */ }
  const narrow = window.matchMedia("(max-width: 900px)").matches;
  setViewQuiet(stored === "cards" || stored === "table" ? stored : narrow ? "cards" : "table");
  if (window.matchMedia("(max-width: 700px)").matches) $("filter-panel").open = false;

  heroStats();
  refresh();
  theme.onChange(() => { if (charts) charts.redraw(); });

  // the charts load after the page is usable; without them everything else still works
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 60)))(async () => {
    charts = await createCharts({ majorNames: state.majorNames, areaOrder: state.areaOrder, onPick: pickFromChart });
    if (charts) drawCharts();
  });
}

function setViewQuiet(view) {
  state.view = view;
  $("view-table").setAttribute("aria-pressed", String(view === "table"));
  $("view-cards").setAttribute("aria-pressed", String(view === "cards"));
}

start();
