#!/usr/bin/env python3
"""
Generate route data from EMODnet bathymetry:
1. Depth contour GeoJSON (5, 10, 20, 50, 100m) for map display
2. A* routes between consecutive ports using depth data
"""

import json
import os
import numpy as np
from osgeo import gdal
import heapq

gdal.UseExceptions()

TIFF_PATH = "/tmp/emodnet.tiff"
OUTPUT_DIR = "public/data"
MIN_DEPTH = -5.0     # min safe depth (negative = below sea)
IDEAL_DEPTH = -15.0  # preferred routing depth

# Ports in coastal order
PORTS = [
    ("Gijón",           43.5453, -5.6621),
    ("Candás",          43.5883, -5.7617),
    ("Cabo Peñas",      43.6553, -5.8492),
    ("Luanco",          43.6117, -5.7917),
    ("Avilés",          43.5917, -5.9250),
    ("Cudillero",       43.5633, -6.1500),
    ("Luarca",          43.5417, -6.5333),
    ("Navia",           43.5500, -6.7283),
    ("Ribadeo",         43.5350, -7.0417),
    ("Foz",             43.5717, -7.2550),
    ("Viveiro",         43.6617, -7.5950),
    ("Estaca de Bares", 43.7883, -7.6850),
    ("Cabo Ortegal",    43.7700, -7.8700),
    ("Cariño",          43.7367, -7.8667),
    ("Cedeira",         43.6600, -8.0567),
    ("Ferrol",          43.4833, -8.2333),
    ("La Coruña",       43.3700, -8.4000),
]


def load_depth():
    ds = gdal.Open(TIFF_PATH)
    band = ds.GetRasterBand(1)
    data = band.ReadAsArray().astype(np.float32)
    gt = ds.GetGeoTransform()
    nodata = band.GetNoDataValue()
    if nodata is not None:
        data[data == nodata] = 0
    data[data > 0] = 0  # land = 0
    return data, gt


def gen_contours():
    """Generate depth contour lines as GeoJSON."""
    import subprocess
    tmp = "/tmp/contours_raw.geojson"
    subprocess.run([
        "gdal_contour", "-a", "depth",
        "-fl", "-200", "-100", "-50", "-20", "-10", "-5",
        TIFF_PATH, tmp, "-f", "GeoJSON"
    ], check=True, capture_output=True)

    with open(tmp) as f:
        data = json.load(f)

    for feat in data["features"]:
        coords = feat["geometry"]["coordinates"]
        if feat["geometry"]["type"] == "LineString":
            feat["geometry"]["coordinates"] = [[round(c[0], 4), round(c[1], 4)] for c in coords]
        elif feat["geometry"]["type"] == "MultiLineString":
            feat["geometry"]["coordinates"] = [
                [[round(c[0], 4), round(c[1], 4)] for c in line] for line in coords
            ]
        feat["properties"]["depth"] = abs(feat["properties"]["depth"])

    data["features"] = [
        f for f in data["features"]
        if (f["geometry"]["type"] == "LineString" and len(f["geometry"]["coordinates"]) >= 3)
        or (f["geometry"]["type"] == "MultiLineString"
            and any(len(line) >= 3 for line in f["geometry"]["coordinates"]))
    ]

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out = f"{OUTPUT_DIR}/contours.json"
    with open(out, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"Contours: {len(data['features'])} features, {os.path.getsize(out)/1024:.0f} KB")


