/**
 * EIA-Lens: Sentinel-2 turbidity overlay for the WCT-1 sand borrow area (Kerawalapitiya, offshore).
 * Paste into https://code.earthengine.google.com and press Run.
 *
 * INDICATIVE, NOT CALIBRATED TO mg/l. The index below uses the single-band semi-analytical form of
 * Nechad et al. (2010) with generic coefficients for the red band (B4). Without matching field TSS
 * samples (e.g. ESIA Table 9.7, March 2023) the values only show relative turbidity.
 *
 * Output: a PNG (and an optional GeoTIFF) plus its bounds. In EIA-Lens → Verify → Satellite overlay,
 * upload the PNG and paste the printed bounds "west, south, east, north".
 */

// ---- Settings ---------------------------------------------------------------
var START = '2023-01-01'
var END = '2023-12-31'
var MAX_CLOUD = 20 // % per scene

// Approximate borrow area + 4 km plume buffer. Replace with the polygon digitised from ESIA Fig. 1.
var borrow = ee.Geometry.Rectangle([79.7556, 7.093, 79.7944, 7.147])
var aoi = borrow.buffer(4000).bounds()

// Nechad (2010) red-band coefficients for ~665 nm. Re-fit A and C against field TSS before using as mg/l.
var A_RHO = 355.85
var C_RHO = 0.1728

// ---- Imagery ----------------------------------------------------------------
function maskClouds(img) {
  // Scene Classification: drop cloud shadow (3), medium/high cloud (8, 9), cirrus (10); keep water (6).
  var scl = img.select('SCL')
  var ok = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10))
  var water = scl.eq(6)
  return img.updateMask(ok.and(water)).divide(10000).copyProperties(img, ['system:time_start'])
}

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)
  .filterDate(START, END)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', MAX_CLOUD))
  .map(maskClouds)

print('Scenes used', s2.size())

// Surface reflectance → water-leaving reflectance (rho_w = pi * Rrs ≈ pi * SR / pi = SR for this rough index).
var turbidity = s2.map(function (img) {
  var rho = img.select('B4')
  return rho.multiply(A_RHO).divide(ee.Image(1).subtract(rho.divide(C_RHO))).rename('T_index')
}).median().clip(aoi)

// ---- Display & export -------------------------------------------------------
var vis = { min: 0, max: 30, palette: ['0b8a52', '1fd18a', '8ef5c8', 'e8fff4'] }
Map.centerObject(aoi, 11)
Map.addLayer(turbidity, vis, 'Turbidity index (indicative)')
Map.addLayer(ee.Image().paint(borrow, 0, 2), { palette: ['ffffff'] }, 'Borrow area (approx.)')
Map.addLayer(ee.Image().paint(borrow.buffer(4000), 0, 1), { palette: ['ffffff'] }, '4 km plume line (ESIA p. 7-30)')

var bounds = ee.List(aoi.coordinates().get(0))
var west = ee.List(bounds.get(0)).get(0)
var south = ee.List(bounds.get(0)).get(1)
var east = ee.List(bounds.get(2)).get(0)
var north = ee.List(bounds.get(2)).get(1)
print('Bounds for EIA-Lens (west, south, east, north):', ee.String(west).cat(', ').cat(ee.String(south)).cat(', ').cat(ee.String(east)).cat(', ').cat(ee.String(north)))

// PNG for the browser overlay (opens in a new tab; save it).
print('PNG overlay:', turbidity.visualize(vis).getThumbURL({ region: aoi, dimensions: 1024, format: 'png' }))

// Optional GeoTIFF for GIS work (Tasks tab → Run). EIA-Lens draws PNG/JPG only.
Export.image.toDrive({
  image: turbidity,
  description: 'WCT1_turbidity_index_indicative',
  region: aoi,
  scale: 10,
  fileFormat: 'GeoTIFF',
  maxPixels: 1e9,
})
