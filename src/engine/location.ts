import type { Evidence, GeoPoint, Location, Page } from './types'
import { isTocPage, quoteAround } from './text'
import gazetteer from './gazetteer.json'

// ---------- Coordinates written in the report ----------

// Optional leading hemisphere letter ("N 7° 5' 15"", "S 23°…") or trailing one ("7° 5' 15" N").
const DMS = /(?:\b([NSEW])\s?)?(\d{1,3})\s?°\s?(?:(\d{1,2}(?:\.\d+)?)\s?['’′])?\s?(?:(\d{1,2}(?:\.\d+)?)\s?(?:["”″]|''|’’)?)?\s?([NSEW])?(?![A-Za-z])/g
const DEC_PAIR = /(-?\d{1,2}\.\d{4,})\s?°?\s?([NS])?\s*(?:,|;|and|\/)?\s*(-?\d{1,3}\.\d{4,})\s?°?\s?([EW])?/g

interface Coord { value: number; axis: 'lat' | 'lng' | null; letter?: string; at: number; end: number }

function dmsValues(text: string): Coord[] {
  return [...text.matchAll(DMS)].flatMap((m) => {
    const deg = +m[2]
    if (!m[3] && !m[4] && !(m[1] || m[5])) return [] // a bare "45°" is an angle or a slope, not a position
    const value = deg + (m[3] ? +m[3] / 60 : 0) + (m[4] ? +m[4] / 3600 : 0)
    const letter = m[1] ?? m[5]
    const said = letter === 'E' || letter === 'W' ? 'lng' : letter === 'N' || letter === 'S' ? 'lat' : null
    // Degrees above 90 can only be longitude, whatever letter the PDF text attached.
    const axis = deg > 90 ? 'lng' : said
    return [{ value, axis, letter, at: m.index ?? 0, end: (m.index ?? 0) + m[0].length }]
  })
}

// A letter only sets the sign when it fits the role the value ended up in
// (Sampoor's "81° 8'59" S" sits in the longitude slot, so its "S" is noise, not the southern hemisphere).
const signed = (c: Coord, role: 'lat' | 'lng') => c.value * ((role === 'lat' && c.letter === 'S') || (role === 'lng' && c.letter === 'W') ? -1 : 1)

const point = (p: Page, lat: number, lng: number, at: number, end: number): GeoPoint =>
  ({ lat, lng, pdfPage: p.index, label: p.label, quote: quoteAround(p.text, at, end, 50) })

function geographicPairs(p: Page): GeoPoint[] {
  const out: GeoPoint[] = []
  const vals = dmsValues(p.text)
  for (let i = 0; i < vals.length - 1; i++) {
    const a = vals[i]
    const b = vals[i + 1]
    if (b.at - a.end > 40) continue
    // Reports write latitude first; only a longitude-marked first value reverses that.
    const [lat, lng] = a.axis === 'lng' && b.axis !== 'lng' ? [b, a] : [a, b]
    if (lat.value > 90 || lng.value > 180) continue
    out.push(point(p, signed(lat, 'lat'), signed(lng, 'lng'), a.at, b.end))
    i++ // both values used
  }
  for (const m of p.text.matchAll(DEC_PAIR)) {
    let lat = +m[1]
    let lng = +m[3]
    if (!(m[2] || m[4]) && !/coordinat|latitude|location|lat\b|gps/i.test(p.text.slice(Math.max(0, (m.index ?? 0) - 200), m.index))) continue
    if (m[2] === 'S') lat = -Math.abs(lat)
    if (m[4] === 'W') lng = -Math.abs(lng)
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue
    out.push(point(p, lat, lng, m.index ?? 0, (m.index ?? 0) + m[0].length))
  }
  return out
}

// ---------- UTM grid coordinates ----------

/** WGS84 UTM → latitude/longitude (Snyder's series; sub-metre over a zone). */
export function utmToLatLng(easting: number, northing: number, zone: number, south: boolean): [number, number] {
  const a = 6378137
  const f = 1 / 298.257223563
  const k0 = 0.9996
  const e2 = f * (2 - f)
  const ep2 = e2 / (1 - e2)
  const x = easting - 500000
  const y = south ? northing - 10000000 : northing
  const mu = y / k0 / (a * (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256))
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2))
  const phi1 = mu + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) + ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu)
    + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu)
  const s = Math.sin(phi1)
  const c = Math.cos(phi1)
  const t = Math.tan(phi1)
  const N1 = a / Math.sqrt(1 - e2 * s * s)
  const T1 = t * t
  const C1 = ep2 * c * c
  const R1 = (a * (1 - e2)) / (1 - e2 * s * s) ** 1.5
  const D = x / (N1 * k0)
  const lat = phi1 - ((N1 * t) / R1) * ((D * D) / 2 - ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4) / 24
    + ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6) / 720)
  const lng = (D - ((1 + 2 * T1 + C1) * D ** 3) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5) / 120) / c
  return [(lat * 180) / Math.PI, (zone - 1) * 6 - 180 + 3 + (lng * 180) / Math.PI]
}

