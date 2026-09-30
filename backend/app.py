"""
AI-Based Cyclone Compound Local Impact Prediction System - Flask Backend
Uses 100% FREE APIs - No API key required:
  1. Open-Meteo Weather API   : https://api.open-meteo.com
  2. Open-Meteo Geocoding API : https://geocoding-api.open-meteo.com
  3. Open-Meteo Marine API    : https://marine-api.open-meteo.com
"""

from datetime import datetime, timezone
import json
import math
import os
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

try:
    from .risk_model import validate_input_data, calculate_compound_risk, calculate_coordinate_risk
except ImportError:
    from risk_model import validate_input_data, calculate_compound_risk, calculate_coordinate_risk

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app = Flask(__name__, static_folder=None)

CORS(app, resources={r"/api/*": {"origins": "*"}})

coordinate_assessment_cache = {}
CACHE_TTL_SECONDS = 600

# ─────────────────────── HTTP Utility ────────────────────────────────────────

def fetch_json(url, timeout=10):
    """Fetch JSON from a URL with a descriptive User-Agent header."""
    req = Request(
        url,
        headers={"User-Agent": "CycloneImpactPredictor/2.0 (open-source research tool)"}
    )
    with urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ─────────────────────── Geocoding ───────────────────────────────────────────

def search_locations_api(query: str, count: int = 15, language: str = "en"):
    """
    Search worldwide locations using the FREE Open-Meteo Geocoding API.
    No API key required.
    Docs: https://open-meteo.com/en/docs/geocoding-api
    """
    params = {
        "name": query,
        "count": count,
        "language": language,
        "format": "json"
    }
    url = "https://geocoding-api.open-meteo.com/v1/search?" + urlencode(params)
    return fetch_json(url, timeout=8)


# ─────────────────────── Weather Data ────────────────────────────────────────

def fetch_realtime_weather(latitude: float, longitude: float):
    """
    Fetch real-time weather forecast using FREE Open-Meteo Weather API.
    No API key required.
    Docs: https://open-meteo.com/en/docs
    """
    weather_params = {
        "latitude": f"{latitude:.5f}",
        "longitude": f"{longitude:.5f}",
        "current": (
            "temperature_2m,relative_humidity_2m,apparent_temperature,"
            "wind_speed_10m,wind_gusts_10m,precipitation,weather_code,"
            "surface_pressure"
        ),
        "hourly": (
            "temperature_2m,wind_speed_10m,wind_gusts_10m,"
            "precipitation,precipitation_probability,weather_code"
        ),
        "daily": (
            "temperature_2m_max,temperature_2m_min,"
            "precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,"
            "weather_code"
        ),
        "forecast_days": 7,
        "forecast_hours": 48,
        "timezone": "auto",
        "wind_speed_unit": "kmh"
    }
    url = "https://api.open-meteo.com/v1/forecast?" + urlencode(weather_params)
    return fetch_json(url, timeout=10)


def fetch_marine_data(latitude: float, longitude: float):
    """
    Fetch marine/coastal data using FREE Open-Meteo Marine API.
    No API key required.
    Docs: https://open-meteo.com/en/docs/marine-weather-api
    """
    params = {
        "latitude": f"{latitude:.5f}",
        "longitude": f"{longitude:.5f}",
        "hourly": "wave_height,sea_level_height_msl,swell_wave_height,ocean_current_velocity",
        "forecast_hours": 48,
        "timezone": "auto",
        "cell_selection": "sea"
    }
    url = "https://marine-api.open-meteo.com/v1/marine?" + urlencode(params)
    return fetch_json(url, timeout=10)


# ─────────────────────── Risk Estimation from Live Weather ───────────────────

