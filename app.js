/* The board page: load the data files, filter in the browser, download Excel files built in the browser. */
(function () {
  "use strict";
  var L = window.BoardLogic;
  var PAGE = 100;
  var $ = function (id) { return document.getElementById(id); };
  var state = { all: [], shown: 0, filtered: [], index: null, majorNames: {} };

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

  function filters() {
    return {
      q: $("q").value, major: $("major").value, type: $("type").value, country: $("country").value,
      german: $("german").value, english: $("english").value, skills: $("skills").value.split(","),
      gju: $("gju").value, from: $("from").value, to: $("to").value,
    };
  }

  function badge(p) {
    var overall = (p.gju && p.gju.overall) || "check";
    var text = { meets: "Meets", check: "Check", fails: "Breaks a rule" }[overall];
    var node = el("span", text, "badge " + overall);
    var g = p.gju || {};
    node.title = "20 weeks: " + (g.weeks || "unknown") + " · 861 EUR: " + (g.pay || "unknown") + " · country: " + (g.country || "unknown");
    return node;
  }

  function row(p) {
    var tr = document.createElement("tr");
    var title = el("td");
    var href = L.safeUrl(p.url);
    if (href) {
      var a = el("a", p.title);
      a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer";
      title.append(a);
    } else title.textContent = p.title;
    var detail = [p.type, (p.majors || []).map(function (id) { return state.majorNames[id] || id; }).join(", ")].filter(Boolean).join(" · ");
    if (detail) title.append(el("span", detail, "sub"));
    var cityCell = el("td", p.city || "—");
    if (p.country && p.country !== "unknown") cityCell.append(el("span", p.country, "sub"));
    var notStated = function (value) { return el("td", value, value === "not stated" || value === "unknown" ? "dim" : ""); };
    tr.append(
      title, el("td", p.company || "—"), cityCell, notStated(L.formatWeeks(p.weeks)), notStated(L.formatPay(p.pay)),
      notStated(p.germanLevel), notStated(p.englishLevel), (function () { var td = el("td"); td.append(badge(p)); return td; })(),
      el("td", p.firstSeen),
    );
    return tr;
  }

  function render(more) {
    var body = $("rows");
    if (!more) { state.filtered = L.sortPostings(L.applyFilters(state.all, filters()), $("sort").value); state.shown = 0; body.replaceChildren(); }
    var next = state.filtered.slice(state.shown, state.shown + PAGE);
    next.forEach(function (p) { body.append(row(p)); });
    state.shown += next.length;
    $("count").textContent = state.filtered.length + " of " + state.all.length + " postings";
    $("dl-count").textContent = state.filtered.length;
    $("more").hidden = state.shown >= state.filtered.length;
    if (!state.filtered.length) {
      var td = el("td", "No postings match these filters. Try clearing a filter or widening the dates.", "empty");
      td.colSpan = 9;
      var tr = document.createElement("tr"); tr.append(td); body.replaceChildren(tr);
    }
  }

  function download(postings, name) {
    if (!postings.length) { $("status").textContent = "Nothing to download for that choice."; return; }
    var sheet = XLSX.utils.json_to_sheet(L.toRows(postings, state.majorNames));
    sheet["!cols"] = [{ wch: 48 }, { wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 36 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 60 }];
    var book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Postings");
    XLSX.writeFile(book, name);
  }

  function init(index, postings, majors) {
    state.index = index;
    state.all = postings;
    majors.forEach(function (m) { state.majorNames[m.id] = m.name; });
    fill($("major"), "Any major", majors.map(function (m) { return { label: m.name, value: m.id }; }));
    fill($("type"), "Any type", unique(postings.map(function (p) { return p.type; })));
    fill($("country"), "Any country", unique(postings.map(function (p) { return p.country; })));
    var levels = L.LEVELS.filter(function (l) { return l !== "none"; });
    fill($("german"), "Any level", levels);
    fill($("english"), "Any level", levels);
    var list = $("skill-list");
    unique(postings.flatMap(function (p) { return p.skills || []; })).forEach(function (s) { list.append(new Option(s)); });
    fill($("day"), "Choose a day", (index.days || []).map(function (d) { return { label: d.date + " (" + d.count + ")", value: d.date }; }));

    var run = index.lastRun || {};
    $("status").textContent = "Updated " + index.generatedAt + " · " + index.total + " active postings" +
      (run.areas && run.areas.length ? " · last run covered: " + run.areas.join(", ") : "") +
      (run.complete === false ? " · the last run was cut short, so some areas may be a few days behind" : "") + ".";

    ["q", "major", "type", "country", "german", "english", "skills", "gju", "from", "to", "sort"].forEach(function (id) {
      $(id).addEventListener(id === "q" || id === "skills" ? "input" : "change", function () { render(false); });
    });
    $("more").addEventListener("click", function () { render(true); });
    $("reset").addEventListener("click", function () {
      ["q", "skills", "from", "to"].forEach(function (id) { $(id).value = ""; });
      ["major", "type", "country", "german", "english", "gju"].forEach(function (id) { $(id).value = ""; });
      $("sort").value = "new";
      render(false);
    });
    $("dl-filter").addEventListener("click", function () { download(state.filtered, "gju-board-filtered.xlsx"); });
    $("dl-all").addEventListener("click", function () { download(L.sortPostings(state.all, "new"), "gju-board-all.xlsx"); });
    $("dl-day").addEventListener("click", function () {
      var day = $("day").value;
      if (!day) { $("status").textContent = "Choose a day first."; return; }
      getJson("data/days/" + day + ".json").then(function (list) { download(L.sortPostings(list, "new"), "gju-board-" + day + ".xlsx"); })
        .catch(function () { $("status").textContent = "That day's file could not be loaded."; });
    });
    render(false);
  }

  Promise.all([getJson("data/index.json"), getJson("data/postings.json"), getJson("board/majors.json")])
    .then(function (r) { init(r[0], r[1], r[2].majors); })
    .catch(function () { $("status").textContent = "No data yet. The first daily update has not been published."; });
})();
