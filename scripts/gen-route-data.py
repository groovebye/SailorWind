#!/usr/bin/env python3
"""
Generate sailing routes: straight lines + headland avoidance.

Key insight: ports are ON LAND in EMODnet grid (~200m resolution).
So first we find the nearest open-water point for each port,
then route between the open-water points using visibility checks.
"""

import json, os, math
import numpy as np
from osgeo import gdal

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


class DepthGrid:
    def __init__(self, tiff_path):
        ds = gdal.Open(tiff_path)
        band = ds.GetRasterBand(1)
        self.data = band.ReadAsArray().astype(np.float32)
        gt = ds.GetGeoTransform()
        self.xmin = gt[0]
        self.xres = gt[1]
        self.ymax = gt[3]
        self.yres = abs(gt[5])
        self.rows, self.cols = self.data.shape
        nodata = band.GetNoDataValue()
        if nodata is not None:
            self.data[self.data == nodata] = 0
        self.data[self.data > 0] = 0

    def depth_at(self, lat, lon):
        c = int((lon - self.xmin) / self.xres)
        r = int((self.ymax - lat) / self.yres)
        if 0 <= r < self.rows and 0 <= c < self.cols:
            return float(self.data[r, c])
        return 0.0

    def is_sea(self, lat, lon):
        return self.depth_at(lat, lon) < -3

    def is_deep_sea(self, lat, lon):
        """At least 8m depth and surrounded by water."""
        if self.depth_at(lat, lon) >= -8:
            return False
        # Check small neighborhood
        for d in [-0.003, 0, 0.003]:
            for e in [-0.003, 0, 0.003]:
                if self.depth_at(lat + d, lon + e) >= -3:
                    return False
        return True

    def find_sea_point(self, lat, lon):
        """Find nearest open-water point with good depth."""
        if self.is_deep_sea(lat, lon):
            return (lat, lon)
        # Search outward in concentric circles
        for radius_steps in range(1, 80):
            dist = radius_steps * 0.003  # ~330m steps
            best = None
            best_depth = 0
            for angle in range(0, 360, 10):
                a = math.radians(angle)
                nlat = lat + dist * math.cos(a)
                nlon = lon + dist * math.sin(a)
                d = self.depth_at(nlat, nlon)
                if d < -8 and d < best_depth:
                    # Check it's not a narrow channel
                    if self.is_deep_sea(nlat, nlon):
                        best_depth = d
                        best = (nlat, nlon)
            if best:
                return best
        return (lat, lon)  # fallback

    def line_hits_land(self, lat1, lon1, lat2, lon2, steps=200):
        """
        Check if line crosses land. Returns None if clear,
        or (lat, lon, fraction) of the MIDDLE of the land obstacle.
        """
        lats = np.linspace(lat1, lat2, steps)
        lons = np.linspace(lon1, lon2, steps)

        land_start = None
        land_end = None
        for i in range(steps):
            if not self.is_sea(lats[i], lons[i]):
                if land_start is None:
                    land_start = i
                land_end = i

        if land_start is None:
            return None  # clear!

        mid = (land_start + land_end) // 2
        return (lats[mid], lons[mid], mid / steps)

    def find_bypass(self, land_lat, land_lon, from_lat, from_lon, to_lat, to_lon):
        """
        Find a waypoint to bypass a land obstacle.
        Try both perpendicular directions, pick the one that works.
        """
        dlat = to_lat - from_lat
        dlon = to_lon - from_lon
        norm = math.sqrt(dlat**2 + dlon**2)
        if norm == 0:
            return None
        # Perpendicular directions
        perps = [
            (-dlon / norm, dlat / norm),   # left
            (dlon / norm, -dlat / norm),   # right
        ]

        for perp in perps:
            for dist_steps in range(4, 50):
                dist = dist_steps * 0.004  # ~440m steps
                nlat = land_lat + perp[0] * dist
                nlon = land_lon + perp[1] * dist
                if self.is_deep_sea(nlat, nlon):
                    return (nlat, nlon)

        return None


def build_route(grid, port_start, port_end):
    """
    Build route:
    1. Find open-water points near each port
    2. Try straight line between them
    3. If land blocking, add bypass waypoint, repeat
    """
    sea_start = grid.find_sea_point(*port_start)
    sea_end = grid.find_sea_point(*port_end)

    path = [sea_start, sea_end]

    for iteration in range(15):
        new_path = [path[0]]
        changed = False

        for i in range(len(path) - 1):
            p1 = path[i]
            p2 = path[i + 1]

            hit = grid.line_hits_land(p1[0], p1[1], p2[0], p2[1])

            if hit is None:
                new_path.append(p2)
            else:
                changed = True
                land_lat, land_lon, _ = hit
                bypass = grid.find_bypass(land_lat, land_lon,
                                          p1[0], p1[1], p2[0], p2[1])
                if bypass:
                    new_path.append(bypass)
                new_path.append(p2)

        path = new_path
        if not changed:
            break

    # Add actual port coords as first/last
    final = [port_start] + path + [port_end]

    # Deduplicate close points
    cleaned = [final[0]]
    for p in final[1:]:
        if abs(p[0] - cleaned[-1][0]) > 0.0005 or abs(p[1] - cleaned[-1][1]) > 0.0005:
            cleaned.append(p)

    return cleaned


