import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { ImageUp, Layers, Map as MapIcon, Scale } from 'lucide-react'
import { Map, MapControls, MapGeoJSON, MapMarker, MarkerContent, MarkerLabel, MarkerTooltip, useMap } from '@/components/ui/map'
import type { Evidence, Location } from '../engine'
import { useStore } from '../store'
import { BORROW, SAMPLE_POINTS, SITE, box, boxBuffer, circle, fc, type SamplePoint } from '../lib/geo'
import { Card, OutlinePill } from '../ui/kit'
import { Buildings, Camera, Extrude, Terrain } from '../ui/Map3D'

type LayerId = 'site' | 'zoi' | 'borrow' | 'plume' | 'points' | 'located' | 'zone' | 's2' | 'turbidity'
interface LayerDef { id: LayerId; label: string; note: string; swatch: string }

const SHARED_LAYERS: LayerDef[] = [
  { id: 's2', label: 'Sentinel-2 cloudless basemap', note: 'EOX, non-commercial', swatch: 'bg-[linear-gradient(135deg,#2d4a3a,#6b8f6a)]' },
  { id: 'turbidity', label: 'Satellite overlay', note: 'indicative, not calibrated', swatch: 'bg-[linear-gradient(90deg,#0b8a52,#e8fff4)]' },
]

// The bundled WCT-1 case has hand-drawn geometry (borrow area, plume) that no regex can recover.
const DEMO_LAYERS: LayerDef[] = [
  { id: 'site', label: 'WCT-1 site', note: 'approximate', swatch: 'bg-mint-500' },
  { id: 'zoi', label: 'Zone of influence, 5 km', note: 'ESIA ZOI', swatch: 'border-2 border-mint-300' },
  { id: 'borrow', label: 'Sand borrow area', note: 'approximate, digitise from ESIA Fig. 1', swatch: 'bg-mint-50' },
  { id: 'plume', label: 'Predicted plume, 4 km', note: 'ESIA p. 7-30', swatch: 'border-2 border-dashed border-mint-50' },
  { id: 'points', label: 'Sampling points', note: 'placeholders, drag to edit', swatch: 'rounded-full bg-ink' },
  ...SHARED_LAYERS,
]

function reportLayers(loc: Location): LayerDef[] {
  const located: LayerDef = loc.source === 'coordinates'
    ? { id: 'located', label: `Coordinates in the report (${loc.points.length})`, note: 'click a point to open its page', swatch: 'rounded-full bg-mint-500' }
    : { id: 'located', label: loc.place ? `${loc.place.name} (place name)` : 'Project location', note: loc.place ? `approximate, ±${loc.place.uncertaintyKm} km` : 'not found in the text', swatch: 'rounded-full bg-mint-50' }
  const zone: LayerDef = { id: 'zone', label: loc.radius ? `Study area, ${loc.radius.km} km` : 'Study area', note: loc.radius ? 'radius stated in the report' : 'no radius stated', swatch: 'border-2 border-mint-300' }
  return [located, zone, ...SHARED_LAYERS]
}

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

/** Frame the report's own geometry once the map is ready (and again if the report changes). */
function FitTo({ loc, is3d }: { loc: Location; is3d: boolean }) {
  const { map, isLoaded } = useMap()
  const key = `${loc.source}:${loc.center?.join(',')}`
  useEffect(() => {
    if (!map || !isLoaded || !loc.center) return
    const view = { pitch: is3d ? 62 : 0, bearing: is3d ? -25 : 0 }
    const b = loc.bbox
    if (b && (b[2] - b[0] > 0.01 || b[3] - b[1] > 0.01)) map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 90, maxZoom: 14, duration: 0, ...view })
    else map.jumpTo({ center: loc.center, zoom: loc.source === 'place' ? ((loc.place?.uncertaintyKm ?? 5) > 20 ? 6 : 11) : 13.5, ...view })
    // ponytail: frames once per report; panning afterwards is the user's
  }, [map, isLoaded, key])
  return null
}

type Verdict = 'Pending' | 'Consistent' | 'Exceeds'

interface Overlay { url: string; name: string; bounds: [number, number, number, number] }

