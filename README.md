# GJU German Year Kit

A free, static website for German Jordanian University (GJU) students planning their German Year internship. It has
three parts:

- **Guide** (`index.html`): every rule, document and deadline of the 20-week internship, from finding a host to the
  certificate and report, with the official GJU documents linked from a library section.
- **Job boards** (`search.html`): the German job boards and RSS feeds worth searching, what an AI assistant can and
  cannot search for you, and a tip for writing a CV and cover letter with Claude in Word.
- **Profile editor** (`editor.html`): build your whole career profile in the browser and save it as one `.json` file
  you can attach to any AI chat.

Live at <https://hamza928505.github.io/GJUYearKit/>. An independent student project, not affiliated with,
endorsed by or operated by GJU. Light and dark theme, responsive from 320 px phones to wide monitors, animation that
stops under "reduce motion". No build step and no framework: plain HTML, CSS and ES modules.

## Run it

Serve this folder with any static file server and open it in a browser:

```
python -m http.server
```

Opened straight from `file:`, browsers block the pages' scripts and the guide's `data/rules.json`.

Tests need only Node (no install):

```
node --test test/editor-import.test.mjs
```

## Profile editor

Education, experience, projects, certificates with attachments, and a skills catalogue with a radar chart. It starts
blank and includes no candidate data. There is no backend and no API key.

- **Where data lives.** Text is kept in `localStorage` (key `gjub-profile:v1`), attachments in IndexedDB. Both stay in
  your browser and origin, so download a JSON backup before clearing browser data or changing device.
- **Not encrypted.** The saved draft, the attachments and the exported `.json` are plain data in your browser, so
  anyone with access to your browser profile can read them. Do not use the editor on a shared computer. A draft saved
  during the short time the editor encrypted it with a passphrase still opens (it asks for the passphrase once) and is
  saved as plain text from then on.
- **Export and import.** The export is a version 1 JSON file, compatible with CareerToAI's
  `npm run import-data -- <file>`. **Import .json** takes a German Year Kit backup or an earlier CareerToAI export. If
  the editor already holds a draft you are asked to confirm before it is replaced; an empty editor imports straight
  away. Existing drafts at CareerToAI's old `/editor/` address can still be downloaded there, and this site uses
  separate storage so it cannot overwrite them.
- **Third parties.** The editor loads no advertising or third-party scripts. AI extraction, repository saves, phone
  storage and base-document uploads from CareerToAI are not part of this standalone page.

## Claude Code skill

`.claude/skills/gju-internships/` searches Indeed (through Claude's Indeed connector) for internships in a GJU major
and checks each advert against the German Year rules: at least 20 weeks, full time, an allowed host and country. It
quotes the advert for every fact. Run `/gju-internships` in Claude Code inside this folder. It reads its numbers from
`data/rules.json` and its search words from `board/majors.json`.

## What is where

| Path | What |
|---|---|
| `index.html`, `css/guide.css`, `js/guide.js` | The guide. Folding sections; the rule numbers are read from `data/rules.json` and the year's timeline is drawn with OpenCharts. |
| `search.html`, `js/search.js`, `img/boards/` | The job boards page. Boards and feeds are plain links, so it works without the script. Each board's icon is saved in `img/boards/` so the page loads nothing from other sites. |
| `editor.html`, `js/editor.js`, `css/editor.css` | The profile editor. |
| `js/skill-library.js`, `data/skill-taxonomy.json` | Curated GJU skills and the bundled English/German ESCO skills catalogue the editor draws on. |
| `css/theme.css`, `css/components.css`, `js/ui.js` | Shared by all three pages: design tokens for both themes (the blue, navy and amber of gju.edu.jo), components, the theme button, the phone menu and the fade-in on scroll. |
| `data/rules.json` | The GJU numbers the guide and the skill use: 20 weeks, 6 months recognised, 2 months to hand in the report, 861 € a month as proof of funds for a visa extension, and the approved countries (Germany, Austria, Switzerland, Luxembourg). |
| `board/majors.json` | The 22 GJU bachelor programs and the job-title words (German and English) used to find internships for them. Program names are from <https://www.gju.edu.jo/gju-programs>. **Keywords are suggestions to review.** Master programs are not included. |
| `board/skill-aliases.json` | Other ways adverts write a skill (mostly German), mapped to the editor's skill names. |
| `docs/` | The sixteen official GJU and Office for Industrial Links documents the guide is written from and links to, copied unchanged. |
| `vendor/` | OpenCharts (with Chart.js), SweetAlert2, SheetJS and Font Awesome Free, served from here. See `vendor/README.md` for versions and licences. |
| `test/` | The editor's import test. |
| `sitemap.xml`, `.github/workflows/static.yml` | Search-engine sitemap, and the workflow that publishes the whole repository to GitHub Pages on every push to `main`. |

## Not done yet

- **Donations.**
- **`SECURITY.md`** is still GitHub's template text.
- **Leftovers from the old internship board.** `js/main.js`, `js/combo.js`, `js/charts.js` and `board-logic.js` are no
  longer loaded by any page, and `vendor/xlsx.full.min.js` (SheetJS) is only needed by them. They can be deleted.
