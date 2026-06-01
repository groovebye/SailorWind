#!/usr/bin/env python3
"""
Extract depth-contour lines (isobaths) from EMODnet bathymetry as GeoJSON, so
the chart can draw subtle, per-depth-coloured contour lines (EMODnet's own WMS
contours are all one colour). Land is left untouched — only sea isobaths.

Run with the contourpy venv:
  /tmp/cenv/bin/python scripts/build-contours.py
Output: public/depth-contours.geojson
"""
import json, math, os, urllib.request
import numpy as np, rasterio, contourpy
from rasterio.io import MemoryFile
from shapely.geometry import LineString

LATMIN, LATMAX = 35.9, 43.8
LONMIN, LONMAX = -10.2, -5.2
RES = 0.008                       # ~0.9 km — smooth, light contours
LEVELS = [-10, -20, -50, -100, -200]
SIMPLIFY = 0.004                  # degrees (~0.25 km)
MINLEN = 0.03                     # drop fragments shorter than ~1.8 km
WCS = ("https://ows.emodnet-bathymetry.eu/wcs?service=WCS&version=2.0.1"
       "&request=GetCoverage&coverageId=emodnet__mean&format=image/tiff")

COLS = round((LONMAX - LONMIN) / RES)
ROWS = round((LATMAX - LATMIN) / RES)
print(f"grid {ROWS} x {COLS} @ {RES}°", flush=True)
elev = np.full((ROWS, COLS), 9999.0, dtype=np.float32)

def fetch(lat0, lat1, lon0, lon1, n):
    url = f"{WCS}&subset=Lat({lat0},{lat1})&subset=Long({lon0},{lon1})&SCALESIZE=i({n}),j({n})"
    for a in range(3):
        try:
            with urllib.request.urlopen(url, timeout=90) as r:
                return r.read()
        except Exception as e:
            if a == 2: raise
            print(f"  retry {lat0},{lon0}: {e}", flush=True)

n = round(1 / RES)
for lat_lo in range(math.floor(LATMIN), math.ceil(LATMAX)):
    for lon_lo in range(math.floor(LONMIN), math.ceil(LONMAX)):
        with MemoryFile(fetch(lat_lo, lat_lo + 1, lon_lo, lon_lo + 1, n)) as mf, mf.open() as ds:
            arr = ds.read(1).astype(np.float32); T = ds.transform; H, W = arr.shape
            lons = T.c + (np.arange(W) + 0.5) * T.a
            lats = T.f + (np.arange(H) + 0.5) * T.e
            cidx = np.round((lons - LONMIN) / RES - 0.5).astype(int)
            ridx = np.round((LATMAX - lats) / RES - 0.5).astype(int)
            cm = (cidx >= 0) & (cidx < COLS); rm = (ridx >= 0) & (ridx < ROWS)
            if cm.any() and rm.any():
                elev[np.ix_(ridx[rm], cidx[cm])] = arr[np.ix_(np.where(rm)[0], np.where(cm)[0])]

lons = LONMIN + (np.arange(COLS) + 0.5) * RES
lats_asc = (LATMAX - (np.arange(ROWS) + 0.5) * RES)[::-1]   # ascending for contourpy
z = elev[::-1]
gen = contourpy.contour_generator(x=lons, y=lats_asc, z=z, line_type=contourpy.LineType.Separate)

features = []
for lev in LEVELS:
    kept = 0
    for line in gen.lines(lev):
        ls = LineString(line).simplify(SIMPLIFY, preserve_topology=False)
        if ls.is_empty or ls.length < MINLEN:
            continue
        coords = [[round(x, 4), round(y, 4)] for x, y in ls.coords]
        if len(coords) < 2:
            continue
        features.append({"type": "Feature", "properties": {"d": abs(lev)},
                         "geometry": {"type": "LineString", "coordinates": coords}})
        kept += 1
    print(f"  {abs(lev):>3} m: {kept} lines", flush=True)

fc = {"type": "FeatureCollection", "features": features}
out = os.path.join(os.path.dirname(__file__), "..", "public", "depth-contours.geojson")
with open(out, "w") as f:
    json.dump(fc, f, separators=(",", ":"))
print(f"wrote {out}: {len(features)} lines, {os.path.getsize(out)//1024} KB", flush=True)

# ---- filled depth-band POLYGONS (vector → crisp at any zoom, exact zone
# boundaries). Polygonise a banded raster; land/no-data left out. ----
from rasterio.features import shapes
from rasterio.transform import from_origin
from shapely.geometry import shape as shp_shape, mapping

depth = -elev                              # positive = sea depth; <=0 = land/no-data
band = np.zeros((ROWS, COLS), np.uint8)
for idx, (lo, hi) in enumerate([(0, 5), (5, 10), (10, 20), (20, 50), (50, 200), (200, 1e9)], start=1):
    band[(depth > lo) & (depth <= hi)] = idx
transform = from_origin(LONMIN, LATMAX, RES, RES)
MINAREA = 4e-5                             # deg² — drop slivers (~a few km²)

def rnd(o):
    if isinstance(o, (list, tuple)): return [rnd(v) for v in o]
    return round(o, 4) if isinstance(o, float) else o

bfeat = []
for geom, val in shapes(band, mask=(band > 0), transform=transform, connectivity=4):
    poly = shp_shape(geom).simplify(SIMPLIFY)
    if poly.is_empty or poly.area < MINAREA:
        continue
    g = mapping(poly); g["coordinates"] = rnd(g["coordinates"])
    bfeat.append({"type": "Feature", "properties": {"b": int(val)}, "geometry": g})
bout = os.path.join(os.path.dirname(__file__), "..", "public", "depth-bands.geojson")
with open(bout, "w") as f:
    json.dump({"type": "FeatureCollection", "features": bfeat}, f, separators=(",", ":"))
print(f"wrote {bout}: {len(bfeat)} polygons, {os.path.getsize(bout)//1024} KB", flush=True)