function OverlayForm({ onLoad, defaultBounds }: { onLoad: (o: Overlay) => void; defaultBounds: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [bounds, setBounds] = useState(defaultBounds)
  const [err, setErr] = useState<string | null>(null)
  function submit() {
    const b = bounds.split(/[\s,]+/).filter(Boolean).map(Number)
    if (!file) return setErr('Choose a PNG or JPG exported from Earth Engine.')
    if (!/image\/(png|jpe?g)/.test(file.type)) return setErr('Only PNG or JPG can be drawn in the browser. Export GeoTIFFs as PNG (the GEE script does this).')
    if (b.length !== 4 || b.some(Number.isNaN) || b[0] >= b[2] || b[1] >= b[3]) return setErr(`Bounds must be west, south, east, north in degrees, e.g. ${defaultBounds}.`)
    setErr(null)
    onLoad({ url: URL.createObjectURL(file), name: file.name, bounds: b as Overlay['bounds'] })
  }
  return (
    <div className="flex flex-col gap-2.5 text-[13.5px]">
      <label className="flex flex-col gap-1">
        <span className="text-ink-2">Image (PNG / JPG)</span>
        <input type="file" accept="image/png,image/jpeg" onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)}
          className="text-[13px] file:mr-3 file:rounded-full file:border-0 file:bg-card-2 file:px-3 file:py-1.5 file:text-ink" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-ink-2">Bounds: west, south, east, north</span>
        <input value={bounds} onChange={(e) => setBounds(e.target.value)} className="num rounded-full border border-line-strong bg-card px-3 py-1.5" />
      </label>
      {err && <p role="alert" className="text-[13px] text-ink">{err}</p>}
      <button type="button" onClick={submit} className="flex w-fit items-center gap-2 rounded-full bg-mint-500 px-4 py-2 font-medium text-on-mint hover:bg-mint-400">
        <ImageUp className="size-4" aria-hidden /> Add satellite overlay
      </button>
    </div>
  )
}

interface Claim { claim: string; ev?: Evidence; check: string }

function spanKm(loc: Location): number {
  if (!loc.bbox) return 0
  const [w, s, e, n] = loc.bbox
  return Math.hypot((n - s) * 110.6, (e - w) * 111.3 * Math.cos((((n + s) / 2) * Math.PI) / 180))
}

function reportClaims(loc: Location): Claim[] {
  const first = loc.points[0]
  const where: Claim = loc.source === 'coordinates'
    ? { claim: `Project located by ${loc.points.length} coordinate pair${loc.points.length > 1 ? 's' : ''} in the report${loc.points.length > 1 ? `, spanning ${spanKm(loc).toFixed(1)} km` : ''}`, ev: first, check: 'Check the points sit on the site, not on a reference station or the consultant office.' }
    : loc.place
      ? { claim: `No coordinates given; placed at ${loc.place.name} from place names`, ev: loc.place.evidence, check: 'Ask the proponent for site coordinates or a georeferenced boundary (KML / shapefile).' }
      : { claim: 'No location could be found in the report', check: 'The report gives neither coordinates nor a recognisable place name.' }
  const zone: Claim = loc.radius
    ? { claim: `Study area radius ${loc.radius.km} km`, ev: loc.radius.evidence, check: 'Does the dashed ring take in every sensitive receptor the report names?' }
    : { claim: 'No study-area radius stated', check: 'A defined zone of influence is expected in the scoping chapter.' }
  return [where, zone]
}

const DEMO_CLAIMS = (labels: Record<string, number>): Claim[] => [
  { claim: 'Plume stays within 4 km of the borrow area', ev: { quote: 'sediment plume may extend to 4 km from the borrow area', pdfPage: labels['7-30'] ?? 1, label: '7-30' }, check: 'Compare the Sentinel-2 turbidity overlay with the dashed 4 km line.' },
  { claim: 'Effect "minimal" beyond the dredging zone', ev: { quote: 'expected to be minimal beyond the immediate zone of dredging', pdfPage: labels['7-13'] ?? 1, label: '7-13' }, check: 'Not testable as written: no concentration or distance given.' },
  { claim: 'Borrow area about 8 km offshore', ev: { quote: '8 km offshore', pdfPage: labels['7-50'] ?? 1, label: '7-50' }, check: 'Check the polygon once digitised from ESIA Fig. 1.' },
]

function Dot({ className, children }: { className: string; children?: ReactNode }) {
  return <span className={`grid place-items-center rounded-full border-2 border-white text-[9px] font-bold text-on-mint ${className}`}>{children}</span>
}

