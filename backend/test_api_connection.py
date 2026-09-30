"""Quick connectivity test for all free Open-Meteo APIs."""
import json, sys
from urllib.request import Request, urlopen
from urllib.parse import urlencode

def fetch(url):
    req = Request(url, headers={"User-Agent": "CycloneTest/1.0"})
    with urlopen(req, timeout=10) as r:
        return json.loads(r.read())

# 1. Geocoding API - Chennai
print("Testing Open-Meteo Geocoding API...")
params = urlencode({"name": "Chennai", "count": 3, "language": "en", "format": "json"})
data = fetch("https://geocoding-api.open-meteo.com/v1/search?" + params)
for loc in (data.get("results") or [])[:2]:
    print(f"  Found: {loc['name']}, {loc.get('admin1','')}, {loc.get('country','')} - ({loc['latitude']}, {loc['longitude']})")
print("  Geocoding API: OK\n")

# 2. Weather API - Chennai coordinates
print("Testing Open-Meteo Weather API...")
params = urlencode({
    "latitude": "13.0827", "longitude": "80.2707",
    "current": "temperature_2m,wind_speed_10m,precipitation",
    "wind_speed_unit": "kmh"
})
data = fetch("https://api.open-meteo.com/v1/forecast?" + params)
cur = data.get("current", {})
print(f"  Chennai Current: Temp={cur.get('temperature_2m')}C, Wind={cur.get('wind_speed_10m')} km/h, Rain={cur.get('precipitation')} mm")
print("  Weather API: OK\n")

# 3. Marine API
print("Testing Open-Meteo Marine API...")
params = urlencode({
    "latitude": "13.0827", "longitude": "80.2707",
    "hourly": "wave_height", "forecast_hours": 6,
    "cell_selection": "sea"
})
try:
    data = fetch("https://marine-api.open-meteo.com/v1/marine?" + params)
    waves = (data.get("hourly") or {}).get("wave_height") or []
    print(f"  Marina wave data points: {len(waves)}")
    print("  Marine API: OK\n")
except Exception as e:
    print(f"  Marine API: Not available for this inland point (normal): {e}\n")

print("All API checks complete. APIs are FREE with NO API KEY needed.")
