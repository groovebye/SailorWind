#!/bin/bash
# Quick health check for external services used by SailorWind
echo "=== SailorWind External Services Health Check ==="
echo ""

check() {
  local name="$1"
  local url="$2"
  local code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null)
  if [ "$code" = "200" ]; then
    echo "✓ $name — OK ($code)"
  elif [ "$code" = "000" ]; then
    echo "✗ $name — UNREACHABLE (connection failed)"
  else
    echo "⚠ $name — HTTP $code"
  fi
}

check "OpenSeaMap Tiles" "https://tiles.openseamap.org/seamark/10/512/384.png"
check "Open-Meteo Weather" "https://api.open-meteo.com/v1/forecast?latitude=43.5&longitude=-5.6&hourly=wind_speed_10m&forecast_days=1"
check "Open-Meteo Marine" "https://marine-api.open-meteo.com/v1/marine?latitude=43.5&longitude=-5.6&hourly=wave_height&forecast_days=1"
check "Windy API" "https://api.windy.com/api/point-forecast/v2"
check "EMODnet WMS" "https://ows.emodnet-bathymetry.eu/wms?service=WMS&request=GetCapabilities"
check "CartoDB Tiles" "https://a.basemaps.cartocdn.com/dark_all/10/512/384.png"
check "Windy Webcams" "https://api.windy.com/webcams/api/v3/webcams"

echo ""
echo "Done."
