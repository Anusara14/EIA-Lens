import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Check, Droplets, ListChecks, OctagonAlert, Minus } from 'lucide-react'
import type { EmpItem } from '../engine'
import { useStore, type PromiseStatus } from '../store'
import { Card, EvidencePill, OutlinePill } from '../ui/kit'

const STATUSES: PromiseStatus[] = ['Not started', 'In progress', 'Met', 'Breached']

function Yes({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[12.5px] ${on ? 'text-ink' : 'text-ink-2'}`}>
      {on ? <Check className="size-3.5 text-link" strokeWidth={2.4} aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
      <span className="sr-only">{label}: </span>{on ? 'Yes' : 'No'}
    </span>
  )
}

function SmartMeter({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-2" aria-label={`SMART score ${n} of 4`}>
      <span className="flex gap-0.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => <span key={i} className={`h-3.5 w-1.5 rounded-full ${i < n ? 'bg-mint-500' : 'bg-line-strong'}`} />)}
      </span>
      <span className="num text-[13px]">{n}/4</span>
    </span>
  )
}

function Ledger({ items }: { items: EmpItem[] }) {
  const { empStatus, setEmpStatus, openEvidence } = useStore()
  const [sortBy, setSortBy] = useState<'order' | 'smart'>('order')
  const rows = sortBy === 'smart' ? [...items].sort((a, b) => a.smart - b.smart) : items
  const mean = items.reduce((s, i) => s + i.smart, 0) / (items.length || 1)
  const noTraining = items.filter((i) => i.training === 'None').length

  return (
    <Card icon={ListChecks} title="EMP promise ledger" className="xl:col-span-2"
      aside={<span className="num text-[13px] text-ink-2">{items.length} commitments · mean SMART {mean.toFixed(1)}/4</span>}>
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <OutlinePill>No commitment has a budget figure</OutlinePill>
        <OutlinePill>{noTraining} rows say "Training: None"</OutlinePill>
        <button type="button" onClick={() => setSortBy(sortBy === 'order' ? 'smart' : 'order')} className="ml-auto rounded-full border border-line-strong px-3 py-1 text-ink-2 hover:text-ink">
          Sort: {sortBy === 'order' ? 'EMP order' : 'weakest first'}
        </button>
      </div>
      <div className="max-h-[560px] overflow-auto rounded-[20px] border border-line">
        <table className="w-full min-w-[960px] border-collapse text-left text-[13.5px]">
          <caption className="sr-only">EMP commitments with SMART checks and tracking status</caption>
          <thead className="sticky top-0 z-10 bg-card-2 text-[12px] text-ink-2">
            <tr>
              {['Activity', 'Promise', 'Owner', 'Frequency', 'Number', 'Date', 'Budget', 'SMART', 'Status'].map((h) => <th key={h} scope="col" className="px-3 py-2.5 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((it) => (
              <tr key={it.id} className="border-t border-line align-top">
                <td className="w-[22%] px-3 py-3">
                  <button type="button" onClick={() => openEvidence({ pdfPage: it.pdfPage, quote: it.promise })} className="text-left hover:underline underline-offset-4">
                    <span className="num mr-1.5 text-ink-2">{it.code}</span>{it.activity}
                  </button>
                  <span className="mt-1 block text-[12px] text-ink-2">p. {it.label ?? it.pdfPage}</span>
                </td>
                <td className="w-[30%] px-3 py-3 leading-snug text-ink-2">{it.promise}</td>
                <td className="px-3 py-3">{it.owner ?? <span className="text-ink-2">Not named</span>}</td>
                <td className="px-3 py-3 capitalize">{it.frequency ?? <span className="text-ink-2 normal-case">Not stated</span>}</td>
                <td className="px-3 py-3"><Yes on={it.hasNumber} label="Has a number" /></td>
                <td className="px-3 py-3"><Yes on={it.hasDate} label="Has a date" /></td>
                <td className="px-3 py-3"><Yes on={it.hasBudget} label="Has a budget" /></td>
                <td className="px-3 py-3"><SmartMeter n={it.smart} /></td>
                <td className="px-3 py-3">
                  <select
                    aria-label={`Status of ${it.code}`}
                    value={empStatus[it.id] ?? 'Not started'}
                    onChange={(e) => setEmpStatus(it.id, e.target.value as PromiseStatus)}
                    className="rounded-full border border-line-strong bg-card px-2.5 py-1 text-[13px] text-ink"
                  >
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12.5px] text-ink-2">SMART here = named owner, a number, a date or frequency, and a budget. Statuses are saved in this browser only.</p>
    </Card>
  )
}

function TssChart() {
  const m = useStore((s) => s.analysis?.monitoring)
  const data = useMemo(() => m?.values.map((v) => ({ ...v, near: v.value >= m.limit * 0.9 })) ?? [], [m])
  if (!m) {
    return (
      <Card icon={Droplets} title="Monitoring against limits">
        <p className="text-ink-2">No station-by-station monitoring table with a stated limit was found in this report.</p>
      </Card>
    )
  }
  const near = data.filter((d) => d.near).length
  const mean = data.reduce((s, d) => s + d.value, 0) / data.length
  const band = m.limit * 0.9
  return (
    <Card icon={Droplets} title={`${m.name} at ${data.length} stations`} aside={<OutlinePill>{m.label ? `ESIA p. ${m.label}` : `PDF p. ${m.pdfPage}`}</OutlinePill>}>
      <p className="text-[14px] leading-relaxed text-ink-2">
        Mean <span className="num text-ink">{mean.toFixed(0)} {m.unit}</span> against a limit of <span className="num text-ink">{m.limit} {m.unit}</span>.{' '}
        <span className="num text-ink">{near} of {data.length}</span> stations already sit within 10% of the limit, before dredging adds anything.
      </p>
      <div className="h-[300px]" role="img" aria-label={`${m.name} by station; ${near} of ${data.length} stations within 10% of the ${m.limit} ${m.unit} limit`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <ReferenceArea y1={band} y2={m.limit} fill="var(--mint-300)" fillOpacity={0.16} ifOverflow="extendDomain" />
            <XAxis dataKey="code" tick={{ fill: 'var(--text-2)', fontSize: 11 }} interval={3} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
            <YAxis domain={[100, Math.ceil((m.limit * 1.05) / 10) * 10]} tick={{ fill: 'var(--text-2)', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: 'var(--card-2)' }} contentStyle={{ background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 14, color: 'var(--text)' }}
              formatter={(v) => [`${v} ${m.unit}`, m.name]} />
            <Bar dataKey="value" radius={[6, 6, 2, 2]} isAnimationActive={!window.matchMedia('(prefers-reduced-motion: reduce)').matches}>
              {data.map((d) => <Cell key={d.code} fill={d.near ? 'var(--mint-50)' : 'var(--mint-500)'} stroke={d.near ? 'var(--line-strong)' : 'none'} />)}
            </Bar>
            <ReferenceLine y={m.limit} stroke="var(--text)" strokeDasharray="4 4" label={{ value: `Limit ${m.limit}`, position: 'insideTopRight', fill: 'var(--text)', fontSize: 12 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-4 text-[12.5px] text-ink-2">
        <span className="flex items-center gap-2"><span className="size-3 rounded-sm bg-mint-500" aria-hidden /> Below 90% of limit</span>
        <span className="flex items-center gap-2"><span className="size-3 rounded-sm border border-line-strong bg-mint-50" aria-hidden /> Within 10% of limit ({band.toFixed(0)}–{m.limit})</span>
        <span className="flex items-center gap-2"><span className="h-0 w-4 border-t border-dashed border-ink" aria-hidden /> Limit</span>
      </div>
      <EvidencePill ev={{ quote: `${m.values[0].code} <1 ${m.values[0].value}`, pdfPage: m.pdfPage, label: m.label }} prefix="Table on ESIA" />
    </Card>
  )
}

function StopWork() {
  const m = useStore((s) => s.analysis?.monitoring)
  const limit = m?.limit ?? 150
  const mean = m ? Math.round(m.values.reduce((s, v) => s + v.value, 0) / m.values.length) : null
  return (
    <Card icon={OctagonAlert} title="Stop-work trigger" aside={<OutlinePill>Proposal</OutlinePill>}>
      <dl className="flex flex-col gap-3">
        <div className="rounded-[20px] bg-mint-50 p-4 text-on-mint">
          <dt className="text-[13px] font-medium">Halt dredging</dt>
          <dd className="mt-1 text-[22px] leading-snug font-light tracking-[-0.01em]">TSS &gt; {limit} mg/l at 500 m from the dredger</dd>
        </div>
        <div className="rounded-[20px] bg-card-2 p-4">
          <dt className="text-[13px] font-medium">Alert, tighten controls</dt>
          <dd className="mt-1 text-[17px] leading-snug">Background + 25 mg/l{mean !== null && <span className="text-ink-2"> (≈ {mean + 25} mg/l on the March 2023 mean)</span>}</dd>
        </div>
      </dl>
      <p className="text-[13px] leading-relaxed text-ink-2">
        Not in the ESIA. The EMP names no threshold that stops work, so a breach has no consequence. Proposed here for the planner to set as a consent condition.
      </p>
    </Card>
  )
}

export function Track() {
  const analysis = useStore((s) => s.analysis)
  if (!analysis) return null
  return (
    <div className="grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
      <TssChart />
      <StopWork />
      {analysis.emp.length ? <Ledger items={analysis.emp} /> : (
        <Card icon={ListChecks} title="EMP promise ledger" className="xl:col-span-2">
          <p className="text-ink-2">No EMP table rows were recognised in this report.</p>
        </Card>
      )}
    </div>
  )
}
