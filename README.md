# GJU Internship Board

A static page with **internships** in Germany for German Jordanian University students, collected daily for
every GJU major. Students search, pick from searchable lists, filter by the German Year rules, look at charts,
and download what they see as an Excel file. Internships only: Werkstudent jobs, theses and regular jobs are not
published.

## What the page does

- **Searchable dropdowns for every list field** (major, skills, country, city, kind, GJU rules, language level,
  sort): type to narrow the list, arrow keys and Enter to pick, counts that follow the other filters, grouped
  options, and a sheet at the top of the screen on phones.
- **Charts** drawn with [OpenCharts](https://github.com/Hamza928505/OpenCharts): internships by major, the GJU
  split, most asked skills, new internships per day, duration and required German level. They follow the
  filters, and a click on a bar or slice sets that filter.
- **GJU check** per internship (duration, pay, country), explained in a details window; a **table** and a **card**
  view; tick rows and download **what you see, what you ticked, everything, or one day** as `.xlsx`.
- Values that cannot be used (a pay range the wrong way round, a duration or dates out of range) get a
  SweetAlert2 window that says what to fix.
- Light and dark theme (follows the system until the button is pressed), responsive from 320 px phones to wide
  monitors, animation that stops under "reduce motion", icons from Font Awesome Free.

## What is here

| Path | What |
|---|---|
| `index.html`, `css/theme.css`, `css/components.css` | The page and its design: tokens for both themes, gradients, animation. |
| `js/main.js`, `js/combo.js`, `js/charts.js`, `js/ui.js`, `board-logic.js` | The page's code. `board-logic.js` (filters, facet counts, chart numbers, rule explanations) has no DOM and is unit tested in the private runner repo. |
| `vendor/` | OpenCharts (bundled) with Chart.js, SweetAlert2, SheetJS, Font Awesome Free. Served from here, so a visitor's browser contacts no other site. See `vendor/README.md`. |
| `board/majors.json` | The 22 GJU bachelor programs and the job-title words used to find internships for them. Program names are from <https://www.gju.edu.jo/gju-programs>. **Keywords are suggestions to review.** Master programs are not included yet. |
| `board/skill-aliases.json` | Other ways adverts write a skill (mostly German), mapped to the profile editor's skill names. |
| `data/postings.json` | Every active internship (dropped after 45 days unseen). |
| `data/days/YYYY-MM-DD.json` | The internships first seen that day, for "download one day". |
| `data/index.json` | Totals, the list of days, what the last run covered, and an optional `notice` shown as a banner. |
| `data/skills.json`, `data/rules.json` | The skill menu's groups (from the editor's skill library) and the GJU numbers the page explains (copied from the German Year rules file). |

## What is published about an internship

Title, company, city, country, link to the original advert, date, kind (Praktikum, Pflichtpraktikum or
Internship), matching majors, skills, and four facts read from the advert text by fixed rules: duration, monthly
pay, German level and English level. A fact the advert does not state is shown as "not stated". **The advert text
and contact details are not kept.**

The **GJU check** compares those facts with the German Year documents: at least 20 weeks, at least 861 EUR per
month, and an approved country (Germany, Austria, Switzerland, Luxembourg). *Meets the rules* needs all three to
be stated and satisfied. *Below a limit* means a stated value is under a limit. *Needs checking* means something
is not stated. Students must always confirm with their department.

## How the data is produced

A private runner (outside this repo) searches job sites within a daily credit budget, rotating through areas and
sites, and writes the `data/` files. This repo holds no keys and no personal data. To have an internship removed,
open an issue.

## Looking at it

Serve this folder with any static file server, for example `python -m http.server`, and open it in a browser
(opening `index.html` directly does not work: browsers block loading the data files from `file:`). With no `data/`
folder the page shows an empty state. To preview it with invented, clearly labelled sample internships, run
`npm run board:demo -- --out <folder>` in the runner repo and serve that folder.

## Not done yet

Hosting choice, a privacy and imprint page (required in Germany before launch), and ads or donations.
