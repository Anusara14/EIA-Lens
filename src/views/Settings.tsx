import { BookOpen, KeyRound, Moon, Sparkles, Sun } from 'lucide-react'
import { useStore } from '../store'
import { Card, DeveloperLink, OutlinePill } from '../ui/kit'

// ponytail: short-form citations as given in the project brief; add full bibliographic details before publishing.
const REFERENCES = [
  ['Review quality', 'Lee & Colley review package (EIS quality grading A–F).'],
  ['Review quality', 'Põder & Lukki (2011): limits of checklist-based review.'],
  ['Auditability', 'Wood et al. (2000): 44% of 865 UK predictions were not auditable.'],
  ['Auditability', 'Buckley (1991): auditing the accuracy of impact predictions.'],
  ['AI in EIA', 'Cilliers et al. (2025): GPT for EIA screening.'],
  ['AI in EIA', 'PNNL NEPAQuAD (2024): LLM benchmark on environmental impact statements.'],
  ['Satellite plumes', 'Caballero et al. (2018): Sentinel-2 monitoring of dredge plumes.'],
  ['Satellite plumes', 'Vanhellemont & Ruddick (2016): ACOLITE atmospheric correction for Sentinel-2.'],
  ['Case', 'ERM (2023). ESIA and ESMP for West Container Terminal-1, Colombo, Sri Lanka. Final v5.0, 7 April 2023.'],
]

export function Settings() {
  const { theme, toggleTheme, ai, setAi, isDemo, pages } = useStore()
  const keyOk = ai.key.startsWith('sk-ant-')
  return (
    <div className="grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
      <div className="flex flex-col gap-4">
        <Card icon={theme === 'dark' ? Moon : Sun} title="Appearance">
          <button type="button" onClick={toggleTheme} className="w-fit rounded-full border border-line-strong px-4 py-2 text-[14px] hover:border-mint-500">
            Switch to {theme === 'dark' ? 'light' : 'dark'} mode
          </button>
        </Card>

        <Card icon={Sparkles} title="AI mode" aside={<OutlinePill>Off by default</OutlinePill>}>
          <p className="max-w-[62ch] text-[14px] leading-relaxed text-ink-2">
            When on, each flag in Review gets a "Draft a cited fix with Claude" button. Claude reads the most relevant ESIA pages and must cite a page in every sentence; uncited sentences are dropped. The ten audit rules never use AI.
          </p>
          <label className="flex max-w-[480px] flex-col gap-1.5 text-[13.5px]">
            <span className="flex items-center gap-2 text-ink-2"><KeyRound className="size-4" aria-hidden /> Anthropic API key</span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={ai.key}
              onChange={(e) => setAi({ key: e.target.value.trim() })}
              placeholder="sk-ant-…"
              className="rounded-full border border-line-strong bg-card-2 px-4 py-2 text-ink"
            />
            <span className="text-[12.5px] text-ink-2">Kept in memory for this tab only. Never saved, and sent only to api.anthropic.com.</span>
          </label>
          <label className="flex w-fit cursor-pointer items-center gap-3 text-[14px]">
            <input type="checkbox" checked={ai.on} disabled={!keyOk} onChange={(e) => setAi({ on: e.target.checked })} className="size-4 accent-[var(--mint-500)]" />
            Use AI for suggested fixes
          </label>
          {ai.key && !keyOk && <p role="alert" className="text-[13px] text-ink">That does not look like an Anthropic key (they start with sk-ant-).</p>}
          {ai.on && !pages && !isDemo && <p className="text-[13px] text-ink-2">Re-upload the PDF so Claude has page text to cite.</p>}
        </Card>
      </div>

      <Card icon={BookOpen} title="About EIA Lens">
        <p className="max-w-[62ch] text-[14px] leading-relaxed text-ink-2">
          Existing AI tools for EIA read reports: screening and question answering. EIA Lens checks the science with ten fixed, reproducible rules, and checks spatial claims against open data. AI only retrieves evidence; a human planner makes the decision.
        </p>
        <p className="text-[14px] text-ink">
          Developed by <DeveloperLink />
        </p>
        <ul className="flex flex-col gap-2.5 text-[13.5px] leading-snug">
          {REFERENCES.map(([topic, ref]) => (
            <li key={ref} className="grid grid-cols-[110px_1fr] gap-3">
              <span className="text-ink-2">{topic}</span>
              <span>{ref}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
