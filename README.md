# GJU Internship Board

A static page with internship, Pflichtpraktikum and Werkstudent postings in Germany, collected daily
for every German Jordanian University major. Students filter by major, position type, country,
language level, skills and the GJU German Year rules, then download what they see as an Excel file.

## What is here

| Path | What |
|---|---|
| `index.html`, `style.css`, `app.js`, `board-logic.js` | The page. No framework, no tracking, no cookies. |
| `vendor/xlsx.full.min.js` | SheetJS Community Edition 0.18.5 (Apache-2.0), builds the `.xlsx` files in the browser. |
| `board/majors.json` | The 22 GJU bachelor programs with the job-title words used to search for them. Program names are from <https://www.gju.edu.jo/gju-programs>. **Keywords and skills are suggestions to review.** Master programs are not included yet. |
| `data/postings.json` | Every active posting (dropped after 45 days unseen). |
| `data/days/YYYY-MM-DD.json` | The postings first seen on that day. Powers "download one day". |
| `data/index.json` | Totals, the list of days, and what the last run covered. |

## What is published about a posting

Title, company, city, country, link to the original advert, date, position type, matching majors, skills,
and four facts read from the advert text by fixed rules: duration, monthly pay, German level and English level.
A fact the advert does not state is shown as "not stated". **The advert text and contact details are not kept.**

The **GJU rules** column compares those facts with the German Year documents: at least 20 weeks, at least
861 EUR per month, and an approved country (Germany, Austria, Switzerland, Luxembourg). *Meets* needs all
three to be stated and satisfied. *Breaks a rule* means a stated value is below the limit. *Check* means
something is not stated. Students must always confirm with their department.

## How the data is produced

The data is written by a private runner (outside this repo) that searches job sites within a daily credit
budget, rotating through areas and sites. This repo holds no keys and no personal data. To have a posting
removed, open an issue.

## Running the page locally

Serve this folder with any static file server, for example `npx serve .`, and open it in a browser.
Opening `index.html` directly will not work, because the browser blocks loading the data files from `file:`.

## Not done yet

Hosting choice, a privacy and imprint page (required in Germany before launch), and ads or donations.
