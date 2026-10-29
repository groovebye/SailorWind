#!/usr/bin/env python3
"""
IJsselmeer / Markermeer isobaths (water depth 2, 3, 5 m at the winter lake
level) from the Rijkswaterstaat 2022 bathymetry (CC0), merged into
public/depth-contours.geojson as features with properties {d, region: "nl"}.
Re-running replaces the previous NL features and keeps the EMODnet ones.

Usage: python build-contours-nl.py <ijg2022.tif>
"""
import json, sys
import numpy as np
import rasterio
import contourpy
from pyproj import Transformer
from scipy import ndimage

LAKE_LEVEL_NAP = -0.40
LEVELS = [2, 3, 5]          # metres of water
STEP = 3                    # 20 m pixels -> 60 m working grid
SIMPLIFY_DEG = 0.00025      # ~25 m
MIN_LEN_KM = 0.6            # drop tiny rings
OUT = "public/depth-contours.geojson"

def dp(pts, eps):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]
    ab = b - a; n = np.hypot(*ab)
    rel = pts - a
    d = np.abs(ab[0] * rel[:, 1] - ab[1] * rel[:, 0]) / n if n else np.hypot(rel[:, 0], rel[:, 1])
    i = int(d.argmax())
    if d[i] <= eps: return np.array([a, b])
    return np.vstack([dp(pts[:i + 1], eps)[:-1], dp(pts[i:], eps)])

with rasterio.open(sys.argv[1]) as src:
    bed = src.read(1).astype("float64")
    T = src.transform
valid = bed < 1e300
depth = np.where(valid, LAKE_LEVEL_NAP - bed, -5.0)       # land/no data = "dry"
depth = ndimage.uniform_filter(depth, size=STEP)[::STEP, ::STEP]
rows, cols = depth.shape
xs = T.c + (np.arange(cols) * STEP + STEP / 2) * T.a
ys = T.f + (np.arange(rows) * STEP + STEP / 2) * T.e
gen = contourpy.contour_generator(xs, ys, depth)
to_ll = Transformer.from_crs("EPSG:28992", "EPSG:4326", always_xy=True)

feats = []
for lv in LEVELS:
    for line in gen.lines(lv):
        if len(line) < 4: continue
        lon, lat = to_ll.transform(line[:, 0], line[:, 1])
        pts = dp(np.column_stack([lon, lat]), SIMPLIFY_DEG)
        km = np.sum(np.hypot(np.diff(pts[:, 0]) * 67.5, np.diff(pts[:, 1]) * 111.2))
        if km < MIN_LEN_KM: continue
        feats.append({"type": "Feature", "properties": {"d": lv, "region": "nl"},
                      "geometry": {"type": "LineString", "coordinates": [[round(x, 5), round(y, 5)] for x, y in pts]}})

fc = json.load(open(OUT))
fc["features"] = [f for f in fc["features"] if f.get("properties", {}).get("region") != "nl"] + feats
with open(OUT, "w") as f:
    json.dump(fc, f, separators=(",", ":"))
print(f"{len(feats)} NL isobaths ({', '.join(f'{lv} m: {sum(1 for x in feats if x["properties"]["d"] == lv)}' for lv in LEVELS)}) -> {OUT}")
