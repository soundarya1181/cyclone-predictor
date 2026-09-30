"""
AI-Based Cyclone Compound Local Impact Risk Scoring Model

Transparent, explainable multi-hazard risk engine designed for real-time
evaluation of compounding cyclone threats (wind, precipitation, storm surge/flood,
and localized socioeconomic/topographic vulnerability).
"""

import math
from typing import Dict, Any, Tuple, Optional


def determine_risk_level(score: float) -> str:
    """
    Map risk score (0-100) to standard categorical risk levels:
      0–25   : Low
      26–50  : Moderate
      51–75  : High
      76–100 : Very High
    """
    if score >= 76:
        return "Very High"
    if score >= 51:
        return "High"
    if score >= 26:
        return "Moderate"
    return "Low"


def validate_input_data(data: Any) -> Tuple[bool, Optional[Dict[str, float]], Optional[str]]:
    """
    Validates incoming JSON payload, ensuring all required parameters exist,
    are numeric, and lie within physically valid bounds.
    Supports both standard snake_case and camelCase parameter aliases.
    """
    if not isinstance(data, dict):
        return False, None, "Invalid request body: Expected a JSON object."

    # Key alias mapping
    field_mappings = {
        "wind_speed": ["wind_speed", "windSpeedKmh", "wind_speed_kmh", "wind"],
        "rainfall": ["rainfall", "rainfallMm24h", "rainfall_mm", "rain"],
        "cyclone_distance": ["cyclone_distance", "distanceFromEyeKm", "distance_km", "distance"],
        "flood_vulnerability": ["flood_vulnerability", "flood_risk_score", "stormSurgeMeters", "flood_score", "flood"],
        "elevation_risk": ["elevation_risk", "elevationMeters", "elevation_risk_score", "elevation"],
        "population_vulnerability": ["population_vulnerability", "vulnerabilityScore", "vulnerability", "pop_vuln"]
    }

    extracted: Dict[str, float] = {}
    max_values = {
        "wind_speed": 300,
        "rainfall": 500,
        "cyclone_distance": 2000,
        "flood_vulnerability": 100,
        "elevation_risk": 100,
        "population_vulnerability": 100
    }

    for canonical_name, aliases in field_mappings.items():
        val = None
        for alias in aliases:
            if alias in data and data[alias] is not None:
                val = data[alias]
                break

        if val is None:
            return False, None, f"Missing required parameter: '{canonical_name}' (or recognized alias)."

        # Validate numeric
        try:
            numeric_val = float(val)
        except (ValueError, TypeError):
            return False, None, f"Parameter '{canonical_name}' must be a valid number. Got: {val}"

        if numeric_val < 0:
            return False, None, f"Parameter '{canonical_name}' cannot be negative. Got: {numeric_val}"
        if numeric_val > max_values[canonical_name]:
            return False, None, f"Parameter '{canonical_name}' cannot exceed {max_values[canonical_name]}. Got: {numeric_val}"

        extracted[canonical_name] = numeric_val

    return True, extracted, None


