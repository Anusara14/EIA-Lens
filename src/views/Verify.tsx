import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { ImageUp, Layers, Map as MapIcon, Scale } from 'lucide-react'
import { Map, MapControls, MapGeoJSON, MapMarker, MarkerContent, MarkerLabel, MarkerTooltip, useMap } from '@/components/ui/map'
import { useStore } from '../store'
import { BORROW, SAMPLE_POINTS, SITE, box, boxBuffer, circle, fc, type SamplePoint } from '../lib/geo'
import { Card, OutlinePill } from '../ui/kit'
import { Buildings, Camera, Extrude, Terrain } from '../ui/Map3D'

type LayerId = 'site' | 'zoi' | 'borrow' | 'plume' | 'points' | 's2' | 'turbidity'

const LAYERS: { id: LayerId; label: string; note: string; swatch: string }[] = [
  { id: 'site', label: 'WCT-1 site', note: 'approximate', swatch: 'bg-mint-500' },
  { id: 'zoi', label: 'Zone of influence, 5 km', note: 'ESIA ZOI', swatch: 'border-2 border-mint-300' },
  { id: 'borrow', label: 'Sand borrow area', note: 'approximate, digitise from ESIA Fig. 1', swatch: 'bg-mint-50' },
  { id: 'plume', label: 'Predicted plume, 4 km', note: 'ESIA p. 7-30', swatch: 'border-2 border-dashed border-mint-50' },
  { id: 'points', label: 'Sampling points', note: 'placeholders, drag to edit', swatch: 'rounded-full bg-ink' },
  { id: 's2', label: 'Sentinel-2 cloudless basemap', note: 'EOX, non-commercial', swatch: 'bg-[linear-gradient(135deg,#2d4a3a,#6b8f6a)]' },
  { id: 'turbidity', label: 'Satellite turbidity overlay', note: 'indicative, not mg/l', swatch: 'bg-[linear-gradient(90deg,#0b8a52,#e8fff4)]' },
]

const S2_TILES = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'

/** Raster tiles or a georeferenced image, added under our vector layers and re-added after style swaps. */
function RasterLayer({ id, tiles, image, opacity = 1 }: { id: string; tiles?: string; image?: { url: string; coords: [number, number][] }; opacity?: number }) {
  const { map, isLoaded } = useMap()
  useEffect(() => {
    if (!map || !isLoaded) return
    if (tiles) map.addSource(id, { type: 'raster', tiles: [tiles], tileSize: 256, attribution: 'Sentinel-2 cloudless by EOX (2020)' })
    else if (image) map.addSource(id, { type: 'image', url: image.url, coordinates: image.coords as [[number, number], [number, number], [number, number], [number, number]] })
    const firstVector = map.getStyle().layers.find((l) => l.type !== 'background' && l.type !== 'raster')?.id
    map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': opacity } }, tiles ? firstVector : undefined)
    return () => {
      if (!map.getStyle()) return
      if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource(id)) map.removeSource(id)
    }
  }, [map, isLoaded, id, tiles, image, opacity])
  return null
}

type Verdict = 'Pending' | 'Consistent' | 'Exceeds'

interface Overlay { url: string; name: string; bounds: [number, number, number, number] }

function OverlayForm({ onLoad }: { onLoad: (o: Overlay) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [bounds, setBounds] = useState('79.70, 7.05, 79.86, 7.19')
  const [err, setErr] = useState<string | null>(null)
  function submit() {
    const b = bounds.split(/[\s,]+/).filter(Boolean).map(Number)
    if (!file) return setErr('Choose a PNG or JPG exported from Earth Engine.')
    if (!/image\/(png|jpe?g)/.test(file.type)) return setErr('Only PNG or JPG can be drawn in the browser. Export GeoTIFFs as PNG (the GEE script does this).')
    if (b.length !== 4 || b.some(Number.isNaN) || b[0] >= b[2] || b[1] >= b[3]) return setErr('Bounds must be west, south, east, north in degrees, e.g. 79.70, 7.05, 79.86, 7.19.')
    setErr(null)
    onLoad({ url: URL.createObjectURL(file), name: file.name, bounds: b as Overlay['bounds'] })
  }
  return (
    <div className="flex flex-col gap-2.5 text-[13.5px]">
      <label className="flex flex-col gap-1">
        <span className="text-ink-2">Turbidity image (PNG / JPG)</span>
        <input type="file" accept="image/png,image/jpeg" onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)}
          className="text-[13px] file:mr-3 file:rounded-full file:border-0 file:bg-card-2 file:px-3 file:py-1.5 file:text-ink" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-ink-2">Bounds: west, south, east, north</span>
        <input value={bounds} onChange={(e) => setBounds(e.target.value)} className="num rounded-full border border-line-strong bg-card px-3 py-1.5" />
      </label>
      {err && <p role="alert" className="text-[13px] text-ink">{err}</p>}
      <button type="button" onClick={submit} className="flex w-fit items-center gap-2 rounded-full bg-mint-500 px-4 py-2 font-medium text-on-mint hover:bg-mint-400">
        <ImageUp className="size-4" aria-hidden /> Add satellite turbidity overlay
      </button>
    </div>
  )
}

