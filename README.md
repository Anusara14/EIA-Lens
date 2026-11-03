# EIA-Lens

Review. Verify. Track. A browser-only demo that reads an EIA / ESIA PDF, runs ten fixed audit rules over its text, and builds a scorecard where every flag links to the page that proves it. A human planner makes the decision.

Developed by [Anusara14](https://github.com/Anusara14).

## Run

```bash
npm install
npm run dev      # open the printed URL → "Load demo: WCT-1 Colombo Port (2023)"
npm test         # runs the rule engine on the bundled WCT-1 ESIA (16 checks)
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

## Testing on other reports

```bash
EIA_CORPUS="path/to/folder/of/pdfs" npx vitest run scripts/corpus.test.ts
```

Prints, per report: pages and labels found, which rules flag / pass / do not apply, review grades, auditability, EMP rows, decision. Results on six Sri Lankan EIAs (Nov 2026):

| Report | Labelled pages | Flags | Decision |
| --- | --- | --- | --- |
| WCT-1 Colombo Port ESIA (ERM 2023) | 291 / 317 | R1–R10 | Revise |
| CEP Sections 1, 2, 4 (Kadawatha–Dambulla) | 189 / 202 | R5, R10 | Approve with conditions |
| Sampoor–Kappalthurai transmission ESIA | 273 / 769 | R9, R10 | Revise |
| Mannar wind phase II EIA | 35 / 80 | R10 | Revise |
| Marino Hotel EIA (2021) | 168 / 169 | R5, R10 | Revise |
| Point Pedro fisheries harbour EIA | 199 / 220 | R10 | Revise |

Only WCT-1 names predictive models (AERMOD, MIKE 21), so R1–R4 do not apply to the other five; the dashboard says so and caps their model and impact-prediction ratings.

## Earth Engine overlay

`scripts/gee_turbidity.js` filters Sentinel-2 SR (harmonised) over the borrow area, masks cloud with the SCL band, computes a Nechad-style red-band (B4) turbidity index and prints a PNG link plus its bounds. Upload both in Verify → Satellite overlay. The index is **indicative, not calibrated to mg/l**.

## Optional AI mode

Off by default. Paste an Anthropic API key in Settings (kept in memory only). Each Review flag then offers "Draft a cited fix with Claude": the app retrieves the most relevant pages and asks for a fix in which every sentence cites a page; sentences without a valid citation are dropped. The ten rules never use AI.

## Limitations

- Rules are keyword / regex based. R6 (headroom) and R8 (text vs table) parse simple tables and are marked "needs reviewer confirmation".
- Review-quality grades are a simplified Lee & Colley reading and are indicative only.
- The EMP ledger parser expects ESMP tables with row codes like "A.1" and ■ bullets; other layouts give an empty ledger.
- Map geometries are hand-placed approximations for the WCT-1 demo; digitise them from ESIA Fig. 1 before drawing conclusions. Other reports still show the WCT-1 area.
- 3D block heights are illustrative, not modelled plume depth. Most basemap buildings have no recorded height and are drawn at 10 m.
- The basemaps, terrain (Mapzen terrarium tiles on AWS) and Sentinel-2 imagery need internet; the engine and PDF review work offline.
- The EMP ledger was only recognised in WCT-1; the other five reports lay out their EMPs differently.
- Scanned (image-only) PDFs have no text layer and return mostly "not applicable". GeoTIFF overlays must be exported as PNG first.
- References in the About panel are short-form, as given in the brief.