def calculate_compound_risk(params: Dict[str, float]) -> Dict[str, Any]:
    """
    Computes disaggregated hazard risk scores and compound local impact score.

    Parameters:
      - wind_speed: Current/forecast wind speed in km/h (e.g. 0 - 300)
      - rainfall: 24-hour rainfall accumulation in mm (e.g. 0 - 500)
    - cyclone_distance: Distance from cyclone eye center in km (e.g. 0 - 2000)
      - flood_vulnerability: Inundation/surge risk index (0 - 100)
      - elevation_risk: Topographical risk index where higher = low-lying (0 - 100)
      - population_vulnerability: Socio-economic exposure/shelter strain index (0 - 100)

    Returns:
      Dictionary containing individual hazard scores, overall score, risk level, and message.
    """
    wind_speed = params["wind_speed"]
    rainfall = params["rainfall"]
    distance = params["cyclone_distance"]
    flood_vuln = params["flood_vulnerability"]
    elevation_risk = params["elevation_risk"]
    pop_vuln = params["population_vulnerability"]

    # 1. Distance Decay Factor (Closer to eye = stronger hazard coupling)
    # Range: 0.2 to 1.0
    distance_decay = max(0.2, 1.0 - (distance / 380.0))

    # 2. Wind Hazard Risk (0 - 100)
    # Scaled based on IMD / Saffir-Simpson cyclonic thresholds:
    # 40 km/h: depression threshold, 120 km/h: very severe, 220+ km/h: super cyclone
    raw_wind_norm = min(100.0, max(0.0, ((wind_speed - 30.0) / (200.0 - 30.0)) * 100.0))
    wind_risk = min(100.0, max(0.0, raw_wind_norm * min(1.15, 0.4 + 0.6 * distance_decay * 1.2)))

    # 3. Rainfall Hazard Risk (0 - 100)
    # Scaled where 30mm is moderate, 100mm is heavy, 250+ mm is extreme torrential
    raw_rain_norm = min(100.0, max(0.0, ((rainfall - 20.0) / (240.0 - 20.0)) * 100.0))
    rainfall_risk = min(100.0, max(0.0, raw_rain_norm * (0.35 + 0.65 * distance_decay)))

    # 4. Flood & Coastal Inundation Risk (0 - 100)
    # Combines flood vulnerability, elevation risk, and rain contribution
    flood_risk = min(100.0, max(0.0, (flood_vuln * 0.45) + (elevation_risk * 0.35) + (rainfall_risk * 0.20)))

    # 5. Local Socioeconomic Vulnerability (0 - 100)
    # Synthesizes population density, infrastructure exposure, and low-lying elevation
    local_vulnerability = min(100.0, max(0.0, (pop_vuln * 0.70) + (elevation_risk * 0.30)))

    # 6. Multi-Hazard Compound Weighting
    # Dynamic weights allocating relative destructive potential
    w_wind = 0.28
    w_rain = 0.22
    w_flood = 0.32
    w_vuln = 0.18

    raw_compound = (
        (wind_risk * w_wind) +
        (rainfall_risk * w_rain) +
        (flood_risk * w_flood) +
        (local_vulnerability * w_vuln)
    )

    # Compounding Synergy Multiplier: Co-occurring extreme hazards create non-linear collapse risk
    synergy_multiplier = 1.08 if (wind_risk >= 70.0 and flood_risk >= 70.0) else 1.00
    overall_risk = min(100, max(0, round(raw_compound * synergy_multiplier)))

    # Categorize Risk Levels
    risk_level = determine_risk_level(overall_risk)
    wind_level = determine_risk_level(wind_risk)
    rainfall_level = determine_risk_level(rainfall_risk)
    flood_level = determine_risk_level(flood_risk)
    vuln_level = determine_risk_level(local_vulnerability)

    # Generate Explainable AI Message
    message = generate_risk_message(
        overall_risk=overall_risk,
        risk_level=risk_level,
        wind_risk=round(wind_risk),
        rainfall_risk=round(rainfall_risk),
        flood_risk=round(flood_risk),
        distance=distance
    )

    return {
        "wind_risk": round(wind_risk),
        "rainfall_risk": round(rainfall_risk),
        "flood_risk": round(flood_risk),
        "local_vulnerability": round(local_vulnerability),
        "overall_risk": overall_risk,
        "risk_level": risk_level,
        "message": message,
        "breakdown": {
            "wind_risk_level": wind_level,
            "rainfall_risk_level": rainfall_level,
            "flood_risk_level": flood_level,
            "local_vulnerability_level": vuln_level,
            "distance_decay_factor": round(distance_decay, 2),
            "synergy_multiplier_applied": synergy_multiplier > 1.0
        }
    }


