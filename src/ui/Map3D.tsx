import { useEffect } from 'react'
import { useMap } from '@/components/ui/map'

// Free global elevation tiles (Mapzen terrarium encoding, hosted on AWS Open Data).
const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

/** Real terrain from open elevation tiles, plus hillshade so slopes read in both themes. */
export function Terrain({ exaggeration = 1.6, dark }: { exaggeration?: number; dark: boolean }) {
  const { map, isLoaded } = useMap()
  useEffect(() => {
    if (!map || !isLoaded) return
    const opts = { type: 'raster-dem' as const, tiles: [DEM_TILES], tileSize: 256, encoding: 'terrarium' as const, maxzoom: 14, attribution: 'Terrain: Mapzen / AWS Open Data' }
    map.addSource('dem', opts)
    map.addSource('dem-shade', opts) // separate source so hillshade and terrain do not fight over tile resolution
    const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
    map.addLayer({
      id: 'hillshade', type: 'hillshade', source: 'dem-shade',
      paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': dark ? '#000000' : '#5c5c5c', 'hillshade-highlight-color': dark ? '#3d3d3d' : '#ffffff' },
    }, firstSymbol)
    map.setTerrain({ source: 'dem', exaggeration })
    return () => {
      if (!map.getStyle()) return
      map.setTerrain(null)
      if (map.getLayer('hillshade')) map.removeLayer('hillshade')
      for (const s of ['dem', 'dem-shade']) if (map.getSource(s)) map.removeSource(s)
    }
  }, [map, isLoaded, exaggeration, dark])
  return null
}

/** Basemap buildings pulled up to their mapped height (10 m where none is recorded). */
export function Buildings({ dark }: { dark: boolean }) {
  const { map, isLoaded } = useMap()
  useEffect(() => {
    if (!map || !isLoaded) return
    const src = Object.keys(map.getStyle().sources).find((s) => s === 'protomaps' || s === 'carto' || s === 'openmaptiles')
    if (!src) return
    map.addLayer({
      id: 'buildings-3d', type: 'fill-extrusion', source: src, 'source-layer': src === 'protomaps' ? 'buildings' : 'building', minzoom: 13,
      paint: {
        'fill-extrusion-color': dark ? '#3d3d3d' : '#d6d6d6',
        'fill-extrusion-height': ['coalesce', ['get', 'height'], ['get', 'render_height'], 10],
        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.85,
      },
    })
    return () => {
      if (map.getStyle() && map.getLayer('buildings-3d')) map.removeLayer('buildings-3d')
    }
  }, [map, isLoaded, dark])
  return null
}

interface ExtrudeProps {
  id: string
  data: GeoJSON.FeatureCollection
  color: string
  height: number // metres
  opacity?: number
}

/** One of our own polygons as a solid block. Heights are illustrative and say so in the legend. */
export function Extrude({ id, data, color, height, opacity = 0.6 }: ExtrudeProps) {
  const { map, isLoaded } = useMap()
  useEffect(() => {
    if (!map || !isLoaded) return
    map.addSource(id, { type: 'geojson', data })
    map.addLayer({ id, type: 'fill-extrusion', source: id, paint: { 'fill-extrusion-color': color, 'fill-extrusion-height': height, 'fill-extrusion-base': 0, 'fill-extrusion-opacity': opacity } })
    return () => {
      if (!map.getStyle()) return
      if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource(id)) map.removeSource(id)
    }
  }, [map, isLoaded, id, data, color, height, opacity])
  return null
}

/** Tilt the camera in or out when the 2D/3D switch flips. */
export function Camera({ is3d }: { is3d: boolean }) {
  const { map, isLoaded } = useMap()
  useEffect(() => {
    if (!map || !isLoaded) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    map.easeTo({ pitch: is3d ? 62 : 0, bearing: is3d ? -25 : 0, duration: reduce ? 0 : 900 })
  }, [map, isLoaded, is3d])
  return null
}