def compute_risk_from_weather(weather_data: dict, marine_data: dict = None) -> dict:
    """
    Derive compound risk scores from live weather API data.
    """
    current = weather_data.get("current", {})
    hourly = weather_data.get("hourly", {})
    daily = weather_data.get("daily", {})
    elevation = weather_data.get("elevation", 10.0)

    # Current wind and gust
    wind_speed = float(current.get("wind_speed_10m") or 0)
    wind_gust = float(current.get("wind_gusts_10m") or wind_speed * 1.3)
    precipitation_current = float(current.get("precipitation") or 0)
    surface_pressure = float(current.get("surface_pressure") or 1013)

    # Max wind/gust from next 48 hours
    hourly_winds = [v for v in (hourly.get("wind_speed_10m") or []) if isinstance(v, (int, float))]
    hourly_gusts = [v for v in (hourly.get("wind_gusts_10m") or []) if isinstance(v, (int, float))]
    hourly_precip = [max(0, v) for v in (hourly.get("precipitation") or []) if isinstance(v, (int, float))]

    max_wind_48h = max(hourly_winds[:48]) if hourly_winds else wind_speed
    max_gust_48h = max(hourly_gusts[:48]) if hourly_gusts else wind_gust
    total_rain_48h = sum(hourly_precip[:48]) if hourly_precip else precipitation_current * 24

    # Daily summary
    daily_precip = [v for v in (daily.get("precipitation_sum") or []) if isinstance(v, (int, float))]
    daily_wind_max = [v for v in (daily.get("wind_speed_10m_max") or []) if isinstance(v, (int, float))]
    max_daily_rain = max(daily_precip) if daily_precip else total_rain_48h / 2
    max_daily_wind = max(daily_wind_max) if daily_wind_max else max_wind_48h

    # Marine surge contribution
    wave_height = 0.0
    sea_level = 0.0
    if marine_data:
        marine_hourly = marine_data.get("hourly", {})
        waves = [v for v in (marine_hourly.get("wave_height") or []) if isinstance(v, (int, float))]
        sea_levels = [v for v in (marine_hourly.get("sea_level_height_msl") or []) if isinstance(v, (int, float))]
        if waves:
            wave_height = max(waves[:24])
        if sea_levels:
            sea_level = max(sea_levels[:24])

    # Pressure departure from normal (low pressure → severe storm risk)
    pressure_anomaly = max(0, 1013 - surface_pressure)
    pressure_risk = min(100, pressure_anomaly * 2.5)

    # Derive input parameters for risk model
    effective_wind = max(wind_speed, max_wind_48h * 0.8, max_daily_wind * 0.7)
    effective_rainfall = max(total_rain_48h, max_daily_rain * 1.2)
    elevation_risk = max(0, min(100, 100 - elevation * 1.5))
    flood_vulnerability = min(100, (wave_height * 15) + (sea_level * 10) + (elevation_risk * 0.4) + (pressure_risk * 0.2))
    cyclone_distance = max(10, min(500, 350 - pressure_anomaly * 3))

    params_for_model = {
        "wind_speed": min(300, effective_wind),
        "rainfall": min(500, effective_rainfall),
        "cyclone_distance": cyclone_distance,
        "flood_vulnerability": min(100, max(0, flood_vulnerability)),
        "elevation_risk": min(100, max(0, elevation_risk)),
        "population_vulnerability": 50  # Default; not available from weather API
    }

    risk_result = calculate_compound_risk(params_for_model)

    # Add raw weather info for display in React
    risk_result["live_weather"] = {
        "temperature_c": round(float(current.get("temperature_2m") or 0), 1),
        "humidity_pct": round(float(current.get("relative_humidity_2m") or 0), 0),
        "wind_speed_kmh": round(effective_wind, 1),
        "wind_gust_kmh": round(max_gust_48h, 1),
        "precipitation_mm": round(effective_rainfall, 1),
        "surface_pressure_hpa": round(surface_pressure, 1),
        "wave_height_m": round(wave_height, 2),
        "elevation_m": round(elevation, 1),
        "max_wind_48h_kmh": round(max_wind_48h, 1),
        "total_rain_48h_mm": round(total_rain_48h, 1),
    }
    risk_result["data_source"] = "Open-Meteo (open-meteo.com) — Free, No API Key Required"
    risk_result["inputs"] = params_for_model
    return risk_result