export function Verify() {
  const labels = useStore((s) => s.analysis?.labels ?? {})
  const openEvidence = useStore((s) => s.openEvidence)
  const dark = useStore((s) => s.theme) === 'dark'
  // Pale mint reads on the dark basemap; the light basemap needs the deep greens.
  const ink = dark ? { zoi: '#8ef5c8', plume: '#e8fff4', borrow: '#e8fff4', edge: '#06281a' } : { zoi: '#0b8a52', plume: '#06281a', borrow: '#10b86e', edge: '#06281a' }
  const [on, setOn] = useState<Record<LayerId, boolean>>({ site: true, zoi: true, borrow: true, plume: true, points: true, s2: false, turbidity: true })
  const [points, setPoints] = useState<SamplePoint[]>(SAMPLE_POINTS)
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [verdict, setVerdict] = useState<Verdict>('Pending')
  const [is3d, setIs3d] = useState(true)
  const isDemo = useStore((s) => s.isDemo)

  const geo = useMemo(() => ({
    site: fc(box(SITE, 0.9, 1.1, 'WCT-1 site (approximate)')),
    zoi: fc(circle(SITE, 5, 'Zone of influence 5 km')),
    borrow: fc(box(BORROW.center, BORROW.wKm, BORROW.hKm, 'Sand borrow area (approximate)')),
    plume: fc(boxBuffer(BORROW.center, BORROW.wKm, BORROW.hKm, 4, 'Predicted plume extent 4 km')),
  }), [])

  const image = useMemo(() => overlay && {
    url: overlay.url,
    coords: [[overlay.bounds[0], overlay.bounds[3]], [overlay.bounds[2], overlay.bounds[3]], [overlay.bounds[2], overlay.bounds[1]], [overlay.bounds[0], overlay.bounds[1]]] as [number, number][],
  }, [overlay])
  useEffect(() => () => { if (overlay) URL.revokeObjectURL(overlay.url) }, [overlay])

  const cite = (label: string) => labels[label] && (
    <button type="button" onClick={() => openEvidence({ pdfPage: labels[label] })} className="text-link underline-offset-4 hover:underline">p. {label}</button>
  )

  const claims: { claim: string; label: string; check: string }[] = [
    { claim: 'Plume stays within 4 km of the borrow area', label: '7-30', check: 'Compare the Sentinel-2 turbidity overlay with the dashed 4 km line.' },
    { claim: 'Effect "minimal" beyond the dredging zone', label: '7-13', check: 'Not testable as written: no concentration or distance given.' },
    { claim: 'Borrow area about 8 km offshore', label: '7-50', check: 'Check the polygon once digitised from ESIA Fig. 1.' },
  ]

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] [&>*]:min-w-0">
      <section aria-label="Verify map" className="relative h-[72vh] min-h-[480px] overflow-hidden rounded-[var(--radius-card)] bg-card">
        <Map center={[79.83, 6.99]} zoom={11.2} pitch={62} bearing={-25} maxPitch={75}>
          <Camera is3d={is3d} />
          {is3d && <Terrain dark={dark} />}
          {is3d && <Buildings dark={dark} />}
          {on.s2 && <RasterLayer id="s2" tiles={S2_TILES} />}
          {on.turbidity && image && <RasterLayer id="turbidity" image={image} opacity={0.6} />}
          {on.zoi && <MapGeoJSON id="zoi" data={geo.zoi} fillPaint={{ 'fill-color': ink.zoi, 'fill-opacity': 0.08 }} linePaint={{ 'line-color': ink.zoi, 'line-width': 1.5 }} />}
          {on.plume && <MapGeoJSON id="plume" data={geo.plume} fillPaint={{ 'fill-color': ink.plume, 'fill-opacity': 0.06 }} linePaint={{ 'line-color': ink.plume, 'line-width': 2, 'line-dasharray': [2, 2] }} />}
          {on.borrow && <MapGeoJSON id="borrow" data={geo.borrow} fillPaint={{ 'fill-color': ink.borrow, 'fill-opacity': 0.45 }} linePaint={{ 'line-color': ink.borrow, 'line-width': 1.5 }} />}
          {on.site && <MapGeoJSON id="site" data={geo.site} fillPaint={{ 'fill-color': '#1fd18a', 'fill-opacity': 0.85 }} linePaint={{ 'line-color': ink.edge, 'line-width': 1 }} />}
          {/* ponytail: illustrative heights so footprints read in perspective; not modelled plume depth */}
          {is3d && on.plume && <Extrude id="plume-3d" data={geo.plume} color={ink.plume} height={1500} opacity={0.12} />}
          {is3d && on.borrow && <Extrude id="borrow-3d" data={geo.borrow} color={ink.borrow} height={700} opacity={0.45} />}
          {is3d && on.site && <Extrude id="site-3d" data={geo.site} color="#1fd18a" height={400} opacity={0.9} />}
          {on.site && (
            <MapMarker longitude={SITE[0]} latitude={SITE[1]}>
              <MarkerContent className="cursor-default">
                <span className="block size-2.5 rounded-full border-2 border-on-mint bg-mint-500" />
                <MarkerLabel position="bottom" className="rounded-full bg-mint-500 px-2 py-0.5 text-[11.5px] text-on-mint">WCT-1 site (approximate)</MarkerLabel>
              </MarkerContent>
            </MapMarker>
          )}
          {on.borrow && (
            <MapMarker longitude={BORROW.center[0]} latitude={BORROW.center[1] + 0.03}>
              <MarkerContent className="cursor-default">
                <span className="block size-0" />
                <MarkerLabel position="top" className="rounded-full bg-mint-50 px-2 py-0.5 text-[11.5px] text-on-mint">Borrow area (approximate, digitise from ESIA Fig. 1)</MarkerLabel>
              </MarkerContent>
            </MapMarker>
          )}
          {on.points && points.map((p) => (
            <MapMarker key={p.id} longitude={p.lngLat[0]} latitude={p.lngLat[1]} draggable
              onDragEnd={({ lng, lat }) => setPoints((ps) => ps.map((q) => (q.id === p.id ? { ...q, lngLat: [lng, lat] } : q)))}>
              <MarkerContent>
                <span className={`grid size-5 place-items-center rounded-full border-2 border-white text-[9px] font-bold text-on-mint ${p.kind === 'Air' ? 'bg-mint-300' : p.kind === 'Noise' ? 'bg-mint-50' : 'bg-mint-500'}`}>
                  {p.kind[0]}
                </span>
              </MarkerContent>
              <MarkerTooltip>{p.id} · {p.kind} sampling (placeholder)</MarkerTooltip>
            </MapMarker>
          ))}
          <MapControls position="bottom-right" showCompass showFullscreen />
        </Map>
        <span className="pointer-events-none absolute top-4 left-4 rounded-full bg-card/90 px-3 py-1.5 text-[12.5px] text-ink">
          All geometries approximate{is3d && ' · heights illustrative, not to scale'}{!isDemo && ' · showing the WCT-1 demo area'}
        </span>
        <div className="absolute top-4 right-4 flex rounded-full bg-card/95 p-1" role="group" aria-label="Map view">
          {[false, true].map((v) => (
            <button key={String(v)} type="button" aria-pressed={is3d === v} onClick={() => setIs3d(v)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${is3d === v ? 'bg-mint-500 text-on-mint' : 'text-ink-2 hover:text-ink'}`}>
              {v ? '3D' : '2D'}
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-4">
        <Card icon={Layers} title="Layers">
          <ul className="flex flex-col gap-1">
            {LAYERS.map((l) => (
              <li key={l.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl px-2 py-2 hover:bg-card-2">
                  <input type="checkbox" checked={on[l.id]} onChange={() => setOn((o) => ({ ...o, [l.id]: !o[l.id] }))} className="size-4 accent-[var(--mint-500)]" />
                  <span className={`size-4 shrink-0 rounded ${l.swatch}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px]">{l.label}</span>
                    <span className="block text-[12px] text-ink-2">{l.id === 'turbidity' && !overlay ? 'none loaded yet' : l.note}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Card>

        <Card icon={Scale} title="Claim vs evidence">
          <ul className="flex flex-col gap-3 text-[13.5px]">
            {claims.map((c, i) => (
              <li key={c.claim} className="rounded-[20px] bg-card-2 p-3.5">
                <p className="leading-snug">{c.claim} <span className="text-ink-2">(ESIA {cite(c.label) ?? `p. ${c.label}`})</span></p>
                <p className="mt-1 text-[12.5px] text-ink-2">{c.check}</p>
                {i === 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Verdict for plume claim">
                    {(['Pending', 'Consistent', 'Exceeds'] as Verdict[]).map((v) => (
                      <button key={v} type="button" aria-pressed={verdict === v} onClick={() => setVerdict(v)}
                        className={`rounded-full px-3 py-1 text-[12.5px] ${verdict === v ? 'bg-mint-50 font-medium text-on-mint' : 'border border-line-strong text-ink-2 hover:text-ink'}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="text-[12.5px] text-ink-2">The planner sets each verdict by eye. Satellite turbidity is indicative unless calibrated to field TSS.</p>
        </Card>

        <Card icon={MapIcon} title="Satellite overlay" aside={overlay ? <OutlinePill>{overlay.name}</OutlinePill> : undefined}>
          <OverlayForm onLoad={(o) => { setOverlay(o); setOn((s) => ({ ...s, turbidity: true })) }} />
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            Make one with <code className="rounded bg-card-2 px-1">scripts/gee_turbidity.js</code> in the Google Earth Engine code editor (Sentinel-2 red-band index, Nechad-style).
          </p>
        </Card>
      </div>
    </div>
  )
}