def verify_route(grid, path):
    """Count land crossings in route (excluding first/last port segments)."""
    crossings = 0
    # Skip first segment (port→sea) and last (sea→port)
    for i in range(1, len(path) - 2):
        if grid.line_hits_land(path[i][0], path[i][1], path[i+1][0], path[i+1][1]):
            crossings += 1
    return crossings


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


if __name__ == "__main__":
    print("=== Loading bathymetry ===")
    grid = DepthGrid(TIFF_PATH)
    print(f"  Grid: {grid.rows}x{grid.cols}")

    print("\n=== Finding sea points for ports ===")
    sea_pts = {}
    for name, lat, lon in PORTS:
        sp = grid.find_sea_point(lat, lon)
        d = grid.depth_at(*sp)
        dist_nm = math.sqrt((sp[0]-lat)**2 + (sp[1]-lon)**2) * 60
        sea_pts[name] = sp
        print(f"  {name:20s} → {sp[0]:.4f}N {abs(sp[1]):.4f}W  depth={d:.0f}m  ({dist_nm:.1f}NM from port)")

    print("\n=== Generating contours ===")
    gen_contours()

    # Manual overrides for complex rías where auto-routing fails
    MANUAL_ROUTES = {
        "Cedeira → Ferrol": [
            (43.6600, -8.0567),  # Cedeira
            (43.6682, -8.0793),  # sea point
            (43.700, -8.060),    # out of ría
            (43.720, -8.090),    # offshore
            (43.700, -8.140),    # heading S
            (43.670, -8.180),    # approaching Ferrol
            (43.630, -8.210),    # ría entrance
            (43.560, -8.225),    # into ría
            (43.510, -8.233),    # Ferrol approach
            (43.4833, -8.2333),  # Ferrol
        ],
        "Ferrol → La Coruña": [
            (43.4833, -8.2333),  # Ferrol
            (43.510, -8.233),    # out of Ferrol
            (43.560, -8.225),    # ría exit
            (43.630, -8.210),    # offshore
            (43.640, -8.250),    # heading SW
            (43.600, -8.300),    #
            (43.550, -8.340),    #
            (43.490, -8.370),    #
            (43.440, -8.390),    #
            (43.400, -8.400),    # approach La Coruña
            (43.3700, -8.4000),  # La Coruña
        ],
        "Ribadeo → Foz": [
            (43.5350, -7.0417),  # Ribadeo
            (43.558, -7.034),    # out of ría
            (43.575, -7.060),    # offshore
            (43.580, -7.120),    #
            (43.585, -7.180),    #
            (43.580, -7.220),    #
            (43.570, -7.250),    # approach Foz
            (43.5717, -7.2550),  # Foz
        ],
        "Foz → Viveiro": [
            (43.5717, -7.2550),  # Foz
            (43.580, -7.260),    # offshore
            (43.600, -7.300),    #
            (43.620, -7.340),    #
            (43.650, -7.390),    #
            (43.670, -7.430),    #
            (43.690, -7.480),    #
            (43.700, -7.530),    #
            (43.705, -7.570),    # Viveiro ría mouth
            (43.6617, -7.5950),  # Viveiro
        ],
    }

    print("\n=== Computing routes ===")
    routes = {}
    all_ok = True
    for i in range(len(PORTS) - 1):
        name_from = PORTS[i][0]
        name_to = PORTS[i + 1][0]
        key = f"{name_from} \u2192 {name_to}"

        if key in MANUAL_ROUTES:
            path = MANUAL_ROUTES[key]
        else:
            path = build_route(grid,
                               (PORTS[i][1], PORTS[i][2]),
                               (PORTS[i+1][1], PORTS[i+1][2]))

        crossings = verify_route(grid, path)
        status = "✓" if crossings == 0 else f"✗ {crossings} land"
        if crossings > 0:
            all_ok = False
        print(f"  {key:35s} {len(path):3d} pts  {status}")

        routes[key] = [(round(lat, 5), round(lon, 5)) for lat, lon in path]

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out = f"{OUTPUT_DIR}/routes.json"
    with open(out, "w") as f:
        json.dump(routes, f, separators=(",", ":"))
    print(f"\n  {'ALL CLEAR!' if all_ok else 'Some routes still cross land'}")
    print(f"  Total: {os.path.getsize(out)//1024} KB")