export function Verify() {
  const analysis = useStore((s) => s.analysis)
  const openEvidence = useStore((s) => s.openEvidence)
  const isDemo = useStore((s) => s.isDemo)
  const dark = useStore((s) => s.theme) === 'dark'
  // Pale mint reads on the dark basemap; the light basemap needs the deep greens.
  const ink = dark ? { zoi: '#8ef5c8', plume: '#e8fff4', borrow: '#e8fff4', edge: '#06281a' } : { zoi: '#0b8a52', plume: '#06281a', borrow: '#10b86e', edge: '#06281a' }
  const [on, setOn] = useState<Record<LayerId, boolean>>({ site: true, zoi: true, borrow: true, plume: true, points: true, located: true, zone: true, s2: false, turbidity: true })
  const [points, setPoints] = useState<SamplePoint[]>(SAMPLE_POINTS)
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [verdict, setVerdict] = useState<Verdict>('Pending')
  const [is3d, setIs3d] = useState(true)

  const loc = analysis?.location
  const demo = isDemo || !loc

  const geo = useMemo(() => ({
    site: fc(box(SITE, 0.9, 1.1, 'WCT-1 site (approximate)')),
    zoi: fc(circle(SITE, 5, 'Zone of influence 5 km')),
    borrow: fc(box(BORROW.center, BORROW.wKm, BORROW.hKm, 'Sand borrow area (approximate)')),
    plume: fc(boxBuffer(BORROW.center, BORROW.wKm, BORROW.hKm, 4, 'Predicted plume extent 4 km')),
  }), [])

  // Report mode: a ring of the stated radius around each located point (a corridor for linear projects),
  // or a ±3 km uncertainty ring when the location only comes from a place name.
  const zone = useMemo(() => {
    if (!loc?.center) return null
    if (loc.source === 'place') return fc(circle(loc.center, loc.place?.uncertaintyKm ?? 5, 'Approximate location'))
    if (!loc.radius) return null
    const pts = loc.points.length ? loc.points.slice(0, 120).map((p) => [p.lng, p.lat] as [number, number]) : [loc.center]
    return fc(...pts.map((c) => circle(c, loc.radius!.km, 'Study area', 48)))
  }, [loc])

  const image = useMemo(() => overlay && {
    url: overlay.url,
    coords: [[overlay.bounds[0], overlay.bounds[3]], [overlay.bounds[2], overlay.bounds[3]], [overlay.bounds[2], overlay.bounds[1]], [overlay.bounds[0], overlay.bounds[1]]] as [number, number][],
  }, [overlay])
  useEffect(() => () => { if (overlay) URL.revokeObjectURL(overlay.url) }, [overlay])

  if (!analysis) return null
  const layers = demo ? DEMO_LAYERS : reportLayers(loc!)
  const claims = demo ? DEMO_CLAIMS(analysis.labels) : reportClaims(loc!)
  const c = demo ? BORROW.center : loc!.center ?? [79.86, 6.93]
  const defaultBounds = [c[0] - 0.08, c[1] - 0.07, c[0] + 0.08, c[1] + 0.07].map((v) => v.toFixed(2)).join(', ')
  const status = demo ? 'WCT-1 demo geometry · all shapes approximate'
    : loc!.source === 'coordinates' ? `Located from ${loc!.points.length} coordinates in this report`
    : loc!.source === 'place' ? `Approximate: placed at ${loc!.place!.name} by name` : 'No location found in this report'

  const cite = (ev?: Evidence) => ev && (
    <button type="button" onClick={() => openEvidence({ pdfPage: ev.pdfPage, quote: ev.quote })} className="text-link underline-offset-4 hover:underline">
      p. {ev.label ?? ev.pdfPage}
    </button>
  )

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] [&>*]:min-w-0">
      <section aria-label="Verify map" className="relative h-[72vh] min-h-[480px] overflow-hidden rounded-[var(--radius-card)] bg-card">
        <Map key={demo ? 'demo' : `report-${analysis.analysedAt}`} center={demo ? [79.83, 6.99] : (loc!.center ?? [80.7, 7.8])} zoom={demo ? 11.2 : loc!.center ? 11 : 7} pitch={62} bearing={-25} maxPitch={75}>
          <Camera is3d={is3d} />
          {!demo && <FitTo loc={loc!} is3d={is3d} />}
          {is3d && <Terrain dark={dark} />}
          {is3d && <Buildings dark={dark} />}
          {on.s2 && <RasterLayer id="s2" tiles={S2_TILES} />}
          {on.turbidity && image && <RasterLayer id="turbidity" image={image} opacity={0.6} />}

          {demo ? (
            <>
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
                    <Dot className={`size-5 ${p.kind === 'Air' ? 'bg-mint-300' : p.kind === 'Noise' ? 'bg-mint-50' : 'bg-mint-500'}`}>{p.kind[0]}</Dot>
                  </MarkerContent>
                  <MarkerTooltip>{p.id} · {p.kind} sampling (placeholder)</MarkerTooltip>
                </MapMarker>
              ))}
            </>
          ) : (
            <>
              {on.zone && zone && (
                <MapGeoJSON id="zone" data={zone} fillPaint={{ 'fill-color': ink.zoi, 'fill-opacity': loc!.source === 'place' ? 0.06 : 0.05 }} linePaint={{ 'line-color': ink.zoi, 'line-width': 1.5, 'line-dasharray': [2, 2] }} />
              )}
              {is3d && on.zone && zone && <Extrude id="zone-3d" data={zone} color={ink.zoi} height={300} opacity={0.08} />}
              {on.located && loc!.points.slice(0, 150).map((p, i) => (
                <MapMarker key={`${p.lat},${p.lng},${i}`} longitude={p.lng} latitude={p.lat} onClick={() => openEvidence({ pdfPage: p.pdfPage, quote: p.quote })}>
                  <MarkerContent><Dot className="size-3.5 bg-mint-500" /></MarkerContent>
                  <MarkerTooltip>{p.lat.toFixed(5)}° N, {p.lng.toFixed(5)}° E · p. {p.label ?? p.pdfPage} · click to open</MarkerTooltip>
                </MapMarker>
              ))}
              {on.located && loc!.place && (
                <MapMarker longitude={loc!.place.lng} latitude={loc!.place.lat} onClick={() => openEvidence({ pdfPage: loc!.place!.evidence.pdfPage, quote: loc!.place!.evidence.quote })}>
                  <MarkerContent>
                    <Dot className="size-4 bg-mint-50" />
                    <MarkerLabel position="top" className="rounded-full bg-mint-50 px-2 py-0.5 text-[11.5px] text-on-mint">{loc!.place.name} (from place names, approximate)</MarkerLabel>
                  </MarkerContent>
                </MapMarker>
              )}
            </>
          )}
          <MapControls position="bottom-right" showCompass showFullscreen />
        </Map>
        <span className="pointer-events-none absolute top-4 left-4 max-w-[calc(100%-9rem)] rounded-full bg-card/90 px-3 py-1.5 text-[12.5px] text-ink">
          {status}{is3d && ' · heights illustrative'}
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
            {layers.map((l) => (
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
            {claims.map((cl, i) => (
              <li key={cl.claim} className="rounded-[20px] bg-card-2 p-3.5">
                <p className="leading-snug">{cl.claim} {cl.ev && <span className="text-ink-2">({cite(cl.ev)})</span>}</p>
                <p className="mt-1 text-[12.5px] text-ink-2">{cl.check}</p>
                {i === 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label={`Verdict for: ${cl.claim}`}>
                    {(['Pending', 'Consistent', 'Exceeds'] as Verdict[]).map((v) => (
                      <button key={v} type="button" aria-pressed={verdict === v} onClick={() => setVerdict(v)}
                        className={`rounded-full px-3 py-1 text-[12.5px] ${verdict === v ? 'bg-mint-50 font-medium text-on-mint' : 'border border-line-strong text-ink-2 hover:text-ink'}`}>
                        {v === 'Exceeds' && !demo ? 'Wrong' : v}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="text-[12.5px] text-ink-2">The planner sets each verdict by eye. Satellite imagery is indicative unless calibrated against field data.</p>
        </Card>

        <Card icon={MapIcon} title="Satellite overlay" aside={overlay ? <OutlinePill>{overlay.name}</OutlinePill> : undefined}>
          <OverlayForm key={defaultBounds} defaultBounds={defaultBounds} onLoad={(o) => { setOverlay(o); setOn((s) => ({ ...s, turbidity: true })) }} />
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            Make one with <code className="rounded bg-card-2 px-1">scripts/gee_turbidity.js</code> in the Google Earth Engine code editor (Sentinel-2 red-band index, Nechad-style); set its area to the bounds above.
          </p>
        </Card>
      </div>
    </div>
  )
}