def calculate_coordinate_risk(
    weather: Dict[str, Any],
    marine: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Create a clearly scoped 24-hour screening estimate from live forecast data."""
    hourly = weather.get("hourly") or {}
    times = hourly.get("time") or []
    winds = [value for value in hourly.get("wind_speed_10m", []) if isinstance(value, (int, float))]
    gusts = [value for value in hourly.get("wind_gusts_10m", []) if isinstance(value, (int, float))]
    precipitation = [
        max(0.0, value)
        for value in hourly.get("precipitation", [])
        if isinstance(value, (int, float))
    ]
    elevation = weather.get("elevation")

    if not winds or not precipitation or not isinstance(elevation, (int, float)):
        raise ValueError("Live weather or elevation data is incomplete for this coordinate.")

    wind_speed = max(winds)
    wind_gust = max(gusts) if gusts else wind_speed
    rainfall = sum(precipitation[:24])
    elevation_risk = min(100.0, max(0.0, 100.0 * math.exp(-max(float(elevation), 0.0) / 18.0)))
    wind_risk = min(100.0, max(0.0, ((wind_speed - 30.0) / 170.0) * 100.0))
    rainfall_risk = min(100.0, max(0.0, ((rainfall - 20.0) / 220.0) * 100.0))

    marine_hourly = (marine or {}).get("hourly") or {}
    wave_heights = [
        value for value in marine_hourly.get("wave_height", [])
        if isinstance(value, (int, float))
    ]
    sea_levels = [
        value for value in marine_hourly.get("sea_level_height_msl", [])
        if isinstance(value, (int, float))
    ]
    marine_latitude = (marine or {}).get("latitude")
    marine_longitude = (marine or {}).get("longitude")
    marine_nearby = False
    marine_grid_distance = None
    if isinstance(marine_latitude, (int, float)) and isinstance(marine_longitude, (int, float)):
        marine_grid_distance = _coordinate_distance_km(
            float(weather["latitude"]),
            float(weather["longitude"]),
            float(marine_latitude),
            float(marine_longitude)
        )
        marine_nearby = marine_grid_distance <= 80

    wave_height = max(wave_heights[:24]) if wave_heights and marine_nearby else None
    sea_level = sea_levels[0] if sea_levels and marine_nearby else None
    wave_risk = min(100.0, max(0.0, ((wave_height - 0.5) / 5.5) * 100.0)) if wave_height is not None else None
    marine_proximity_risk = (
        min(100.0, max(0.0, (1 - marine_grid_distance / 80) * 100))
        if marine_grid_distance is not None and marine_nearby
        else None
    )
    flood_risk = (
        rainfall_risk * 0.45 + elevation_risk * 0.25 + wave_risk * 0.15 + marine_proximity_risk * 0.15
        if wave_risk is not None
        else rainfall_risk * 0.65 + elevation_risk * 0.35
    )
    local_vulnerability = elevation_risk

    raw_compound = (
        wind_risk * 0.28 +
        rainfall_risk * 0.22 +
        flood_risk * 0.32 +
        local_vulnerability * 0.18
    )
    synergy_multiplier = 1.08 if wind_risk >= 70 and flood_risk >= 70 else 1.0
    overall_risk = min(100, round(raw_compound * synergy_multiplier))

    def score(value: float) -> int:
        return round(value)

    trend = []
    for index in range(0, min(len(times), len(winds), len(precipitation), 24), 6):
        wind_window = winds[index:index + 24]
        rain_window = precipitation[index:index + 24]
        if not wind_window or not rain_window:
            continue
        trend_wind = max(wind_window)
        trend_rain = sum(rain_window)
        trend_wind_risk = min(100.0, max(0.0, ((trend_wind - 30.0) / 170.0) * 100.0))
        trend_rain_risk = min(100.0, max(0.0, ((trend_rain - 20.0) / 220.0) * 100.0))
        trend_flood_risk = (
            trend_rain_risk * 0.45 + elevation_risk * 0.25 + wave_risk * 0.15 + marine_proximity_risk * 0.15
            if wave_risk is not None
            else trend_rain_risk * 0.65 + elevation_risk * 0.35
        )
        trend_score = round(
            trend_wind_risk * 0.28 + trend_rain_risk * 0.22 +
            trend_flood_risk * 0.32 + local_vulnerability * 0.18
        )
        trend.append({
            "time": times[index],
            "windKmh": round(trend_wind),
            "rainMmH": round(trend_rain / len(rain_window), 1),
            "compoundRisk": min(100, round(trend_score * (1.08 if trend_wind_risk >= 70 and trend_flood_risk >= 70 else 1.0)) )
        })

    scenario_fallback = bool(weather.get("synthetic_scenario"))
    risk_message = (
        "Synthetic coordinate scenario estimate using modeled wind and precipitation with global elevation; "
        "not observed weather, not a forecast, and not an official cyclone warning."
        if scenario_fallback
        else "24-hour forecast screening estimate, not an official cyclone warning. "
             "Cyclone-track distance, population exposure, local drainage, and infrastructure are not assessed."
    )

    return {
        "wind_risk": score(wind_risk),
        "rainfall_risk": score(rainfall_risk),
        "flood_risk": score(flood_risk),
        "local_vulnerability": score(local_vulnerability),
        "overall_risk": overall_risk,
        "risk_level": determine_risk_level(overall_risk),
        "risk_message": risk_message,
        "assessment_type": "coordinate_scenario_estimate" if scenario_fallback else "forecast_model_estimate",
        "inputs": {
            "wind_speed_kmh": score(wind_speed),
            "wind_gust_kmh": score(wind_gust),
            "rainfall_24h_mm": round(rainfall, 1),
            "elevation_m": round(float(elevation), 1),
            "wave_height_m": round(wave_height, 2) if wave_height is not None else None,
            "sea_level_height_msl": round(sea_level, 2) if sea_level is not None else None,
            "marine_data_available": wave_height is not None,
            "marine_grid_distance_km": round(marine_grid_distance, 1) if marine_nearby else None,
            "marine_proximity_risk": round(marine_proximity_risk) if marine_proximity_risk is not None else None
        },
        "breakdown": {
            "wind_risk_level": determine_risk_level(wind_risk),
            "rainfall_risk_level": determine_risk_level(rainfall_risk),
            "flood_risk_level": determine_risk_level(flood_risk),
            "local_vulnerability_level": determine_risk_level(local_vulnerability),
            "local_vulnerability_basis": "Elevation-only proxy; population and infrastructure data are unavailable.",
            "synergy_multiplier_applied": synergy_multiplier > 1.0
        },
        "trend": trend,
        "data_sources": (
            ["Synthetic coordinate scenario (not observed weather)", "Copernicus GLO-90 elevation"]
            if scenario_fallback
            else ["Open-Meteo global weather forecast", "Copernicus GLO-90 elevation"]
        ) + (["Open-Meteo marine forecast"] if wave_height is not None else [])
    }


def _coordinate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radians = math.pi / 180
    latitude_delta = (lat2 - lat1) * radians
    longitude_delta = (lon2 - lon1) * radians
    value = (
        math.sin(latitude_delta / 2) ** 2 +
        math.cos(lat1 * radians) * math.cos(lat2 * radians) * math.sin(longitude_delta / 2) ** 2
    )
    return 6371 * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def generate_risk_message(
    overall_risk: int,
    risk_level: str,
    wind_risk: int,
    rainfall_risk: int,
    flood_risk: int,
    distance: float
) -> str:
    """Generates an intuitive explainable advisory message based on compound risk."""
    high_drivers = []
    if wind_risk >= 70:
        high_drivers.append("severe wind shear")
    if rainfall_risk >= 70:
        high_drivers.append("torrential precipitation")
    if flood_risk >= 70:
        high_drivers.append("critical storm inundation")

    if risk_level == "Very High":
        if high_drivers:
            drivers_str = " and ".join(high_drivers)
            return f"Extreme compound cyclone impact risk detected. Driven by {drivers_str} at {distance:.0f}km from storm center. Immediate evacuation and life-safety protocols required."
        return "Very High compound cyclone impact risk detected. Mandatory shelter activation and emergency response deployed."
    elif risk_level == "High":
        if high_drivers:
            drivers_str = " and ".join(high_drivers)
            return f"High compound cyclone impact risk detected, primarily driven by {drivers_str}. Precautionary evacuations and coastal defense reinforcement advised."
        return "High compound cyclone impact risk detected. Precautionary measures and shelter activation advised."
    elif risk_level == "Moderate":
        return f"Moderate compound cyclone impact risk detected at {distance:.0f}km range. Continuous hydrological monitoring and localized flood watch recommended."
    else:
        return f"Low compound cyclone impact risk detected. Peripheral monitoring active with minimal immediate infrastructure threat."
