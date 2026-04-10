#!/usr/bin/env python3
"""
Generate sailing routes using visibility-graph approach:
1. Try straight line between ports
2. If line crosses land, find the headland blocking it
3. Place a waypoint offshore from that headland
4. Recurse: try straight lines to/from the new waypoint
Result: shortest path with minimal waypoints, clearing all headlands.
"""

import json, os
import numpy as np
from osgeo import gdal
from shapely.geometry import LineString, Point

gdal.UseExceptions()

TIFF_PATH = "/tmp/emodnet.tiff"
OUTPUT_DIR = "public/data"
SAFETY_MARGIN = 0.008   # ~0.5 NM safety clearance from land (in degrees)
MAX_RECURSION = 8

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
        self.data[self.data > 0] = 0  # land = 0

    def depth_at(self, lat, lon):
        c = int((lon - self.xmin) / self.xres)
        r = int((self.ymax - lat) / self.yres)
        if 0 <= r < self.rows and 0 <= c < self.cols:
            return float(self.data[r, c])
        return 0.0

    def is_water(self, lat, lon, min_depth=-3):
        return self.depth_at(lat, lon) < min_depth

    def line_crosses_land(self, lat1, lon1, lat2, lon2, n_samples=100):
        """Check if a straight line crosses land. Returns list of land points."""
        land_points = []
        for i in range(n_samples + 1):
            t = i / n_samples
            lat = lat1 + t * (lat2 - lat1)
            lon = lon1 + t * (lon2 - lon1)
            if not self.is_water(lat, lon):
                land_points.append((lat, lon, t))
        return land_points

    def find_headland_tip(self, lat1, lon1, lat2, lon2, land_points):
        """
        Given a line that crosses land, find the most prominent land point
        (the headland tip that must be rounded).
        Returns (lat, lon) of the headland tip.
        """
        if not land_points:
            return None

        # The headland tip is the land point furthest from the straight line
        line = LineString([(lon1, lat1), (lon2, lat2)])
        max_dist = 0
        tip = None
        for lat, lon, t in land_points:
            pt = Point(lon, lat)
            dist = line.distance(pt)
            if dist > max_dist:
                max_dist = dist
                tip = (lat, lon)
        return tip

    def find_safe_waypoint(self, tip_lat, tip_lon, from_lat, from_lon, to_lat, to_lon):
        """
        Place a waypoint offshore from a headland tip.
        Direction: perpendicular to the from→to line, on the sea side.
        """
        # Direction from midpoint of from→to to the tip
        mid_lat = (from_lat + to_lat) / 2
        mid_lon = (from_lon + to_lon) / 2
        dir_lat = tip_lat - mid_lat
        dir_lon = tip_lon - mid_lon
        norm = (dir_lat**2 + dir_lon**2) ** 0.5
        if norm == 0:
            return None
        dir_lat /= norm
        dir_lon /= norm

        # Search outward from tip along this direction
        for offset in range(1, 50):
            step = SAFETY_MARGIN * offset / 3
            wp_lat = tip_lat + dir_lat * step
            wp_lon = tip_lon + dir_lon * step
            if self.is_water(wp_lat, wp_lon, min_depth=-5):
                # Verify we have good clearance — check a small area
                clear = True
                for dlat in [-SAFETY_MARGIN/2, 0, SAFETY_MARGIN/2]:
                    for dlon in [-SAFETY_MARGIN/2, 0, SAFETY_MARGIN/2]:
                        if not self.is_water(wp_lat + dlat, wp_lon + dlon, min_depth=-3):
                            clear = False
                            break
                    if not clear:
                        break
                if clear:
                    return (wp_lat, wp_lon)

        # Fallback: just go further out
        for offset in range(10, 80):
            step = SAFETY_MARGIN * offset / 2
            wp_lat = tip_lat + dir_lat * step
            wp_lon = tip_lon + dir_lon * step
            if self.is_water(wp_lat, wp_lon, min_depth=-5):
                return (wp_lat, wp_lon)

        return None


def build_route(grid, start, end, depth=0):
    """
    Recursive visibility-graph routing:
    1. Try straight line from start to end
    2. If it crosses land, find the headland
    3. Place waypoint offshore from headland
    4. Route start→waypoint and waypoint→end recursively
    """
    lat1, lon1 = start
    lat2, lon2 = end

    if depth > MAX_RECURSION:
        return [start, end]

    land_points = grid.line_crosses_land(lat1, lon1, lat2, lon2, n_samples=200)

    if not land_points:
        # Clear line — no land crossing
        return [start, end]

    # Find the headland tip
    tip = grid.find_headland_tip(lat1, lon1, lat2, lon2, land_points)
    if tip is None:
        return [start, end]

    # Place waypoint offshore from tip
    wp = grid.find_safe_waypoint(tip[0], tip[1], lat1, lon1, lat2, lon2)
    if wp is None:
        return [start, end]

    # Recurse: route through waypoint
    left = build_route(grid, start, wp, depth + 1)
    right = build_route(grid, wp, end, depth + 1)

    # Merge (avoid duplicate waypoint)
    return left + right[1:]


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

    print("\n=== Generating contours ===")
    gen_contours()

    print("\n=== Computing routes (visibility graph) ===")
    routes = {}
    for i in range(len(PORTS) - 1):
        name_from, lat_from, lon_from = PORTS[i]
        name_to, lat_to, lon_to = PORTS[i + 1]
        key = f"{name_from} \u2192 {name_to}"
        print(f"  {key}...", end=" ", flush=True)

        path = build_route(grid, (lat_from, lon_from), (lat_to, lon_to))
        routes[key] = path
        n_wp = len(path) - 2  # minus start and end
        print(f"{len(path)} pts ({n_wp} intermediate WPs)")

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out = f"{OUTPUT_DIR}/routes.json"
    with open(out, "w") as f:
        json.dump(routes, f, separators=(",", ":"))
    print(f"\n  Routes: {len(routes)} segments, {os.path.getsize(out)//1024} KB")
    print("\nDone!")
