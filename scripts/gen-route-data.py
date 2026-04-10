#!/usr/bin/env python3
"""
Generate sailing routes using:
1. Coastline extracted from bathymetry (depth=0 contour)
2. Headland detection (prominence along coastline)
3. Waypoint placement at headlands (target 10m depth)
4. A* routing on depth grid through headland waypoints
5. Depth contour GeoJSON for map display
"""

import json, os, heapq
import numpy as np
from osgeo import gdal
from shapely.geometry import LineString, Point, MultiLineString
from shapely.ops import linemerge

gdal.UseExceptions()

TIFF_PATH = "/tmp/emodnet.tiff"
OUTPUT_DIR = "public/data"

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


def load_tiff():
    ds = gdal.Open(TIFF_PATH)
    band = ds.GetRasterBand(1)
    data = band.ReadAsArray().astype(np.float32)
    gt = ds.GetGeoTransform()
    nodata = band.GetNoDataValue()
    if nodata is not None:
        data[data == nodata] = 0
    data[data > 0] = 0
    return data, gt


# ========== STEP 1: CONTOURS ==========

def gen_contours():
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
    data["features"] = [f for f in data["features"]
                        if (f["geometry"]["type"] == "LineString" and len(f["geometry"]["coordinates"]) >= 3)
                        or (f["geometry"]["type"] == "MultiLineString")]
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out = f"{OUTPUT_DIR}/contours.json"
    with open(out, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"  Contours: {len(data['features'])} features, {os.path.getsize(out)//1024} KB")


# ========== STEP 2: EXTRACT COASTLINE + FIND HEADLANDS ==========

def extract_coastline(data, gt):
    """Extract depth=0 contour as coastline using GDAL."""
    import subprocess, tempfile
    # Write a temp tiff with just land mask
    tmp_contour = "/tmp/coastline_contour.geojson"
    subprocess.run([
        "gdal_contour", "-a", "depth", "-fl", "0",
        TIFF_PATH, tmp_contour, "-f", "GeoJSON"
    ], check=True, capture_output=True)

    with open(tmp_contour) as f:
        gj = json.load(f)

    lines = []
    for feat in gj["features"]:
        geom = feat["geometry"]
        if geom["type"] == "LineString":
            lines.append(LineString(geom["coordinates"]))
        elif geom["type"] == "MultiLineString":
            for coords in geom["coordinates"]:
                lines.append(LineString(coords))

    # Merge into continuous lines
    merged = linemerge(lines)
    if isinstance(merged, LineString):
        coastlines = [merged]
    elif isinstance(merged, MultiLineString):
        coastlines = list(merged.geoms)
    else:
        coastlines = list(merged)

    # Keep only substantial coastlines (>50 points)
    coastlines = [c for c in coastlines if len(c.coords) > 50]
    coastlines.sort(key=lambda c: c.length, reverse=True)
    print(f"  Coastlines: {len(coastlines)} segments, longest: {len(coastlines[0].coords) if coastlines else 0} pts")
    return coastlines


def find_headlands(coastlines, search_radius_deg=0.02, min_prominence_deg=0.005):
    """
    Find headlands (capes) by measuring how much each point "protrudes"
    relative to its neighbors along the coastline.
    """
    headlands = []

    for coast in coastlines:
        coords = list(coast.coords)
        n = len(coords)
        if n < 20:
            continue

        # Compute prominence for each point
        prominences = []
        span = max(5, int(search_radius_deg / 0.002))  # ~10 points at 0.002 deg res

        for i in range(span, n - span):
            pt = Point(coords[i])
            pt_left = Point(coords[i - span])
            pt_right = Point(coords[i + span])
            baseline = LineString([pt_left, pt_right])
            prom = baseline.distance(pt)
            prominences.append((i, prom, coords[i]))

        # Find local maxima of prominence
        for j in range(1, len(prominences) - 1):
            idx, prom, coord = prominences[j]
            if prom < min_prominence_deg:
                continue
            # Must be local maximum
            if prom >= prominences[j-1][1] and prom >= prominences[j+1][1]:
                # Compute outward normal
                pt_left = np.array(coords[idx - span])
                pt_right = np.array(coords[idx + span])
                pt_cur = np.array(coord)
                midpoint = (pt_left + pt_right) / 2
                direction = pt_cur - midpoint
                norm = np.linalg.norm(direction)
                if norm > 0:
                    direction = direction / norm

                headlands.append({
                    'lon': coord[0],
                    'lat': coord[1],
                    'prominence': prom,
                    'direction': direction.tolist(),  # unit vector pointing "out to sea"
                })

    # Cluster nearby headlands (keep the most prominent within 0.02 deg)
    clustered = []
    used = set()
    headlands.sort(key=lambda h: -h['prominence'])
    for i, h in enumerate(headlands):
        if i in used:
            continue
        clustered.append(h)
        for j in range(i+1, len(headlands)):
            if j in used:
                continue
            dist = ((h['lon'] - headlands[j]['lon'])**2 + (h['lat'] - headlands[j]['lat'])**2) ** 0.5
            if dist < 0.02:
                used.add(j)

    print(f"  Headlands found: {len(clustered)}")
    for h in clustered:
        print(f"    {h['lat']:.4f}N {abs(h['lon']):.4f}W prom={h['prominence']:.4f}")
    return clustered