def compute_routes():
    """A* routing on downsampled depth grid."""
    data, gt = load_depth()
    rows, cols = data.shape
    xmin, xres, _, ymax, _, yres_neg = gt
    yres = abs(yres_neg)

    # Use full resolution — needed to preserve narrow straits/ría entrances
    STEP = 1
    grid = data[::STEP, ::STEP]
    gr, gc = grid.shape
    gxres = xres * STEP
    gyres = yres * STEP

    print(f"Grid: {gr}x{gc} ({STEP}x downsampled)")

    def ll_to_rc(lat, lon):
        c = int((lon - xmin) / gxres)
        r = int((ymax - lat) / gyres)
        return max(0, min(r, gr-1)), max(0, min(c, gc-1))

    def rc_to_ll(r, c):
        lon = xmin + c * gxres + gxres / 2
        lat = ymax - r * gyres - gyres / 2
        return (round(lat, 5), round(lon, 5))

    def find_water(r, c):
        """Find nearest DEEP OPEN water cell (< -20m) to avoid coastal pockets.
        Ports are often in bays that are disconnected in the grid."""
        if 0 <= r < gr and 0 <= c < gc and grid[r, c] < -20:
            return r, c
        for radius in range(1, 120):
            best = None
            best_depth = 0
            for dr in range(-radius, radius+1):
                for dc in range(-radius, radius+1):
                    if abs(dr) != radius and abs(dc) != radius:
                        continue
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < gr and 0 <= nc < gc and grid[nr, nc] < -20:
                        if grid[nr, nc] < best_depth:
                            best_depth = grid[nr, nc]
                            best = (nr, nc)
            if best:
                return best
        # Fallback: any water > 5m deep
        for radius in range(1, 120):
            for dr in range(-radius, radius+1):
                for dc in range(-radius, radius+1):
                    if abs(dr) != radius and abs(dc) != radius:
                        continue
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < gr and 0 <= nc < gc and grid[nr, nc] < -5:
                        return nr, nc
        return r, c

    DIRS = [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]

    def astar(start_ll, end_ll, max_iter=500000):
        sr, sc = find_water(*ll_to_rc(*start_ll))
        er, ec = find_water(*ll_to_rc(*end_ll))

        open_set = [(0.0, sr, sc)]
        g_score = np.full((gr, gc), np.inf, dtype=np.float32)
        g_score[sr, sc] = 0
        # Store came_from as 2D arrays for speed
        came_from_r = np.full((gr, gc), -1, dtype=np.int16)
        came_from_c = np.full((gr, gc), -1, dtype=np.int16)
        visited = np.zeros((gr, gc), dtype=bool)
        iterations = 0

        while open_set and iterations < max_iter:
            f, cr, cc = heapq.heappop(open_set)
            if visited[cr, cc]:
                continue
            visited[cr, cc] = True
            iterations += 1

            if abs(cr - er) <= 1 and abs(cc - ec) <= 1:
                # Reconstruct
                path = [end_ll]
                r, c = cr, cc
                while came_from_r[r, c] >= 0:
                    path.append(rc_to_ll(r, c))
                    pr, pc = came_from_r[r, c], came_from_c[r, c]
                    r, c = pr, pc
                path.append(start_ll)
                path.reverse()
                return simplify_path(path)

            for dr, dc in DIRS:
                nr, nc = cr + dr, cc + dc
                if nr < 0 or nr >= gr or nc < 0 or nc >= gc or visited[nr, nc]:
                    continue
                d = grid[nr, nc]
                if d >= -2:  # land or too shallow
                    continue

                move = 1.414 if (dr != 0 and dc != 0) else 1.0

                # Depth preference: prefer ~10-20m, mild penalty for deep
                if d > IDEAL_DEPTH:
                    depth_pen = (IDEAL_DEPTH - d) * 0.05
                elif d < -100:
                    depth_pen = (-d - 100) * 0.002
                else:
                    depth_pen = 0

                new_g = g_score[cr, cc] + move + depth_pen
                if new_g < g_score[nr, nc]:
                    g_score[nr, nc] = new_g
                    h = ((nr - er)**2 + (nc - ec)**2) ** 0.5
                    heapq.heappush(open_set, (new_g + h, nr, nc))
                    came_from_r[nr, nc] = cr
                    came_from_c[nr, nc] = cc

        if iterations >= max_iter:
            print(f"  max iterations reached ({max_iter})")
        else:
            print(f"  WARNING: no route found ({iterations} iterations)")
        return [start_ll, end_ll]

    def simplify_path(path, tolerance=0.003):
        """Douglas-Peucker simplification."""
        if len(path) <= 2:
            return path

        # Find point with max distance from line start→end
        start = np.array(path[0])
        end = np.array(path[-1])
        line = end - start
        line_len = np.linalg.norm(line)
        if line_len == 0:
            return [path[0], path[-1]]

        max_dist = 0
        max_idx = 0
        for i in range(1, len(path) - 1):
            p = np.array(path[i])
            dist = abs(np.cross(line, start - p)) / line_len
            if dist > max_dist:
                max_dist = dist
                max_idx = i

        if max_dist > tolerance:
            left = simplify_path(path[:max_idx+1], tolerance)
            right = simplify_path(path[max_idx:], tolerance)
            return left[:-1] + right
        else:
            return [path[0], path[-1]]

    routes = {}
    for i in range(len(PORTS) - 1):
        key = f"{PORTS[i][0]} → {PORTS[i+1][0]}"
        print(f"  {key}...", end=" ", flush=True)
        path = astar(
            (PORTS[i][1], PORTS[i][2]),
            (PORTS[i+1][1], PORTS[i+1][2])
        )
        routes[key] = path
        print(f"{len(path)} pts")

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out = f"{OUTPUT_DIR}/routes.json"
    with open(out, "w") as f:
        json.dump(routes, f, separators=(",", ":"))
    print(f"Routes: {len(routes)} segments, {os.path.getsize(out)/1024:.0f} KB")


if __name__ == "__main__":
    print("=== Contours ===")
    gen_contours()
    print("\n=== Routes ===")
    compute_routes()
    print("\nDone!")