# ─────────────────────── Routes ──────────────────────────────────────────────

@app.route("/", methods=["GET"])
def index():
    return send_from_directory(PROJECT_ROOT, "index.html")


@app.route("/css/<path:filename>", methods=["GET"])
def frontend_css(filename):
    return send_from_directory(os.path.join(PROJECT_ROOT, "css"), filename)


@app.route("/js/<path:filename>", methods=["GET"])
def frontend_javascript(filename):
    return send_from_directory(os.path.join(PROJECT_ROOT, "js"), filename)


@app.route("/api", methods=["GET"])
def api_index():
    return jsonify({
        "service": "AI-Based Cyclone Compound Local Impact Prediction API",
        "status": "online",
        "version": "2.0.0",
        "free_apis_used": {
            "weather": "Open-Meteo Weather API — https://open-meteo.com — No API key required",
            "geocoding": "Open-Meteo Geocoding API — https://geocoding-api.open-meteo.com — No API key required",
            "marine": "Open-Meteo Marine API — https://marine-api.open-meteo.com — No API key required"
        },
        "endpoints": {
            "health_check": "GET /api/health",
            "risk_prediction": "POST /api/predict",
            "location_search": "GET /api/locations/search?q=<query>&count=15",
            "live_weather": "GET /api/weather?lat=<lat>&lon=<lon>",
            "coordinate_risk": "POST /api/risk-assessment",
            "cyclone_data": "GET /api/cyclone",
            "tamil_nadu_locations": "GET /api/locations/tamil-nadu"
        }
    }), 200


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "ok",
        "service": "Cyclone Compound Risk Prediction Backend v2.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "2.0.0",
        "free_apis": ["open-meteo.com", "geocoding-api.open-meteo.com", "marine-api.open-meteo.com"]
    }), 200


# ─── Location Search ──────────────────────────────────────────────────────────

@app.route("/api/locations/search", methods=["GET"])
def search_locations():
    """
    Search locations worldwide using FREE Open-Meteo Geocoding API.
    No API key required.

    Query params:
      q     : search string (e.g. 'Chennai', 'Madurai', 'Tokyo')
      count : number of results (default 15, max 100)
    """
    query = request.args.get("q", "").strip()
    count = min(int(request.args.get("count", 15)), 100)

    if not query or len(query) < 2:
        return jsonify({"error": "Query too short", "message": "Please enter at least 2 characters."}), 400

    try:
        data = search_locations_api(query, count=count)
        results = data.get("results") or []
        locations = [
            {
                "id": r.get("id"),
                "name": r.get("name", ""),
                "display_name": (
                    r.get("name", "") +
                    (f", {r['admin1']}" if r.get("admin1") else "") +
                    (f", {r['country']}" if r.get("country") else "")
                ),
                "latitude": r.get("latitude"),
                "longitude": r.get("longitude"),
                "country": r.get("country", ""),
                "country_code": r.get("country_code", ""),
                "state": r.get("admin1", ""),
                "district": r.get("admin2", ""),
                "elevation": r.get("elevation"),
                "population": r.get("population"),
                "timezone": r.get("timezone", "")
            }
            for r in results
        ]
        return jsonify({
            "query": query,
            "count": len(locations),
            "results": locations,
            "source": "Open-Meteo Geocoding API — https://geocoding-api.open-meteo.com — Free, no API key"
        }), 200
    except (URLError, HTTPError, TimeoutError) as e:
        return jsonify({"error": "Geocoding API Error", "message": str(e)}), 503
    except Exception as e:
        return jsonify({"error": "Internal Error", "message": str(e)}), 500


