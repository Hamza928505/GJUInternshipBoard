/* The guide page: each section folds under its heading, the rule numbers come from data/rules.json (the same file the
 * board checks against), and the year's timeline is drawn with OpenCharts. Without this script the page still reads
 * straight through: every section is open and the numbers in the text are the ones it was written with. */
import { theme } from "./ui.js";

theme.init();

// ---------------------------------------------------------------- sections that fold
for (const section of document.querySelectorAll(".guide-body > section")) {
  const heading = section.querySelector(":scope > h2");
  if (!heading) continue;
  const details = document.createElement("details");
  details.className = "guide-fold";
  const summary = document.createElement("summary");
  summary.append(...heading.childNodes);
  summary.id = heading.id;
  details.append(summary, ...[...section.childNodes].filter((node) => node !== heading));
  section.replaceChildren(details);
}

const folds = () => [...document.querySelectorAll(".guide-fold")];

function openFor(hash) {
  if (!hash) return;
  const target = document.getElementById(decodeURIComponent(hash.slice(1)));
  const fold = target?.closest(".guide-fold") || target?.querySelector(".guide-fold");
  if (fold) { fold.open = true; target.scrollIntoView(); }
}

if (folds()[0]) folds()[0].open = true; // the first section starts open, so the page is not a wall of closed headings
openFor(location.hash);
addEventListener("hashchange", () => openFor(location.hash));
document.querySelectorAll('.toc a[href^="#"]').forEach((a) => a.addEventListener("click", () => openFor(a.getAttribute("href"))));

const bar = document.createElement("p");
bar.className = "guide-fold-bar";
for (const [mode, label] of [["open", "Open all"], ["close", "Close all"]]) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn";
  button.textContent = label;
  button.addEventListener("click", () => folds().forEach((fold) => { fold.open = mode === "open"; }));
  bar.append(button, " ");
}
document.querySelector(".guide-body")?.prepend(bar);

// ---------------------------------------------------------------- the numbers and the timeline
const rules = await fetch("data/rules.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
if (rules) {
  document.querySelectorAll("[data-rule]").forEach((node) => { if (rules[node.dataset.rule] != null) node.textContent = rules[node.dataset.rule]; });
}

const chart = document.getElementById("internship-span");
if (chart && rules?.minWeeks != null && rules.maxRecognisedMonths != null && rules.handInMonths != null) {
  const label = `The internship needs ${rules.minWeeks} weeks at minimum and is recognised up to ${rules.maxRecognisedMonths} months. The report is handed in within ${rules.handInMonths} months of the end.`;
  try {
    const { render, newSpec, getChart } = await import("../vendor/opencharts/js/studio/oc.js");
    const weeks = (months) => Math.round((months * 52) / 12);
    const end = weeks(rules.maxRecognisedMonths);
    const base = newSpec(getChart("timeline")).opts;
    const drawn = render(chart, {
      chart: "timeline",
      spec: {
        events: [
          { label: `Minimum: ${rules.minWeeks} weeks`, start: 0, end: rules.minWeeks, lane: 0, color: "#FFB844" },
          { label: `Recognised up to ${rules.maxRecognisedMonths} months`, start: rules.minWeeks, end, lane: 0, color: "#1F8BCC" },
          { label: `Report within ${rules.handInMonths} months`, start: end, end: end + weeks(rules.handInMonths), lane: 1, color: "#175B92" },
        ],
        axisLabel: "Week",
        opts: { ...base, min: 0, max: end + weeks(rules.handInMonths) + 2, tickStep: 4, showLabels: true },
      },
      height: 180,
    });
    await drawn.whenReady;
    chart.setAttribute("aria-label", label); // after the drawing: OpenCharts names its chart "Timeline chart, 3 rows" and would replace this
  } catch (error) { console.warn("The timeline could not be drawn:", error); }
}
