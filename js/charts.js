/* The six charts, drawn with OpenCharts (https://github.com/Hamza928505/OpenCharts, vendored under vendor/opencharts).
 * The library arrives on demand; if it cannot load, the page simply has no charts. A chart that can be clicked
 * (majors, skills, areas, the GJU split) hands the click back to the page, which sets the matching filter. */
const L = window.BoardLogic;
const $ = (id) => document.getElementById(id);

const AXIS = { format: "plain", locale: "", scale: "linear", min: "", max: "" };
const COLORS = { meets: "#22c55e", check: "#f59e0b", fails: "#ef4444", brand: "#1f8bcc", amber: "#f9a61e" }; // the blue and the amber of the GJU website
const GJU_ORDER = ["meets", "check", "fails"];
const AREA_COLORS = ["#1f8bcc", "#ffb844", "#175b92", "#f07f1d", "#a6cae2", "#878585", "#c98300", "#74a5d7"];

/** An area keeps its colour whatever the filters: it comes from the area's place in the majors file, here and in the page's legend. */
export const areaColor = (area, order) => AREA_COLORS[Math.max(0, order.indexOf(area)) % AREA_COLORS.length];

const hex = (n) => n.toString(16).padStart(2, "0");
const mix = (a, b, t) => {
  const c = (s, i) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  return "#" + [0, 1, 2].map((i) => hex(Math.round(c(a, i) + (c(b, i) - c(a, i)) * t))).join("");
};
/** n colours from one end to the other, so a ranking reads as a gradient: GJU blue for majors, GJU amber for skills. */
const BLUES = ["#1f8bcc", "#a6cae2"], AMBERS = ["#f9a61e", "#ffd89a"];
const ramp = (n, [from, to]) => Array.from({ length: n }, (_, i) => mix(from, to, n < 2 ? 0 : i / (n - 1)));
const shorten = (text, max) => (text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text);
/** An axis from 0; counts of four or fewer get a 0-5 axis, so the ticks are whole numbers. Larger counts scale themselves. */
const axisFor = (max) => ({ ...AXIS, min: 0, max: max <= 4 ? 5 : "" });

export async function createCharts({ majorNames, areaOrder = [], onPick }) {
  let oc;
  try { oc = await import("../vendor/opencharts/js/studio/oc.js"); } catch (error) { console.warn("Charts could not be loaded:", error); return null; }
  const opts = (id, own) => ({ ...oc.newSpec(oc.getChart(id)).opts, ...own });

  const slots = {
    majors: { host: $("ch-majors"), chart: "bar-horizontal", height: 270 },
    gju: { host: $("ch-gju"), chart: "doughnut", height: 190 },
    skills: { host: $("ch-skills"), chart: "bar-horizontal", height: 270 },
    days: { host: $("ch-days"), chart: "area-basic", height: 250 },
    areas: { host: $("ch-areas"), chart: "polar-area", height: 170 },
    german: { host: $("ch-german"), chart: "bar-vertical", height: 230 },
  };
  for (const slot of Object.values(slots)) { slot.card = slot.host.closest(".chart-card"); slot.empty = slot.card.querySelector(".chart-empty"); }

  /** Draw or redraw one chart; `spec` null means there is nothing to show. */
  function show(key, spec, picks) {
    const slot = slots[key];
    slot.picks = picks;
    if (spec) spec.effects = { gradient: 0.9, glow: 0.45, shadow: 0.4, ...spec.effects }; // fills fade from the colour to a lighter shade
    const nothing = !spec;
    slot.empty.hidden = !nothing;
    slot.host.hidden = nothing;
    if (nothing) return;
    try {
      if (slot.api) slot.api.update(spec);
      else slot.api = oc.render(slot.host, { chart: slot.chart, spec, height: slot.height });
    } catch (error) {
      console.warn(`The ${key} chart could not be drawn:`, error);
      slot.empty.hidden = false;
      slot.host.hidden = true;
    }
  }

  // a click on a bar or slice, and a pointer cursor over one
  const clickable = new Set(["majors", "gju", "skills", "areas"]);
  for (const key of clickable) {
    const { host } = slots[key];
    const hit = (event) => {
      const chart = slots[key].api?.instance?.chart;
      return chart ? chart.getElementsAtEventForMode(event, "nearest", { intersect: true }, true) : [];
    };
    host.addEventListener("click", (event) => {
      const [first] = hit(event);
      const value = first && slots[key].picks?.[first.index];
      if (value != null) onPick(key, value);
    });
    host.addEventListener("mousemove", (event) => { host.style.cursor = hit(event).length ? "pointer" : "default"; });
  }

  function ranking(key, list, label, name, shades) {
    if (!list.length) return show(key, null);
    const max = Math.max(...list.map((x) => x.count));
    const room = window.innerWidth < 700 ? 17 : 28; // long names would be cut off at the left edge of a phone
    show(key, {
      labels: list.map((x) => shorten(name(x.key), room)), values: list.map((x) => x.count), colors: ramp(list.length, shades),
      opts: opts("bar-horizontal", { radius: 7, thickness: 0.7, prefix: "", suffix: "", separator: false, label, axis: axisFor(max) }),
    }, list.map((x) => x.key));
  }

  return {
    /** Redraw every chart for `data` (from BoardLogic.chartData). Resolves when they are all drawn. */
    async update(data) {
      ranking("majors", data.majors, "Internships", (id) => majorNames[id] || id, BLUES);
      ranking("skills", data.skills, "Internships", (name) => name, AMBERS);

      const split = GJU_ORDER.map((k) => data.gju[k]);
      show("gju", split.some(Boolean) ? { labels: GJU_ORDER.map((k) => L.GJU_LABELS[k]), values: split, colors: GJU_ORDER.map((k) => COLORS[k]), opts: opts("doughnut", { cutout: 72, borderWidth: 0, hoverOffset: 8 }) } : null, GJU_ORDER);

      const busiest = Math.max(...data.days.map((d) => d.count));
      show("days", data.total ? {
        labels: data.days.map((d) => d.date),
        series: [{ label: "New internships", color: COLORS.brand, data: data.days.map((d) => d.count) }],
        opts: opts("area-basic", { curve: "smooth", tension: 0.4, fill: true, fillAlpha: 0.24, points: true, pointRadius: 3, lineWidth: 2.5, prefix: "", suffix: "", separator: false, axis: axisFor(busiest), maxLabels: 7 }),
      } : null);

      show("areas", data.areas.length ? {
        labels: data.areas.map((a) => a.key), values: data.areas.map((a) => a.count), colors: data.areas.map((a) => areaColor(a.key, areaOrder)),
        opts: opts("polar-area", { alpha: 0.85 }),
      } : null, data.areas.map((a) => a.key));

      const names = { none: "None", unknown: "n/a" };
      show("german", data.total ? {
        labels: data.german.map((x) => names[x.key] || x.key),
        series: [{ label: "Internships", color: COLORS.amber, data: data.german.map((x) => x.count) }],
        opts: opts("bar-vertical", { radius: 6, thickness: 0.7, outline: false, prefix: "", suffix: "", separator: false, axis: axisFor(Math.max(...data.german.map((x) => x.count))) }),
      } : null);

      await Promise.all(Object.values(slots).map((s) => s.api?.whenReady).filter(Boolean));
    },

    /** The same charts again, so their gradients and glow match a changed theme. */
    redraw() { Object.values(slots).forEach((s) => { if (s.api && !s.host.hidden) s.api.update({}); }); },
  };
}