@app.route("/api/locations/tamil-nadu", methods=["GET"])
def get_tamil_nadu_locations():
    """
    Returns a curated list of all major Tamil Nadu districts and cities
    with pre-set coordinates (no API call needed).
    """
    locations = [
        # Coastal Districts (High Cyclone Risk)
        {"name": "Chennai", "display_name": "Chennai (Capital), Tamil Nadu", "latitude": 13.0827, "longitude": 80.2707, "state": "Tamil Nadu", "district": "Chennai", "coastal": True, "population": 7088000},
        {"name": "Cuddalore", "display_name": "Cuddalore, Tamil Nadu", "latitude": 11.7447, "longitude": 79.7689, "state": "Tamil Nadu", "district": "Cuddalore", "coastal": True, "population": 173676},
        {"name": "Nagapattinam", "display_name": "Nagapattinam, Tamil Nadu", "latitude": 10.7667, "longitude": 79.8428, "state": "Tamil Nadu", "district": "Nagapattinam", "coastal": True, "population": 145568},
        {"name": "Rameswaram", "display_name": "Rameswaram, Tamil Nadu", "latitude": 9.2876, "longitude": 79.3129, "state": "Tamil Nadu", "district": "Ramanathapuram", "coastal": True, "population": 44856},
        {"name": "Thoothukudi", "display_name": "Thoothukudi (Tuticorin), Tamil Nadu", "latitude": 8.7642, "longitude": 78.1348, "state": "Tamil Nadu", "district": "Thoothukudi", "coastal": True, "population": 237830},
        {"name": "Kanyakumari", "display_name": "Kanyakumari, Tamil Nadu", "latitude": 8.0883, "longitude": 77.5385, "state": "Tamil Nadu", "district": "Kanyakumari", "coastal": True, "population": 22478},
        {"name": "Mahabalipuram", "display_name": "Mahabalipuram (Mamallapuram), Tamil Nadu", "latitude": 12.6269, "longitude": 80.1927, "state": "Tamil Nadu", "district": "Chengalpattu", "coastal": True, "population": 12049},
        {"name": "Pondicherry", "display_name": "Puducherry, Union Territory", "latitude": 11.9139, "longitude": 79.8145, "state": "Puducherry", "district": "Puducherry", "coastal": True, "population": 244377},
        {"name": "Karaikal", "display_name": "Karaikal, Puducherry UT", "latitude": 10.9254, "longitude": 79.8380, "state": "Puducherry", "district": "Karaikal", "coastal": True, "population": 70680},
        {"name": "Vedaranyam", "display_name": "Vedaranyam, Nagapattinam", "latitude": 10.3726, "longitude": 79.8527, "state": "Tamil Nadu", "district": "Nagapattinam", "coastal": True, "population": 26831},
        {"name": "Mandapam", "display_name": "Mandapam, Ramanathapuram", "latitude": 9.2747, "longitude": 79.1311, "state": "Tamil Nadu", "district": "Ramanathapuram", "coastal": True, "population": 15000},
        {"name": "Colachel", "display_name": "Colachel, Kanyakumari", "latitude": 8.1735, "longitude": 77.2618, "state": "Tamil Nadu", "district": "Kanyakumari", "coastal": True, "population": 20000},
        # Major Inland Cities
        {"name": "Coimbatore", "display_name": "Coimbatore, Tamil Nadu", "latitude": 11.0168, "longitude": 76.9558, "state": "Tamil Nadu", "district": "Coimbatore", "coastal": False, "population": 1601438},
        {"name": "Madurai", "display_name": "Madurai, Tamil Nadu", "latitude": 9.9252, "longitude": 78.1198, "state": "Tamil Nadu", "district": "Madurai", "coastal": False, "population": 1017865},
        {"name": "Tiruchirappalli", "display_name": "Tiruchirappalli (Trichy), Tamil Nadu", "latitude": 10.7905, "longitude": 78.7047, "state": "Tamil Nadu", "district": "Tiruchirappalli", "coastal": False, "population": 916857},
        {"name": "Salem", "display_name": "Salem, Tamil Nadu", "latitude": 11.6643, "longitude": 78.1460, "state": "Tamil Nadu", "district": "Salem", "coastal": False, "population": 831038},
        {"name": "Tirunelveli", "display_name": "Tirunelveli, Tamil Nadu", "latitude": 8.7139, "longitude": 77.7567, "state": "Tamil Nadu", "district": "Tirunelveli", "coastal": False, "population": 474838},
        {"name": "Vellore", "display_name": "Vellore, Tamil Nadu", "latitude": 12.9165, "longitude": 79.1325, "state": "Tamil Nadu", "district": "Vellore", "coastal": False, "population": 423425},
        {"name": "Erode", "display_name": "Erode, Tamil Nadu", "latitude": 11.3410, "longitude": 77.7172, "state": "Tamil Nadu", "district": "Erode", "coastal": False, "population": 206391},
        {"name": "Tiruppur", "display_name": "Tiruppur, Tamil Nadu", "latitude": 11.1085, "longitude": 77.3411, "state": "Tamil Nadu", "district": "Tiruppur", "coastal": False, "population": 877778},
        {"name": "Dindigul", "display_name": "Dindigul, Tamil Nadu", "latitude": 10.3673, "longitude": 77.9803, "state": "Tamil Nadu", "district": "Dindigul", "coastal": False, "population": 208408},
        {"name": "Thanjavur", "display_name": "Thanjavur, Tamil Nadu", "latitude": 10.7870, "longitude": 79.1378, "state": "Tamil Nadu", "district": "Thanjavur", "coastal": False, "population": 222163},
        {"name": "Ranipet", "display_name": "Ranipet, Tamil Nadu", "latitude": 12.9266, "longitude": 79.3354, "state": "Tamil Nadu", "district": "Ranipet", "coastal": False, "population": 60000},
        {"name": "Karur", "display_name": "Karur, Tamil Nadu", "latitude": 10.9601, "longitude": 78.0766, "state": "Tamil Nadu", "district": "Karur", "coastal": False, "population": 176108},
        {"name": "Namakkal", "display_name": "Namakkal, Tamil Nadu", "latitude": 11.2189, "longitude": 78.1674, "state": "Tamil Nadu", "district": "Namakkal", "coastal": False, "population": 79428},
        {"name": "Krishnagiri", "display_name": "Krishnagiri, Tamil Nadu", "latitude": 12.5186, "longitude": 78.2137, "state": "Tamil Nadu", "district": "Krishnagiri", "coastal": False, "population": 70180},
        {"name": "Dharmapuri", "display_name": "Dharmapuri, Tamil Nadu", "latitude": 12.1282, "longitude": 78.1582, "state": "Tamil Nadu", "district": "Dharmapuri", "coastal": False, "population": 65457},
        {"name": "Virudhunagar", "display_name": "Virudhunagar, Tamil Nadu", "latitude": 9.5768, "longitude": 77.9620, "state": "Tamil Nadu", "district": "Virudhunagar", "coastal": False, "population": 70537},
        {"name": "Sivaganga", "display_name": "Sivaganga, Tamil Nadu", "latitude": 9.8484, "longitude": 78.4785, "state": "Tamil Nadu", "district": "Sivaganga", "coastal": False, "population": 56849},
        {"name": "Tenkasi", "display_name": "Tenkasi, Tamil Nadu", "latitude": 8.9606, "longitude": 77.3152, "state": "Tamil Nadu", "district": "Tenkasi", "coastal": False, "population": 59820},
        {"name": "Perambalur", "display_name": "Perambalur, Tamil Nadu", "latitude": 11.2345, "longitude": 78.8794, "state": "Tamil Nadu", "district": "Perambalur", "coastal": False, "population": 21930},
        {"name": "Pudukkottai", "display_name": "Pudukkottai, Tamil Nadu", "latitude": 10.3797, "longitude": 78.8199, "state": "Tamil Nadu", "district": "Pudukkottai", "coastal": False, "population": 113241},
        {"name": "Tirupattur", "display_name": "Tirupattur, Tamil Nadu", "latitude": 12.4951, "longitude": 78.5709, "state": "Tamil Nadu", "district": "Tirupattur", "coastal": False, "population": 57000},
        {"name": "Villupuram", "display_name": "Villupuram, Tamil Nadu", "latitude": 11.9390, "longitude": 79.4926, "state": "Tamil Nadu", "district": "Villupuram", "coastal": False, "population": 111582},
        {"name": "Kallakurichi", "display_name": "Kallakurichi, Tamil Nadu", "latitude": 11.7373, "longitude": 78.9597, "state": "Tamil Nadu", "district": "Kallakurichi", "coastal": False, "population": 55000},
        {"name": "Mayiladuthurai", "display_name": "Mayiladuthurai, Tamil Nadu", "latitude": 11.1028, "longitude": 79.6545, "state": "Tamil Nadu", "district": "Mayiladuthurai", "coastal": True, "population": 93000},
        {"name": "Chengalpattu", "display_name": "Chengalpattu, Tamil Nadu", "latitude": 12.6921, "longitude": 79.9761, "state": "Tamil Nadu", "district": "Chengalpattu", "coastal": False, "population": 61000},
        {"name": "Tiruvannamalai", "display_name": "Tiruvannamalai, Tamil Nadu", "latitude": 12.2308, "longitude": 79.0707, "state": "Tamil Nadu", "district": "Tiruvannamalai", "coastal": False, "population": 145279},
        {"name": "Kancheepuram", "display_name": "Kancheepuram, Tamil Nadu", "latitude": 12.8185, "longitude": 79.6947, "state": "Tamil Nadu", "district": "Kancheepuram", "coastal": False, "population": 164384},
        {"name": "Ooty (Udhagamandalam)", "display_name": "Ooty (Udhagamandalam), Nilgiris", "latitude": 11.4102, "longitude": 76.6950, "state": "Tamil Nadu", "district": "Nilgiris", "coastal": False, "population": 93000},
        {"name": "Hosur", "display_name": "Hosur, Krishnagiri", "latitude": 12.7383, "longitude": 77.8259, "state": "Tamil Nadu", "district": "Krishnagiri", "coastal": False, "population": 165000},
    ]
    return jsonify({
        "state": "Tamil Nadu",
        "count": len(locations),
        "locations": locations,
        "note": "All coordinates use Open-Meteo free weather API — no API key needed"
    }), 200


