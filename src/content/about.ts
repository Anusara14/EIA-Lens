// Landing copy, shared by the React landing page (views/Upload.tsx) and the static HTML that
// crawlers without JavaScript read (vite.config.ts injects it into index.html with FAQ JSON-LD).
// Plain strings only: vite.config imports this file.

export const SITE = {
  url: 'https://eialens.vercel.app/',
  name: 'EIA Lens',
  title: 'EIA Lens: Free Environmental Impact Assessment Review',
  description:
    'Upload an EIA or ESIA PDF and get a scorecard in under a minute. Ten fixed audit rules check the science; every flag links to its page. Runs in your browser.',
  updated: '2026-11-04',
}

export const WHAT_IS =
  'EIA Lens is a free, browser-based tool that reviews Environmental Impact Assessments (EIA) and Environmental and Social Impact Assessments (ESIA). Upload the report as a PDF and ten fixed, reproducible rules check its science: meteorological data length, model calibration, climate scenarios, baseline headroom, averaging periods, draft text and whether the Environmental Management Plan (EMP) is enforceable. Every red flag links to the page that proves it. The planner makes the decision.'

export const STEPS_HOW = [
  { title: 'Review', text: 'A Lee & Colley-style A–F review-quality grade, a 10-rule model audit and an auditability score, each linked to its evidence page in the PDF.' },
  { title: 'Verify', text: 'A 3D map built from the report’s own coordinates, with the zone of influence, project footprint and an optional Sentinel-2 turbidity overlay to test spatial claims.' },
  { title: 'Track', text: 'An EMP promise ledger that scores every commitment for owner, number, timing and budget (SMART 0–4), plus monitoring data charted against its legal limit.' },
]

// ponytail: copied from the base(...) titles in src/engine/rules.ts; update both together.
export const RULES = [
  ['R1', 'Meteorological data covers at least one year'],
  ['R2', 'Dispersion setting (urban/rural) is justified'],
  ['R3', 'Model calibration or validation is reported'],
  ['R4', 'Sensitivity or uncertainty analysis is present'],
  ['R5', 'Climate change scenarios are considered'],
  ['R6', 'Baseline leaves at least 10% headroom below the limit'],
  ['R7', 'Averaging times match the standard'],
  ['R8', 'Text and tables agree'],
  ['R9', 'No placeholder or draft text remains'],
  ['R10', 'EMP commitments are SMART'],
] as const

export const FAQ = [
  {
    q: 'What is EIA Lens?',
    a: 'EIA Lens is a free web app that checks the quality of an Environmental Impact Assessment report. It reads the PDF, runs ten fixed audit rules and produces a scorecard with a recommended decision (Approve, Approve with conditions, or Revise) for a planner or reviewer to confirm.',
  },
  {
    q: 'How do you review an Environmental Impact Assessment report?',
    a: 'A good EIA review checks that the baseline is adequate, predictions are quantified and testable, models are calibrated, alternatives and mitigation are assessed, and the Environmental Management Plan names an owner, a number, a date and a budget for each commitment. EIA Lens automates these checks and links each finding to the page that supports it.',
  },
  {
    q: 'Does EIA Lens upload my PDF to a server?',
    a: 'No. The analysis runs entirely in your browser. The PDF never leaves your device and no account or API key is needed.',
  },
  {
    q: 'Which reports does it work with?',
    a: 'Any text-based EIA or ESIA in English, from any country or consultant. It has been tested on six Sri Lankan EIAs and international synthetic cases. Scanned image-only PDFs need OCR first, and non-English reports get a warning.',
  },
  {
    q: 'Does EIA Lens use AI to make decisions?',
    a: 'No. The ten rules are fixed and reproducible, so the same PDF always gives the same result. An optional AI mode can draft a cited fix for a flag, and any sentence without a valid page citation is dropped. The planner makes the decision.',
  },
  {
    q: 'What is a SMART EMP commitment?',
    a: 'A commitment in the Environmental Management Plan is SMART when it names who is responsible, gives a measurable number or threshold, states a date or frequency, and carries a budget. EIA Lens scores each commitment from 0 to 4 on these points.',
  },
]
