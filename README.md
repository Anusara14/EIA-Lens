<p align="center">
  <img src="docs/eia-lens-wordmark.svg" alt="EIA Lens" width="420">
</p>

<h3 align="center">Review. Verify. Track.</h3>

<p align="center">
  Upload any Environmental Impact Assessment and get a scorecard in seconds.<br>
  Ten fixed, reproducible rules check the science. Every red flag links to the page that proves it.<br>
  <b>The planner makes the decision.</b>
</p>

<p align="center">
  <img alt="React 19" src="https://img.shields.io/badge/React-19.3-61DAFB?logo=react&logoColor=white">
  <img alt="TypeScript 7" src="https://img.shields.io/badge/TypeScript-7.0-3178C6?logo=typescript&logoColor=white">
  <img alt="Vite 8" src="https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white">
  <img alt="Tailwind CSS 4" src="https://img.shields.io/badge/Tailwind_CSS-4.3-06B6D4?logo=tailwindcss&logoColor=white">
  <img alt="MapLibre GL 6" src="https://img.shields.io/badge/MapLibre_GL-6.16-396CB2?logo=maplibre&logoColor=white">
  <img alt="pdf.js 6" src="https://img.shields.io/badge/pdf.js-6.5-E34F26?logo=mozilla&logoColor=white">
</p>
<p align="center">
  <img alt="Tests: 29 passing" src="https://img.shields.io/badge/tests-29_passing-1FD18A?logo=vitest&logoColor=white">
  <img alt="Runs in the browser" src="https://img.shields.io/badge/runs-100%25_in_browser-1FD18A">
  <img alt="No API key needed" src="https://img.shields.io/badge/API_key-not_required-1FD18A">
  <img alt="Works with any EIA or ESIA" src="https://img.shields.io/badge/reports-any_EIA_%2F_ESIA-1FD18A">
  <img alt="Topic: environmental impact assessment" src="https://img.shields.io/badge/topic-environmental_impact_assessment-0B8A52">
  <img alt="Topic: urban planning" src="https://img.shields.io/badge/topic-urban_planning-0B8A52">
</p>

<p align="center">
  <a href="#run">Run</a> ·
  <a href="#screens">Screens</a> ·
  <a href="#works-with-any-eia-or-esia">Any EIA</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#limitations">Limitations</a>
</p>

---

**Why it exists.** Existing AI tools for EIA only *read* reports (screening, Q&A). EIA Lens *checks the science* with fixed rules (met data length, model calibration, climate scenarios, baseline headroom, averaging periods, draft text, EMP enforceability), *verifies* spatial claims on a 3D map built from the report's own coordinates, and *tracks* EMP promises against monitoring data. AI is optional and only drafts cited fixes.