interface Zone { zone: number; south: boolean }

/** "UTM Zone 44N", "WGS 84 / UTM zone 36S", "UTM 37M" (MGRS band letters: C–M south, N–X north). */
export function utmZone(pages: Page[]): Zone | null {
  for (const p of pages) {
    const m = /\bUTM\s*(?:zone\s*)?(\d{1,2})\s?([C-HJ-NP-X])?\b|\bzone\s*(\d{1,2})\s?([NS])\b/i.exec(p.text)
    if (!m) continue
    const zone = +(m[1] ?? m[3])
    const letter = (m[2] ?? m[4] ?? 'N').toUpperCase()
    if (zone >= 1 && zone <= 60) return { zone, south: letter === 'S' || (letter < 'N' && letter !== 'N') }
  }
  return null
}

const zoneAt = (lat: number, lng: number): Zone => ({ zone: Math.floor((lng + 180) / 6) + 1, south: lat < 0 })

const UTM_INLINE = [
  /(\d{6}(?:\.\d+)?)\s?m\s?E\b\s*[,;]?\s*(\d{6,7}(?:\.\d+)?)\s?m\s?N\b/g, // 371303 mE, 771308 mN
  /\bE\s?[:=]?\s?(\d{6}(?:\.\d+)?)\s*[,;]?\s*N\s?[:=]?\s?(\d{6,7}(?:\.\d+)?)/g, // E 371303 N 771308
]

function utmPairs(p: Page, z: Zone): GeoPoint[] {
  const out: GeoPoint[] = []
  const add = (e: number, n: number, at: number, end: number) => {
    if (e < 100000 || e > 900000 || n > 10000000) return
    const [lat, lng] = utmToLatLng(e, n, z.zone, z.south)
    if (Math.abs(lat) <= 84) out.push(point(p, lat, lng, at, end))
  }
  for (const re of UTM_INLINE) for (const m of p.text.matchAll(re)) add(+m[1], +m[2], m.index ?? 0, (m.index ?? 0) + m[0].length)
  // Tables headed "Easting … Northing": take the number pairs that follow the header.
  const head = p.text.search(/Easting/i)
  if (!out.length && head >= 0 && /Northing/i.test(p.text.slice(head, head + 200))) {
    for (const m of p.text.slice(head).matchAll(/\b(\d{6}(?:\.\d{1,3})?)\s+(\d{6,7}(?:\.\d{1,3})?)\b/g)) add(+m[1], +m[2], head + (m.index ?? 0), head + (m.index ?? 0) + m[0].length)
  }
  return out
}

// ---------- Cleaning ----------

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const kmBetween = (a: { lat: number; lng: number }, lat: number, lng: number) =>
  Math.hypot((a.lat - lat) * 110.6, (a.lng - lng) * 111.3 * Math.cos((lat * Math.PI) / 180))

