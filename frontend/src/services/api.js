/**
 * API Service — All calls use fetch() to the Python Flask backend.
 * Backend uses 100% FREE Open-Meteo APIs (no API key required).
 *
 * Free APIs used:
 *  - Open-Meteo Weather:   https://open-meteo.com
 *  - Open-Meteo Geocoding: https://geocoding-api.open-meteo.com
 *  - Open-Meteo Marine:    https://marine-api.open-meteo.com
 */

const BASE_URL = '/api';

/** Check if Flask backend is alive */
export async function checkBackendHealth() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend health check failed:', err.message);
    return null;
  }
}

/** Fetch active cyclone metadata + sample scenarios */
export async function fetchCycloneMetadata() {
  try {
    const res = await fetch(`${BASE_URL}/cyclone`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Cyclone metadata error:', err.message);
    return null;
  }
}

/**
 * Search locations worldwide using Open-Meteo free Geocoding API (via backend).
 * No API key required.
 * @param {string} query - search term e.g. "Chennai", "Madurai", "Tokyo"
 * @param {number} count - max results (default 15)
 */
export async function searchLocations(query, count = 15) {
  const params = new URLSearchParams({ q: query, count });
  const res = await fetch(`${BASE_URL}/locations/search?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Search failed (${res.status})`);
  }
  return res.json();
}

/**
 * Get all Tamil Nadu districts & cities (pre-set by backend).
 */
export async function fetchTamilNaduLocations() {
  const res = await fetch(`${BASE_URL}/locations/tamil-nadu`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Get live weather for any coordinate worldwide.
 * Uses FREE Open-Meteo Weather API via backend proxy.
 * @param {number} lat
 * @param {number} lon
 */
export async function getLiveWeather(lat, lon) {
  const params = new URLSearchParams({ lat, lon });
  const res = await fetch(`${BASE_URL}/weather?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Weather fetch failed (${res.status})`);
  }
  return res.json();
}

/**
 * Calculate compound risk from user-specified parameters.
 * @param {Object} payload - { wind_speed, rainfall, cyclone_distance, flood_vulnerability, elevation_risk, population_vulnerability }
 */
export async function predictRisk(payload) {
  const res = await fetch(`${BASE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Prediction failed (${res.status})`);
  }
  return res.json();
}

/**
 * Assess compound risk for a specific coordinate using live weather data.
 * Uses FREE Open-Meteo APIs via backend — no API key needed.
 * @param {number} latitude
 * @param {number} longitude
 * @param {Object} placeData - { name, country, state, district }
 */
export async function assessCoordinateRisk(latitude, longitude, placeData = {}) {
  const res = await fetch(`${BASE_URL}/risk-assessment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      place_name: placeData.name || 'Selected Location',
      country: placeData.country || '',
      state: placeData.state || '',
      district: placeData.district || ''
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Risk assessment failed (${res.status})`);
  }
  return res.json();
}