# ─── Live Weather Endpoint ────────────────────────────────────────────────────

@app.route("/api/weather", methods=["GET"])
def get_live_weather():
    """
    Get real-time weather for any latitude/longitude worldwide.
    Uses FREE Open-Meteo API — no API key required.

    Query params: lat, lon
    """
    try:
        lat = float(request.args.get("lat", 0))
        lon = float(request.args.get("lon", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid coordinates", "message": "lat and lon must be numbers"}), 400

    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return jsonify({"error": "Coordinates out of range"}), 400

    try:
        weather = fetch_realtime_weather(lat, lon)
        marine = None
        try:
            marine = fetch_marine_data(lat, lon)
        except Exception:
            pass  # Marine data not available for inland locations

        current = weather.get("current", {})
        hourly = weather.get("hourly", {})
        daily = weather.get("daily", {})

        # Build clean response
        return jsonify({
            "latitude": weather.get("latitude", lat),
            "longitude": weather.get("longitude", lon),
            "timezone": weather.get("timezone", ""),
            "elevation_m": weather.get("elevation", 0),
            "current": {
                "temperature_c": current.get("temperature_2m"),
                "apparent_temperature_c": current.get("apparent_temperature"),
                "humidity_pct": current.get("relative_humidity_2m"),
                "wind_speed_kmh": current.get("wind_speed_10m"),
                "wind_gust_kmh": current.get("wind_gusts_10m"),
                "precipitation_mm": current.get("precipitation"),
                "surface_pressure_hpa": current.get("surface_pressure"),
                "weather_code": current.get("weather_code")
            },
            "forecast_48h": {
                "times": hourly.get("time", [])[:48],
                "wind_speed_kmh": hourly.get("wind_speed_10m", [])[:48],
                "wind_gust_kmh": hourly.get("wind_gusts_10m", [])[:48],
                "precipitation_mm": hourly.get("precipitation", [])[:48],
                "precipitation_probability_pct": hourly.get("precipitation_probability", [])[:48],
                "temperature_c": hourly.get("temperature_2m", [])[:48],
            },
            "daily_7day": {
                "dates": daily.get("time", []),
                "max_temp_c": daily.get("temperature_2m_max", []),
                "min_temp_c": daily.get("temperature_2m_min", []),
                "max_wind_kmh": daily.get("wind_speed_10m_max", []),
                "max_gust_kmh": daily.get("wind_gusts_10m_max", []),
                "precipitation_sum_mm": daily.get("precipitation_sum", []),
                "weather_code": daily.get("weather_code", [])
            },
            "marine": {
                "wave_height_m": (marine.get("hourly", {}).get("wave_height", [None]*1)[0] if marine else None),
                "available": marine is not None
            },
            "data_source": "Open-Meteo — https://open-meteo.com — Free, no API key required",
            "api_docs": "https://open-meteo.com/en/docs"
        }), 200
    except (URLError, HTTPError, TimeoutError) as e:
        return jsonify({"error": "Weather API Unavailable", "message": str(e)}), 503
    except Exception as e:
        return jsonify({"error": "Internal Error", "message": str(e)}), 500


# ─── Manual Prediction Endpoint ───────────────────────────────────────────────

@app.route("/api/predict", methods=["POST"])
def predict_risk():
    """
    Calculate compound risk from manually entered parameters.
    """
    if not request.is_json:
        data = request.get_json(silent=True)
        if data is None:
            return jsonify({
                "error": "Bad Request",
                "message": "Request payload must be valid JSON with 'Content-Type: application/json'."
            }), 400
    else:
        data = request.get_json()

    is_valid, validated_params, error_msg = validate_input_data(data)
    if not is_valid:
        return jsonify({"error": "Validation Error", "message": error_msg}), 400

    try:
        prediction = calculate_compound_risk(validated_params)
        prediction["risk_message"] = prediction["message"]
        prediction["data_source"] = "Manual Parameters (user-supplied)"
        return jsonify(prediction), 200
    except Exception as e:
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500


# ─── Coordinate Risk Assessment (Live API) ────────────────────────────────────

@app.route("/api/risk-assessment", methods=["POST"])
def assess_coordinate_risk():
    """
    Assess compound cyclone impact risk for any lat/lon using LIVE weather data
    from FREE Open-Meteo API (no API key required).
    """
    if not request.is_json:
        return jsonify({"error": "Bad Request", "message": "Request must be JSON."}), 400

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Validation Error", "message": "Expected JSON object with latitude and longitude."}), 400

    try:
        latitude = float(data.get("latitude"))
        longitude = float(data.get("longitude"))
    except (TypeError, ValueError):
        return jsonify({"error": "Validation Error", "message": "Latitude and longitude must be numbers."}), 400

    if not (-90 <= latitude <= 90):
        return jsonify({"error": "Validation Error", "message": "Latitude must be between -90 and 90."}), 400
    if not (-180 <= longitude <= 180):
        return jsonify({"error": "Validation Error", "message": "Longitude must be between -180 and 180."}), 400

    cache_key = (round(latitude, 3), round(longitude, 3))
    cached = coordinate_assessment_cache.get(cache_key)
    if cached and time.monotonic() - cached[0] < CACHE_TTL_SECONDS:
        response = dict(cached[1])
        response["latitude"] = latitude
        response["longitude"] = longitude
        response["location"] = {
            "name": str(data.get("place_name") or "Selected location")[:160],
            "country": str(data.get("country") or "")[:100],
            "state": str(data.get("state") or "")[:100],
            "district": str(data.get("district") or "")[:100]
        }
        response["cached"] = True
        return jsonify(response), 200

    # Never replace unavailable live forecasts with generated weather values.
    try:
        weather_data = fetch_realtime_weather(latitude, longitude)
        try:
            marine_data = fetch_marine_data(latitude, longitude)
        except Exception:
            marine_data = None
        assessment = calculate_coordinate_risk(weather_data, marine_data)
    except Exception as err:
        app.logger.warning("Open-Meteo weather assessment failed: %s", err)
        return jsonify({
            "error": "Live Risk Data Unavailable",
            "message": "Open-Meteo forecast data is unavailable or incomplete. No simulated values were substituted."
        }), 503

    assessment["latitude"] = latitude
    assessment["longitude"] = longitude
    assessment["location"] = {
        "name": str(data.get("place_name") or "Selected location")[:160],
        "country": str(data.get("country") or "")[:100],
        "state": str(data.get("state") or "")[:100],
        "district": str(data.get("district") or "")[:100]
    }
    assessment["cached"] = False
    assessment["synthetic_fallback"] = False

    # Compute 4 nearby regional subzones
    nearby_offsets = [
        ("North", 0.3, 0.0),
        ("East", 0.0, 0.3),
        ("South", -0.3, 0.0),
        ("West", 0.0, -0.3)
    ]
    regional_subzones = []
    for direction, dlat, dlng in nearby_offsets:
        sub_lat = max(-90, min(90, latitude + dlat))
        sub_lng = max(-180, min(180, longitude + dlng))
        try:
            sub_weather = fetch_realtime_weather(sub_lat, sub_lng)
            sub_risk = calculate_coordinate_risk(sub_weather, None)
        except Exception:
            continue
        dist_km = round(math.hypot(dlat * 111.0, dlng * 111.0 * math.cos(math.radians(latitude))), 1)
        regional_subzones.append({
            "name": f"{direction} subzone",
            "latitude": sub_lat,
            "longitude": sub_lng,
            "distance_km": dist_km,
            "wind_risk": sub_risk.get("wind_risk", 0),
            "rainfall_risk": sub_risk.get("rainfall_risk", 0),
            "flood_risk": sub_risk.get("flood_risk", 0),
            "local_vulnerability": sub_risk.get("local_vulnerability", 0),
            "overall_risk": sub_risk.get("overall_risk", 0),
            "risk_level": sub_risk.get("risk_level", "Low"),
            "elevation_m": sub_risk.get("inputs", {}).get("elevation_m", 0)
        })

    assessment["regional_subzones"] = regional_subzones

    coordinate_assessment_cache[cache_key] = (time.monotonic(), dict(assessment))
    if len(coordinate_assessment_cache) > 500:
        oldest = min(coordinate_assessment_cache, key=lambda k: coordinate_assessment_cache[k][0])
        coordinate_assessment_cache.pop(oldest, None)

    return jsonify(assessment), 200


@app.route("/api/cyclone", methods=["GET"])
def get_cyclone_metadata():
    return jsonify({
        "active_cyclone": None,
        "sample_scenarios": [],
        "data_source": None,
        "message": "No authoritative global live cyclone-track feed is configured."
    }), 200


# ─── Error Handlers ───────────────────────────────────────────────────────────

@app.errorhandler(400)
def bad_request(error):
    return jsonify({"error": "Bad Request", "message": getattr(error, 'description', 'Invalid request.')}), 400

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not Found", "message": "The requested endpoint does not exist."}), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({"error": "Method Not Allowed", "message": "HTTP method not allowed for this endpoint."}), 405

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal Server Error", "message": "An unexpected error occurred."}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║   AI Cyclone Impact Prediction Backend v2.0 — STARTED        ║
║   URL: http://localhost:{port}                                 ║
║   Free APIs Used (No Key Required):                           ║
║     • Open-Meteo Weather:  api.open-meteo.com                 ║
║     • Open-Meteo Geocoding: geocoding-api.open-meteo.com      ║
║     • Open-Meteo Marine:   marine-api.open-meteo.com          ║
╚══════════════════════════════════════════════════════════════╝
    """)
    app.run(host="0.0.0.0", port=port, debug=True)