/** Drop duplicates and strays far from the rest (reference stations, typos). */
function clean(all: GeoPoint[]): GeoPoint[] {
  if (!all.length) return []
  const mLat = median(all.map((p) => p.lat))
  const mLng = median(all.map((p) => p.lng))
  const seen = new Set<string>()
  return all.filter((p) => {
    const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`
    if (seen.has(key) || kmBetween(p, mLat, mLng) > 150) return false
    seen.add(key)
    return true
  })
}

// ---------- Places and countries ----------

type Place = [name: string, lat: number, lng: number, country: string, pop: number]
// Built from Natural Earth populated places (public domain) by scripts/build_gazetteer.py.
const GAZ = gazetteer as unknown as { places: Place[]; countries: Record<string, [number, number]> }

// Small towns Natural Earth leaves out, for the bundled Sri Lankan test reports.
const EXTRA: Place[] = [
  ['Kerawalapitiya', 6.995, 79.875, 'Sri Lanka', 0], ['Kadawatha', 7.001, 79.953, 'Sri Lanka', 0], ['Sampur', 8.49, 81.3, 'Sri Lanka', 0],
  ['Sampoor', 8.49, 81.3, 'Sri Lanka', 0], ['Point Pedro', 9.8167, 80.2333, 'Sri Lanka', 0], ['Mannar', 8.981, 79.9044, 'Sri Lanka', 0],
  ['Kalpitiya', 8.2295, 79.7586, 'Sri Lanka', 0], ['Dambulla', 7.8742, 80.6511, 'Sri Lanka', 0], ['Hambantota', 6.1241, 81.1185, 'Sri Lanka', 0],
]
const PLACES: Place[] = [...GAZ.places, ...EXTRA]

const COUNTRY_ALIASES: Record<string, string> = {
  'United States': 'United States of America', USA: 'United States of America', 'U.S.': 'United States of America',
  UK: 'United Kingdom', 'Great Britain': 'United Kingdom', England: 'United Kingdom', Scotland: 'United Kingdom', Wales: 'United Kingdom',
  'Ivory Coast': "Côte d'Ivoire", "Cote d'Ivoire": "Côte d'Ivoire", 'DRC': 'Democratic Republic of the Congo', 'Lao PDR': 'Laos',
  'Viet Nam': 'Vietnam', 'Republic of Korea': 'South Korea', 'Tanzania': 'United Republic of Tanzania',
}

/** Count capitalised 1–4 word phrases once, so thousands of place names can be looked up cheaply. */
function phraseCounts(pages: Page[]): Map<string, { n: number; page: Page; at: number }> {
  const counts = new Map<string, { n: number; page: Page; at: number }>()
  pages.slice(0, 40).forEach((p, i) => {
    const weight = i < 2 ? 5 : 1 // title pages name the project; later pages name the consultant's office too
    const words = [...p.text.matchAll(/[\p{Lu}][\p{L}'’.-]*/gu)]
    for (let k = 0; k < words.length; k++) {
      let phrase = ''
      for (let len = 0; len < 4 && k + len < words.length; len++) {
        const w = words[k + len]
        if (len && w.index! - (words[k + len - 1].index! + words[k + len - 1][0].length) > 1) break
        phrase = len ? `${phrase} ${w[0]}` : w[0]
        const key = phrase.replace(/[.'’]$/, '')
        const c = counts.get(key)
        if (c) c.n += weight
        else counts.set(key, { n: weight, page: p, at: words[k].index! })
      }
    }
  })
  return counts
}

/** The country the report is about: the most-mentioned country name, title pages weighted. */
export function countryIn(pages: Page[], counts = phraseCounts(pages)): string | null {
  let best: [string, number] | null = null
  const score = (name: string) => counts.get(name)?.n ?? 0
  const totals = new Map<string, number>()
  for (const name of Object.keys(GAZ.countries)) totals.set(name, score(name))
  for (const [alias, name] of Object.entries(COUNTRY_ALIASES)) totals.set(name, (totals.get(name) ?? 0) + score(alias))
  for (const t of totals) if (t[1] > (best?.[1] ?? 1)) best = t
  return best?.[0] ?? null
}

/** Most-mentioned place in the report's country (or anywhere, if no country is named). */
export function placeIn(pages: Page[]): NonNullable<Location['place']> | null {
  const counts = phraseCounts(pages)
  const country = countryIn(pages, counts)
  let best: { place: Place; n: number; page: Page; at: number } | null = null
  for (const pl of PLACES) {
    if (country && pl[3] !== country) continue
    if (pl[0] === country) continue
    const c = counts.get(pl[0])
    if (!c) continue
    // Ties go to the bigger town; without a country context demand more mentions to avoid stray words.
    const n = c.n + Math.log10(pl[4] + 10) / 10
    if (n >= (country ? 2 : 4) && n > (best?.n ?? 0)) best = { place: pl, n, page: c.page, at: c.at }
  }
  if (best) {
    const [name, lat, lng] = best.place
    return { name, lat, lng, country, uncertaintyKm: 5, evidence: { quote: quoteAround(best.page.text, best.at, best.at + name.length, 60), pdfPage: best.page.index, label: best.page.label } }
  }
  if (country && GAZ.countries[country]) {
    const [lat, lng] = GAZ.countries[country]
    const c = counts.get(country)
    const page = c?.page ?? pages[0]
    return { name: `${country} (country only)`, lat, lng, country, uncertaintyKm: 100, evidence: { quote: quoteAround(page.text, c?.at ?? 0, (c?.at ?? 0) + country.length, 60), pdfPage: page.index, label: page.label } }
  }
  return null
}

// ---------- Study-area radius ----------

const RADIUS = /(\d+(?:\.\d+)?)\s?km\s+(?:radi(?:al|us)|buffer)|(?:zone of influence|study area|area of influence|area of direct influence|ZoI|ZOI|AoI)[^.]{0,60}?(\d+(?:\.\d+)?)\s?km/gi

/** The study-area radius the report states (≤ 10 km; larger ones are regional context). */
export function studyRadius(pages: Page[]): Location['radius'] {
  const hits: { km: number; ev: Evidence }[] = []
  for (const p of pages) {
    if (isTocPage(p)) continue
    for (const m of p.text.matchAll(RADIUS)) {
      const km = +(m[1] ?? m[2])
      if (km > 0 && km <= 10) hits.push({ km, ev: { quote: quoteAround(p.text, m.index ?? 0, (m.index ?? 0) + m[0].length, 60), pdfPage: p.index, label: p.label } })
    }
  }
  if (!hits.length) return null
  const counts = new Map<number, number>()
  hits.forEach((h) => counts.set(h.km, (counts.get(h.km) ?? 0) + 1))
  const km = [...counts].sort((a, b) => b[1] - a[1])[0][0]
  return { km, evidence: hits.find((h) => h.km === km)!.ev }
}

export function coordinatesIn(pages: Page[], fallbackZone?: Zone | null): GeoPoint[] {
  const body = pages.filter((p) => !isTocPage(p))
  const geo = body.flatMap(geographicPairs)
  const zone = utmZone(pages) ?? fallbackZone ?? (geo.length ? zoneAt(median(geo.map((g) => g.lat)), median(geo.map((g) => g.lng))) : null)
  const utm = zone ? body.flatMap((p) => utmPairs(p, zone)) : []
  return clean([...geo, ...utm])
}

export function locate(pages: Page[]): Location {
  const radius = studyRadius(pages)
  const place = placeIn(pages)
  // Without a stated UTM zone, the place (or country) tells us which zone grid numbers belong to.
  const points = coordinatesIn(pages, place ? zoneAt(place.lat, place.lng) : null)
  if (points.length) {
    const lats = points.map((p) => p.lat)
    const lngs = points.map((p) => p.lng)
    return {
      source: 'coordinates', points, radius, place: null,
      center: [median(lngs), median(lats)],
      bbox: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
    }
  }
  if (place) return { source: 'place', points: [], radius, place, center: [place.lng, place.lat], bbox: null }
  return { source: 'none', points: [], radius, place: null, center: null, bbox: null }
}