Developed by [Anusara14](https://github.com/Anusara14).

## Run

```bash
npm install
npm run dev      # open the printed URL → "Load demo: WCT-1 Colombo Port (2023)"
npm test         # rule engine on the bundled WCT-1 ESIA plus international synthetic cases (29 checks)
npm run build    # production build in dist/
```

No backend and no API key. The demo PDF is `public/demo/WCT1_ESIA_2023.pdf`.

## Screens

| Screen | What it does |
| --- | --- |
| Upload | Drop any EIA/ESIA PDF, or load the WCT-1 demo. Shows each analysis step. |
| Dashboard | Review quality (Lee & Colley-style A–F), model audit (10 rules), auditability %, recommended decision, readiness bar. Each card links to its evidence page. |
| Review | PDF viewer beside the flag list (engine rules + expert-review seed for the demo). Clicking a flag jumps to its page and outlines the quote in mint. Filters: All / High / Section A / B / C. |
| Verify | 3D MapLibre map (mapcn) with a 2D/3D switch: open-data terrain and hillshade, extruded buildings, WCT-1 site, 5 km ZOI, borrow area and 4 km plume buffer as volumes (heights illustrative), draggable sampling points, Sentinel-2 cloudless basemap, upload a turbidity PNG with bounds. Claim-vs-evidence card. |
| Track | EMP promise ledger (owner, frequency, number/date/budget, SMART 0–4, status) and the TSS chart against the 150 mg/l limit with the < 10% headroom band. Proposed stop-work trigger. |
| Settings | Light/dark, optional AI mode, About and references. |
| Export | "Export report" prints an A4 summary (save as PDF from the print dialog). |

## Architecture

```
PDF ──pdf.js──▶ pages[{index, label "7-62", text}]        src/pdf/extract.ts
                     │
                     ▼
            rule engine (pure functions)                   src/engine/
            ├─ rules.ts   R1–R10 model audit
            ├─ score.ts   auditability, review grades, decision
            └─ emp.ts     EMP promise ledger, monitoring series
                     │
                     ▼
            scorecard ─▶ review · verify · track · export  src/views/
```

Page labels come from each page's "Page 7-62" footer, so links cite the printed ESIA page and open the right PDF page. Reports that print plain page numbers instead ("… Dambulla) 18", "Page | 31") are labelled by voting for the offset between the PDF index and the printed number. The last analysis is saved in `localStorage`; the demo PDF is re-fetched when needed.

## Works with any EIA or ESIA

Nothing in the engine assumes one country, consultant or layout:

| Part | How it adapts |
| --- | --- |
| Page labels | "Page 7-62" footers, or plain printed numbers found by voting on the PDF-to-print offset |
| Chapters | ERM-style running headers, else the page whose top carries the chapter title (EMP / ESMP / EMMP, impact assessment) up to the next numbered chapter or annex, else the pages densest in that chapter's vocabulary |
| EMP ledger | Coded ESMP table rows ("A.1 … ■ …") when present, else every commitment sentence or bullet in the EMP ("The Contractor shall…"), each scored for owner, number, timing and cost |
| Models (R1–R4) | ~50 air, noise, hydrodynamic, water-quality, groundwater, coastal, traffic and wind models; matched case-sensitively; reference lists ignored |
| Limits (R6, R7) | "standard", "limit", "guideline value", "permissible", NAAQS rows; station codes such as AQ1, AQ-1, NS 3 |
| Draft text (R9) | TBD/TBC, "[insert …]", "Table xx", Word's "Error! Reference source not found" |
| Money (R10) | ISO codes and symbols for ~40 currencies (USD, EUR, GBP, INR, KES, NGN, ZAR, IDR, BRL…) and cost-table headers |
| Location | Hemisphere-aware DMS and decimal coordinates; UTM grid references (zone from the text, or inferred from the country); otherwise the most-mentioned town from a worldwide gazetteer (Natural Earth, 7,300 places, within the country the report names), or the country itself |
| Coverage | Warns when pages are scanned images (OCR needed) or the report is not in English |

### Locating each report

The Verify map is drawn from the uploaded report itself (`src/engine/location.ts`). Each coordinate is a marker that opens its page; strays more than 150 km from the rest are dropped; a stated study-area radius ("5km radial zone", "2 km buffer") is drawn around the points. A place-name estimate carries a ±5 km ring (±100 km for country only). The bundled demo keeps its curated WCT-1 geometry (borrow area, plume, sampling points).

| Report | Located by |
| --- | --- |
| WCT-1 Colombo Port | 19 points: DMS sample sites plus UTM grid references (zone 44N), 5 km ZOI |
| CEP Kadawatha–Dambulla | 109 coordinates along the corridor, 2 km buffer |
| Sampoor–Kappalthurai | 17 coordinates |
| Point Pedro fisheries harbour | 7 coordinates |
| Mannar wind phase II | place name: Mannar |
| Marino Hotel | place name: Colombo, 2 km radius |

## Testing on other reports

```bash
EIA_CORPUS="path/to/folder/of/pdfs" npx vitest run scripts/corpus.test.ts
```

Prints, per report: pages and labels found, the EMP and impact chapters detected, which rules flag / pass / do not apply, review grades, auditability, EMP rows, location, decision. Results on six Sri Lankan EIAs (Nov 2026):

| Report | Labelled pages | EMP commitments | Flags | Decision |
| --- | --- | --- | --- | --- |
| WCT-1 Colombo Port ESIA (ERM 2023) | 291 / 317 | 38 table rows | R1–R10 | Revise |
| CEP Sections 1, 2, 4 (Kadawatha–Dambulla) | 189 / 202 | 129 | R5 | Approve with conditions |
| Sampoor–Kappalthurai transmission ESIA | 273 / 769 | 150 | R9 ("Table xx"), R10 | Revise |
| Mannar wind phase II EIA | 35 / 80 | 15 | R10 | Approve with conditions |
| Marino Hotel EIA (2021) | 168 / 169 | 28 | R5, R10 | Revise |
| Point Pedro fisheries harbour EIA | 199 / 220 | 113 | R9 (Word cross-reference error), R10 | Revise |

Only WCT-1 names predictive models (AERMOD, MIKE 21), so R1–R4 do not apply to the other five; the dashboard says so and caps their model and impact-prediction ratings. International behaviour (southern/western hemispheres, UTM in Kenya, Mombasa and Namibia place fallbacks, a euro-costed ESMP, WHO-guideline tables, SoundPLAN, Word artefacts, scanned and Spanish text) is covered by unit tests in `src/engine/engine.test.ts`.

To refresh the gazetteer: `python scripts/build_gazetteer.py places.geojson src/engine/gazetteer.json` (instructions in the script).

## Earth Engine overlay

`scripts/gee_turbidity.js` filters Sentinel-2 SR (harmonised) over the borrow area, masks cloud with the SCL band, computes a Nechad-style red-band (B4) turbidity index and prints a PNG link plus its bounds. Upload both in Verify → Satellite overlay. The index is **indicative, not calibrated to mg/l**.

## Optional AI mode

Off by default. Paste an Anthropic API key in Settings (kept in memory only). Each Review flag then offers "Draft a cited fix with Claude": the app retrieves the most relevant pages and asks for a fix in which every sentence cites a page; sentences without a valid citation are dropped. The ten rules never use AI.

## Limitations

- Rules are keyword / regex based. R6 (headroom) and R8 (text vs table) parse simple tables and are marked "needs reviewer confirmation".
- Review-quality grades are a simplified Lee & Colley reading and are indicative only.
- The sentence-based EMP ledger reads commitments, not table cells: owners in a separate column of a flattened table may be missed.
- English only. Other languages get a warning; the keyword lists would need translating.
- Scanned (image-only) PDFs need OCR before upload; the dashboard warns when more than 30% of pages have no text.
- Coordinates: geographic (DMS/decimal) and UTM only. National grids (British National Grid, SLD99/Kandawala, Lambert systems) are not converted. Pairs are assumed latitude-first.
- Place-name estimates use town centres from Natural Earth; small villages may be missing, and a town that shares its name with one in another country resolves within the country the report mentions most.
- The WCT-1 demo's borrow area and plume are hand-placed; digitise them from ESIA Fig. 1 before drawing conclusions.
- 3D block heights are illustrative, not modelled plume depth. Most basemap buildings have no recorded height and are drawn at 10 m.
- The basemaps, terrain (Mapzen terrarium tiles on AWS) and Sentinel-2 imagery need internet; the engine and PDF review work offline.
- GeoTIFF overlays must be exported as PNG first.
- References in the About panel are short-form, as given in the brief.