# ========== STEP 3: PLACE WAYPOINTS AT HEADLANDS ==========

def place_headland_waypoints(headlands, data, gt):
    """Place waypoints at 10m depth offshore from each headland."""
    xmin, xres, _, ymax, _, yres_neg = gt
    yres = abs(yres_neg)
    rows, cols = data.shape

    def depth_at_ll(lat, lon):
        c = int((lon - xmin) / xres)
        r = int((ymax - lat) / yres)
        if 0 <= r < rows and 0 <= c < cols:
            return data[r, c]
        return 0

    waypoints = []
    for h in headlands:
        direction = np.array(h['direction'])
        tip = np.array([h['lon'], h['lat']])

        # Search outward from headland tip for ~10m depth
        best = None
        for offset_m in range(200, 5000, 50):  # 200m to 5km
            offset_deg = offset_m / 111000  # rough m->deg
            candidate = tip + direction * offset_deg
            depth = depth_at_ll(candidate[1], candidate[0])

            if depth < -5:  # at least 5m deep
                if best is None or abs(depth - (-10)) < abs(best[2] - (-10)):
                    best = (candidate[0], candidate[1], depth)
                if depth <= -10:  # reached 10m, good enough
                    break

        if best:
            waypoints.append({
                'lat': round(best[1], 5),
                'lon': round(best[0], 5),
                'depth': round(best[2], 1),
                'headland_lat': h['lat'],
                'headland_lon': h['lon'],
                'prominence': h['prominence'],
            })
            print(f"    WP at {best[1]:.4f}N {abs(best[0]):.4f}W depth={best[2]:.1f}m")

    return waypoints


# ========== STEP 4: A* ROUTING WITH MANDATORY HEADLAND WPs ==========

