# GJU German Year Kit

A static site for German Jordanian University students looking for their German Year internship: a guide to every
rule, document and deadline of the 20-week internship, the German job boards and RSS feeds worth searching, with
tips on what an AI assistant can and cannot search for you, and a profile editor that saves your whole career as one
`.json` file to attach to any AI chat. An independent student project, not affiliated with GJU. Light and dark theme, responsive from 320 px phones to
wide monitors, animation that stops under "reduce motion", icons from Font Awesome Free.

## What is here

| Path | What |
|---|---|
| `index.html`, `css/guide.css`, `js/guide.js` | The home page, the German Year guide: every rule, document and deadline of the 20-week internship, in folding sections. Its numbers (weeks, months) are read from `data/rules.json`. |
| `search.html`, `js/search.js`, `css/theme.css`, `css/components.css`, `img/boards/` | Where to find internships: the German job boards (each with its own site icon, saved here so the page loads nothing from other sites) and RSS feeds, what an AI assistant can search, and a tip for writing a CV and cover letter with Claude in Word. The stylesheets hold the design of both pages: tokens for both themes (the blue, navy and amber of gju.edu.jo), gradients, animation. |
| `editor.html`, `js/editor.js`, `css/editor.css` | Standalone profile editor moved from CareerToAI. Education, experience, projects, certificates, attachments, skills catalogue and radar. Text stays in localStorage, attachments in IndexedDB; JSON exports include both. No backend or API keys. |
| `js/skill-library.js`, `data/skill-taxonomy.json` | Curated GJU skills and the bundled English/German ESCO catalogue. |
| `.claude/skills/gju-internships/` | A Claude Code skill: searches Indeed (through Claude's Indeed connector) for internships in a GJU major and checks each advert against the German Year rules, quoting the advert for every fact. Run `/gju-internships` in Claude Code inside this folder. It reads its numbers from `data/rules.json` and its search words from `board/majors.json`. |
| `docs/` | The sixteen official GJU and Office for Industrial Links documents the guide is written from and links to. They are GJU's documents, copied unchanged. |
| `js/ui.js` | Shared by both pages: the theme button and the sections that fade in as you scroll. |
| `vendor/` | OpenCharts (bundled) with Chart.js, SweetAlert2, SheetJS, Font Awesome Free. Served from here, so a visitor's browser contacts no other site. See `vendor/README.md`. |
| `board/majors.json` | The 22 GJU bachelor programs and the job-title words used to find internships for them. Program names are from <https://www.gju.edu.jo/gju-programs>. **Keywords are suggestions to review.** Master programs are not included yet. |
| `board/skill-aliases.json` | Other ways adverts write a skill (mostly German), mapped to the profile editor's skill names. |
| `data/rules.json` | The GJU numbers the guide and the skill use (20 weeks, 6 months recognised, 2 months to hand in the report, 861 € a month as proof of funds for a visa extension, the approved countries), copied from the German Year rules. |

## Looking at it

Serve this folder with any static file server, for example `python -m http.server`, and open it in a browser.
Opened straight from `file:`, browsers block the pages' scripts and the guide's `data/rules.json`.

## Profile editor

Open `editor.html` through the static server. Drafts are private to the browser and origin, so download a JSON backup before clearing browser data or moving devices. The editor starts blank and includes no candidate data.

Use **Import .json** in the editor toolbar for a German Year Kit backup or previous CareerToAI export. Choose the JSON file; if the editor already holds a draft you are asked to confirm before it is replaced, and an empty editor imports straight away. Existing drafts at CareerToAI's old `/editor/` address can still be downloaded there. The German Year Kit uses separate browser storage so it cannot overwrite the old draft. The export format remains version 1, compatible with CareerToAI's `npm run import-data -- <file>`.

The editor uses the existing local SweetAlert2, OpenCharts and Font Awesome bundles and loads no advertising or third-party scripts. Server-only AI extraction, repository saves, private phone storage and base-document uploads remain outside this standalone page.

## Not done yet

Hosting choice, a privacy and imprint page (required in Germany before launch), and ads or donations.
