// Approximate WCT-1 geometries for the Verify map. Every shape here is a placeholder to be
// replaced by digitising the ESIA figures; the map labels them "approximate".

type Ring = [number, number][]
type Poly = GeoJSON.Feature<GeoJSON.Polygon, { name: string }>

const KM_PER_DEG_LAT = 110.574
const kmPerDegLng = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180)

export function circle(center: [number, number], km: number, name: string, steps = 96): Poly {
  const [lng, lat] = center
  const ring: Ring = []
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI
    ring.push([lng + (km * Math.cos(t)) / kmPerDegLng(lat), lat + (km * Math.sin(t)) / KM_PER_DEG_LAT])
  }
  return { type: 'Feature', properties: { name }, geometry: { type: 'Polygon', coordinates: [ring] } }
}

/** Box given by its centre and size in km. */
export function box(center: [number, number], wKm: number, hKm: number, name: string): Poly {
  const [lng, lat] = center
  const dx = wKm / 2 / kmPerDegLng(lat)
  const dy = hKm / 2 / KM_PER_DEG_LAT
  const ring: Ring = [[lng - dx, lat - dy], [lng + dx, lat - dy], [lng + dx, lat + dy], [lng - dx, lat + dy], [lng - dx, lat - dy]]
  return { type: 'Feature', properties: { name }, geometry: { type: 'Polygon', coordinates: [ring] } }
}

/** Exact buffer of an axis-aligned box: the box grown by `km` with quarter-circle corners. */
export function boxBuffer(center: [number, number], wKm: number, hKm: number, km: number, name: string, steps = 24): Poly {
  const [lng, lat] = center
  const kx = kmPerDegLng(lat)
  const corners: [number, number, number][] = [
    [wKm / 2, hKm / 2, 0],
    [-wKm / 2, hKm / 2, Math.PI / 2],
    [-wKm / 2, -hKm / 2, Math.PI],
    [wKm / 2, -hKm / 2, (3 * Math.PI) / 2],
  ]
  const ring: Ring = []
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= steps; i++) {
      const t = a0 + (i / steps) * (Math.PI / 2)
      ring.push([lng + (cx + km * Math.cos(t)) / kx, lat + (cy + km * Math.sin(t)) / KM_PER_DEG_LAT])
    }
  }
  ring.push(ring[0])
  return { type: 'Feature', properties: { name }, geometry: { type: 'Polygon', coordinates: [ring] } }
}

export const fc = (...f: Poly[]): GeoJSON.FeatureCollection<GeoJSON.Polygon, { name: string }> => ({ type: 'FeatureCollection', features: f })

// ponytail: hand-placed from public maps of Colombo Port; replace with digitised ESIA Fig. 1 coordinates.
export const SITE: [number, number] = [79.839, 6.949]
export const BORROW: { center: [number, number]; wKm: number; hKm: number } = { center: [79.775, 7.12], wKm: 4, hKm: 6 }

export interface SamplePoint {
  id: string
  kind: 'Air' | 'Noise' | 'Water'
  lngLat: [number, number]
}

export const SAMPLE_POINTS: SamplePoint[] = [
  { id: 'AQ1', kind: 'Air', lngLat: [79.848, 6.958] },
  { id: 'AQ2', kind: 'Air', lngLat: [79.856, 6.94] },
  { id: 'AQ3', kind: 'Air', lngLat: [79.852, 6.968] },
  { id: 'N1', kind: 'Noise', lngLat: [79.85, 6.95] },
  { id: 'N2', kind: 'Noise', lngLat: [79.861, 6.962] },
  { id: 'SW1', kind: 'Water', lngLat: [79.832, 6.958] },
  { id: 'WS1', kind: 'Water', lngLat: [79.768, 7.13] },
  { id: 'WS14', kind: 'Water', lngLat: [79.782, 7.11] },
  { id: 'WS28', kind: 'Water', lngLat: [79.79, 7.142] },
]