def compute_routes(data, gt, headland_wps):
    rows, cols = data.shape
    xmin, xres, _, ymax, _, yres_neg = gt
    yres = abs(yres_neg)

    def ll_to_rc(lat, lon):
        c = int((lon - xmin) / xres)
        r = int((ymax - lat) / yres)
        return max(0, min(r, rows-1)), max(0, min(c, cols-1))

    def rc_to_ll(r, c):
        return (round(ymax - r * yres - yres/2, 5),
                round(xmin + c * xres + xres/2, 5))

    def find_deep_water(r, c):
        """Find nearest cell with depth < -8m (avoids dead-end bays)."""
        if 0 <= r < rows and 0 <= c < cols and data[r, c] < -8:
            return r, c
        for radius in range(1, 100):
            best = None; best_d = 0
            for dr in range(-radius, radius+1):
                for dc in range(-radius, radius+1):
                    if abs(dr) != radius and abs(dc) != radius:
                        continue
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < rows and 0 <= nc < cols and data[nr, nc] < -8:
                        if data[nr, nc] < best_d:
                            best_d = data[nr, nc]
                            best = (nr, nc)
            if best:
                return best
        return r, c

    DIRS = [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]

    def astar(start_ll, end_ll, max_iter=500000):
        sr, sc = find_deep_water(*ll_to_rc(*start_ll))
        er, ec = find_deep_water(*ll_to_rc(*end_ll))

        open_set = [(0.0, sr, sc)]
        g_score = np.full((rows, cols), np.inf, dtype=np.float32)
        g_score[sr, sc] = 0
        came_r = np.full((rows, cols), -1, dtype=np.int16)
        came_c = np.full((rows, cols), -1, dtype=np.int16)
        visited = np.zeros((rows, cols), dtype=bool)
        iters = 0

        while open_set and iters < max_iter:
            f, cr, cc = heapq.heappop(open_set)
            if visited[cr, cc]:
                continue
            visited[cr, cc] = True
            iters += 1

            if abs(cr - er) <= 1 and abs(cc - ec) <= 1:
                path = [end_ll]
                r, c = cr, cc
                while came_r[r, c] >= 0:
                    path.append(rc_to_ll(r, c))
                    pr, pc = int(came_r[r, c]), int(came_c[r, c])
                    r, c = pr, pc
                path.append(start_ll)
                path.reverse()
                return simplify_path(path)

            for dr, dc in DIRS:
                nr, nc = cr + dr, cc + dc
                if nr < 0 or nr >= rows or nc < 0 or nc >= cols or visited[nr, nc]:
                    continue
                d = data[nr, nc]
                if d >= -2:
                    continue

                move = 1.414 if (dr != 0 and dc != 0) else 1.0

                # Cost function matching Navionics-style preferences
                if d >= -5:     depth_pen = 5.0    # very shallow — high penalty
                elif d >= -8:   depth_pen = 2.0    # shallow
                elif d >= -12:  depth_pen = 0.0    # ideal 8-12m
                elif d >= -20:  depth_pen = 0.5    # acceptable
                elif d >= -50:  depth_pen = 1.0    # getting offshore
                else:           depth_pen = 2.0    # way offshore

                new_g = g_score[cr, cc] + move + depth_pen
                if new_g < g_score[nr, nc]:
                    g_score[nr, nc] = new_g
                    h = ((nr - er)**2 + (nc - ec)**2) ** 0.5
                    heapq.heappush(open_set, (new_g + h, nr, nc))
                    came_r[nr, nc] = cr
                    came_c[nr, nc] = cc

        print(f"    WARNING: no route ({iters} iters)")
        return [start_ll, end_ll]

    def simplify_path(path, tolerance=0.002):
        if len(path) <= 2:
            return path
        start = np.array(path[0])
        end = np.array(path[-1])
        line = end - start
        line_len = np.linalg.norm(line)
        if line_len == 0:
            return [path[0], path[-1]]
        max_dist = 0; max_idx = 0
        for i in range(1, len(path) - 1):
            p = np.array(path[i])
            d = abs((line[0]*(start[1]-p[1]) - line[1]*(start[0]-p[0]))) / line_len
            if d > max_dist:
                max_dist = d; max_idx = i
        if max_dist > tolerance:
            left = simplify_path(path[:max_idx+1], tolerance)
            right = simplify_path(path[max_idx:], tolerance)
            return left[:-1] + right
        return [path[0], path[-1]]

    # For each pair of consecutive ports, find headland waypoints between them
    # and route through them
    routes = {}
    for pi in range(len(PORTS) - 1):
        name_from, lat_from, lon_from = PORTS[pi]
        name_to, lat_to, lon_to = PORTS[pi + 1]
        key = f"{name_from} \u2192 {name_to}"
        print(f"  {key}...", end=" ", flush=True)

        # Find headland waypoints between these two ports
        # (between their longitudes, roughly)
        lon_lo = min(lon_from, lon_to) - 0.05
        lon_hi = max(lon_from, lon_to) + 0.05
        lat_lo = min(lat_from, lat_to) - 0.05
        lat_hi = max(lat_from, lat_to) + 0.05

        intermediate_wps = [
            (wp['lat'], wp['lon']) for wp in headland_wps
            if lon_lo <= wp['lon'] <= lon_hi and lat_lo <= wp['lat'] <= lat_hi
        ]

        # Sort intermediates along the route direction
        if intermediate_wps:
            # Sort by longitude (coast goes E→W, so descending for western ports)
            if lon_to < lon_from:
                intermediate_wps.sort(key=lambda p: -p[1])  # E→W: descending lon
            else:
                intermediate_wps.sort(key=lambda p: p[1])

        # Build checkpoints: start → headland WPs → end
        checkpoints = [(lat_from, lon_from)] + intermediate_wps + [(lat_to, lon_to)]

        full_path = []
        for ci in range(len(checkpoints) - 1):
            seg = astar(checkpoints[ci], checkpoints[ci + 1])
            if full_path and seg:
                seg = seg[1:]  # avoid duplicate join point
            full_path.extend(seg)

        routes[key] = full_path
        print(f"{len(full_path)} pts ({len(intermediate_wps)} headland WPs)")

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out = f"{OUTPUT_DIR}/routes.json"
    with open(out, "w") as f:
        json.dump(routes, f, separators=(",", ":"))
    print(f"  Routes: {len(routes)} segments, {os.path.getsize(out)//1024} KB")


# ========== MAIN ==========

if __name__ == "__main__":
    print("=== Loading bathymetry ===")
    data, gt = load_tiff()
    print(f"  Grid: {data.shape[0]}x{data.shape[1]}")

    print("\n=== Generating contours ===")
    gen_contours()

    print("\n=== Extracting coastline ===")
    coastlines = extract_coastline(data, gt)

    print("\n=== Finding headlands ===")
    headlands = find_headlands(coastlines)

    print("\n=== Placing waypoints at headlands ===")
    headland_wps = place_headland_waypoints(headlands, data, gt)

    print("\n=== Computing A* routes ===")
    compute_routes(data, gt, headland_wps)

    print("\nDone!")
