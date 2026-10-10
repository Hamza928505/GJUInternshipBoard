/* Filtering, sorting and export rows for the board. Plain functions, no DOM, so they run in the page and in Node tests. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BoardLogic = factory();
})(typeof self !== "undefined" ? self : this, function () {
  var LEVELS = ["none", "A1", "A2", "B1", "B2", "C1", "C2"];
  var rank = function (level) { return LEVELS.indexOf(level); };

  /** A level filter lets through postings whose requirement the student meets, plus those that state none. */
  function levelOk(required, mine) {
    if (!mine) return true;
    if (!required || required === "unknown" || required === "none") return true;
    return rank(required) <= rank(mine);
  }

  function formatWeeks(w) {
    if (!w) return "not stated";
    if (w.min != null && w.max != null) return w.min === w.max ? w.min + " weeks" : w.min + "–" + w.max + " weeks";
    if (w.min != null) return w.min + "+ weeks";
    return "up to " + w.max + " weeks";
  }

  function formatPay(p) {
    if (!p) return "not stated";
    if (p.max === 0) return "unpaid";
    return (p.min === p.max ? p.min : p.min + "–" + p.max) + " EUR";
  }

  /** Only http(s) links are ever used as a link target; anything else in scraped data is dropped. */
  function safeUrl(url) {
    try { var u = new URL(url); return u.protocol === "https:" || u.protocol === "http:" ? u.href : ""; } catch (e) { return ""; }
  }

  function applyFilters(postings, f) {
    var q = (f.q || "").trim().toLowerCase();
    var skills = (f.skills || []).map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    var num = function (v) { return v === "" || v == null || !isFinite(Number(v)) ? null : Number(v); };
    var minPay = num(f.minPay), maxPay = num(f.maxPay);
    return postings.filter(function (p) {
      if (q && !(p.title + " " + p.company + " " + p.city).toLowerCase().includes(q)) return false;
      if (f.major && !(p.majors || []).includes(f.major)) return false;
      if (f.type && p.type !== f.type) return false;
      if (f.country && p.country !== f.country) return false;
      if (!levelOk(p.germanLevel, f.german) || !levelOk(p.englishLevel, f.english)) return false;
      if (skills.length) {
        var have = (p.skills || []).map(function (s) { return s.toLowerCase(); });
        if (!skills.every(function (s) { return have.includes(s); })) return false;
      }
      // A pay range only keeps postings that state a pay and whose stated range overlaps it.
      if (minPay != null || maxPay != null) {
        if (!p.pay) return false;
        if (minPay != null && p.pay.max < minPay) return false;
        if (maxPay != null && p.pay.min > maxPay) return false;
      }
      if (f.gju === "meets" && !(p.gju && p.gju.overall === "meets")) return false;
      if (f.gju === "hide-fails" && p.gju && p.gju.overall === "fails") return false;
      if (f.from && p.firstSeen < f.from) return false;
      if (f.to && p.firstSeen > f.to) return false;
      return true;
    });
  }

  function sortPostings(list, key) {
    var weeks = function (p) { return p.weeks ? (p.weeks.max != null ? p.weeks.max : p.weeks.min) : -1; };
    var pay = function (p) { return p.pay ? p.pay.max : -1; };
    var by = {
      new: function (a, b) { return b.firstSeen.localeCompare(a.firstSeen) || (b.datePosted || "").localeCompare(a.datePosted || ""); },
      company: function (a, b) { return (a.company || "~").localeCompare(b.company || "~"); },
      weeks: function (a, b) { return weeks(b) - weeks(a); },
      pay: function (a, b) { return pay(b) - pay(a); },
    };
    return list.slice().sort(by[key] || by.new);
  }

  var RULE_TEXT = { yes: "yes", no: "no", unknown: "not stated", approved: "approved", "approval-needed": "needs approval" };

  /** One spreadsheet row per posting. */
  function toRows(postings, majorNames) {
    return postings.map(function (p) {
      var g = p.gju || {};
      return {
        "Position": p.title, "Company": p.company, "City": p.city, "Country": p.country, "Type": p.type,
        "Majors": (p.majors || []).map(function (id) { return (majorNames && majorNames[id]) || id; }).join("; "),
        "Duration": formatWeeks(p.weeks), "Pay per month": formatPay(p.pay),
        "German level": p.germanLevel, "English level": p.englishLevel, "Skills": (p.skills || []).join(", "),
        "GJU check": g.overall || "check", "20 weeks": RULE_TEXT[g.weeks] || "", "861 EUR": RULE_TEXT[g.pay] || "", "Country rule": RULE_TEXT[g.country] || "",
        "Date posted": p.datePosted, "First seen": p.firstSeen, "Source": p.source, "Link": safeUrl(p.url),
      };
    });
  }

  return { LEVELS: LEVELS, rank: rank, levelOk: levelOk, formatWeeks: formatWeeks, formatPay: formatPay, safeUrl: safeUrl, applyFilters: applyFilters, sortPostings: sortPostings, toRows: toRows };
});
