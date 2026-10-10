/* The board page: load the data files, filter in the browser, tick rows, download Excel files built in the browser. */
(function () {
  "use strict";
  var L = window.BoardLogic;
  var PAGE = 100;
  var $ = function (id) { return document.getElementById(id); };
  var state = { all: [], byId: {}, filtered: [], shown: 0, selected: new Set(), majorNames: {}, menuFor: null, menuButton: null };
  var DOTS = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>';

  function el(tag, text, className) {
    var node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function fill(select, first, values) {
    select.replaceChildren(new Option(first, ""));
    values.forEach(function (v) { select.append(new Option(v.label || v, v.value || v)); });
  }
  function unique(list) { return Array.from(new Set(list.filter(Boolean))).sort(); }
  function getJson(path) {
    return fetch(path, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(path + " " + r.status);
      return r.json();
    });
  }
  var toastTimer;
  function toast(message) {
    var node = $("toast");
    node.textContent = message; node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.hidden = true; }, 2600);
  }

  function filters() {
    return {
      q: $("q").value, major: $("major").value, type: $("type").value, country: $("country").value,
      german: $("german").value, english: $("english").value, skills: $("skills").value.split(","),
      gju: $("gju").value, from: $("from").value, to: $("to").value, minPay: $("min-pay").value, maxPay: $("max-pay").value,
    };
  }

  function badge(p) {
    var overall = (p.gju && p.gju.overall) || "check";
    var node = el("span", { meets: "Meets", check: "Check", fails: "Breaks a rule" }[overall], "badge " + overall);
    var g = p.gju || {};
    node.title = "20 weeks: " + (g.weeks || "unknown") + " · 861 EUR: " + (g.pay || "unknown") + " · country: " + (g.country || "unknown");
    return node;
  }

  function row(p) {
    var tr = document.createElement("tr");
    tr.dataset.id = p.id;
    if (state.selected.has(p.id)) tr.className = "picked";

    var pick = el("td", null, "check");
    var box = document.createElement("input");
    box.type = "checkbox"; box.checked = state.selected.has(p.id); box.setAttribute("aria-label", "Tick " + p.title);
    pick.append(box);

    var title = el("td");
    var href = L.safeUrl(p.url);
    if (href) {
      var a = el("a", p.title);
      a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer";
      title.append(a);
    } else title.textContent = p.title;
    var detail = [p.type, (p.majors || []).map(function (id) { return state.majorNames[id] || id; }).join(", ")].filter(Boolean).join(" · ");
    if (detail) title.append(el("span", detail, "sub"));

    var city = el("td", p.city || "—");
    if (p.country && p.country !== "unknown") city.append(el("span", p.country, "sub"));
    var plain = function (value) { return el("td", value, value === "not stated" || value === "unknown" ? "dim" : ""); };
    var rules = el("td"); rules.append(badge(p));

    var act = el("td", null, "act");
    var more = document.createElement("button");
    more.type = "button"; more.className = "btn ghost icon"; more.innerHTML = DOTS;
    more.setAttribute("aria-label", "Actions for " + p.title); more.setAttribute("aria-haspopup", "menu"); more.setAttribute("aria-expanded", "false");
    act.append(more);

    tr.append(pick, title, el("td", p.company || "—"), city, plain(L.formatWeeks(p.weeks)), plain(L.formatPay(p.pay)), plain(p.germanLevel), plain(p.englishLevel), rules, el("td", p.firstSeen, "nowrap"), act);
    return tr;
  }

  function syncFooter() {
    var n = state.selected.size;
    $("count").textContent = state.filtered.length + " of " + state.all.length + " postings";
    $("sel-count").textContent = n ? n + " ticked" : "";
    $("dl-count").textContent = state.filtered.length;
    $("dl-sel-count").textContent = n;
    $("dl-selected").disabled = !n;
    var all = $("select-all");
    var inView = state.filtered.filter(function (p) { return state.selected.has(p.id); }).length;
    all.checked = state.filtered.length > 0 && inView === state.filtered.length;
    all.indeterminate = inView > 0 && inView < state.filtered.length;
  }

  function render(more) {
    var body = $("rows");
    if (!more) { state.filtered = L.sortPostings(L.applyFilters(state.all, filters()), $("sort").value); state.shown = 0; body.replaceChildren(); }
    var next = state.filtered.slice(state.shown, state.shown + PAGE);
    next.forEach(function (p) { body.append(row(p)); });
    state.shown += next.length;
    $("more").hidden = state.shown >= state.filtered.length;
    if (!state.filtered.length) {
      var td = el("td", "No postings match these filters. Try clearing a filter or widening the dates.", "empty");
      td.colSpan = 11;
      var tr = document.createElement("tr"); tr.append(td); body.replaceChildren(tr);
    }
    syncFooter();
  }

  function download(postings, name) {
    if (!postings.length) { toast("Nothing to download for that choice."); return; }
    var sheet = XLSX.utils.json_to_sheet(L.toRows(postings, state.majorNames));
    sheet["!cols"] = [{ wch: 48 }, { wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 36 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 60 }];
    var book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Postings");
    XLSX.writeFile(book, name);
  }

  // ---- the ⋮ row menu: one shared menu, placed under the button that opened it
  function closeMenu(returnFocus) {
    var menu = $("menu");
    if (menu.hidden) return;
    menu.hidden = true;
    if (state.menuButton) { state.menuButton.setAttribute("aria-expanded", "false"); if (returnFocus) state.menuButton.focus(); }
    state.menuFor = null; state.menuButton = null;
  }
  function openMenu(button, p) {
    var menu = $("menu");
    closeMenu(false);
    var href = L.safeUrl(p.url);
    $("menu-open").hidden = !href;
    if (href) $("menu-open").href = href;
    $("menu-copy").hidden = !href;
    state.menuFor = p; state.menuButton = button;
    button.setAttribute("aria-expanded", "true");
    menu.hidden = false;
    var r = button.getBoundingClientRect();
    menu.style.top = Math.min(r.bottom + 4, window.innerHeight - menu.offsetHeight - 8) + "px";
    menu.style.left = Math.max(8, Math.min(r.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 8)) + "px";
    if (href) $("menu-open").focus();
  }

  function init(index, postings, majors) {
    state.all = postings;
    postings.forEach(function (p) { state.byId[p.id] = p; });
    majors.forEach(function (m) { state.majorNames[m.id] = m.name; });
    fill($("major"), "All majors", majors.map(function (m) { return { label: m.name, value: m.id }; }));
    fill($("type"), "All position types", unique(postings.map(function (p) { return p.type; })));
    fill($("country"), "All countries", unique(postings.map(function (p) { return p.country; })));
    var levels = L.LEVELS.filter(function (l) { return l !== "none"; });
    fill($("german"), "My German: any level", levels.map(function (l) { return { label: "My German: " + l, value: l }; }));
    fill($("english"), "My English: any level", levels.map(function (l) { return { label: "My English: " + l, value: l }; }));
    var list = $("skill-list");
    unique(postings.flatMap(function (p) { return p.skills || []; })).forEach(function (s) { list.append(new Option(s)); });
    fill($("day"), "Choose a day", (index.days || []).map(function (d) { return { label: d.date + " (" + d.count + ")", value: d.date }; }));

    var run = index.lastRun || {};
    $("status").textContent = "Updated " + index.generatedAt + " · " + index.total + " active postings" +
      (run.areas && run.areas.length ? " · last run covered: " + run.areas.join(", ") : "") +
      (run.complete === false ? " · the last run was cut short, so some areas may be a few days behind" : "") + ".";

    ["q", "major", "type", "country", "german", "english", "skills", "gju", "from", "to", "sort", "min-pay", "max-pay"].forEach(function (id) {
      $(id).addEventListener(id === "q" || id === "skills" || id === "min-pay" || id === "max-pay" ? "input" : "change", function () { render(false); });
    });
    $("more").addEventListener("click", function () { render(true); });
    $("reset").addEventListener("click", function () {
      ["q", "skills", "from", "to", "min-pay", "max-pay", "major", "type", "country", "german", "english", "gju"].forEach(function (id) { $(id).value = ""; });
      $("sort").value = "new";
      render(false);
    });

    // ticking rows: one row, or every row currently shown
    $("rows").addEventListener("change", function (event) {
      var box = event.target;
      if (box.type !== "checkbox") return;
      var tr = box.closest("tr");
      if (box.checked) state.selected.add(tr.dataset.id); else state.selected.delete(tr.dataset.id);
      tr.classList.toggle("picked", box.checked);
      syncFooter();
    });
    $("select-all").addEventListener("change", function (event) {
      state.filtered.forEach(function (p) { if (event.target.checked) state.selected.add(p.id); else state.selected.delete(p.id); });
      document.querySelectorAll("#rows tr[data-id]").forEach(function (tr) {
        var on = state.selected.has(tr.dataset.id);
        tr.classList.toggle("picked", on); tr.querySelector("input[type=checkbox]").checked = on;
      });
      syncFooter();
    });

    $("rows").addEventListener("click", function (event) {
      var button = event.target.closest("button.icon");
      if (!button) return;
      var p = state.byId[button.closest("tr").dataset.id];
      if (state.menuButton === button) closeMenu(false); else openMenu(button, p);
    });
    $("menu-copy").addEventListener("click", function () {
      var href = L.safeUrl(state.menuFor && state.menuFor.url);
      closeMenu(true);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(href).then(function () { toast("Link copied."); }, function () { toast("Could not copy. Use Open advert and copy the address from there."); });
      } else toast("Could not copy. Use Open advert and copy the address from there.");
    });
    $("menu-open").addEventListener("click", function () { closeMenu(false); });
    document.addEventListener("click", function (event) {
      if (!event.target.closest("#menu") && !event.target.closest("button.icon")) closeMenu(false);
    });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeMenu(true); });
    window.addEventListener("resize", function () { closeMenu(false); });
    document.addEventListener("scroll", function () { closeMenu(false); }, true);

    $("dl-filter").addEventListener("click", function () { download(state.filtered, "gju-board-filtered.xlsx"); });
    $("dl-selected").addEventListener("click", function () {
      download(L.sortPostings(state.all.filter(function (p) { return state.selected.has(p.id); }), "new"), "gju-board-ticked.xlsx");
    });
    $("dl-all").addEventListener("click", function () { download(L.sortPostings(state.all, "new"), "gju-board-all.xlsx"); });
    $("dl-day").addEventListener("click", function () {
      var day = $("day").value;
      if (!day) { toast("Choose a day first."); return; }
      getJson("data/days/" + day + ".json").then(function (list) { download(L.sortPostings(list, "new"), "gju-board-" + day + ".xlsx"); })
        .catch(function () { toast("That day's file could not be loaded."); });
    });
    render(false);
  }

  Promise.all([getJson("data/index.json"), getJson("data/postings.json"), getJson("board/majors.json")])
    .then(function (r) { init(r[0], r[1], r[2].majors); })
    .catch(function () { $("status").textContent = "No data yet. The first daily update has not been published."; });
})();
