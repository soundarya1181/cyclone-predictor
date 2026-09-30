/**
 * Main Application Controller for AI-Based Cyclone Compound Local Impact Prediction System
 */

import { prototypeLocations } from './locationData.js';
import { getRiskBadgeClasses } from './riskEngine.js';
import { CycloneMap } from './mapComponent.js';
import { RiskCharts } from './chartsComponent.js';

const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = window.CYCLONE_API_URL || (isLocalDevelopment
  ? `${window.location.protocol}//${window.location.hostname}:5000`
  : window.location.origin);
const GEOCODING_URL = 'https://photon.komoot.io/api/';
const RISK_ASSESSMENT_URL = `${API_BASE_URL}/api/risk-assessment`;
const GEOCODING_DEBOUNCE_MS = 300;
const GEOCODING_MIN_REQUEST_INTERVAL_MS = 1100;

function displayValue(value, suffix = '') {
  return value === null || value === undefined || value === '' ? '--' : `${value}${suffix}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

class App {
  constructor() {
    this.locations = [...prototypeLocations];
    this.activeCyclone = null;
    this.activeLocationId = this.locations[0].id;
    this.geocodeCache = new Map();
    this.geocodeResults = [];
    this.activeGeocodeIndex = -1;
    this.geocodeSearchQuery = '';
    this.lastGeocodeRequestAt = 0;
    this.geocodeRequestQuery = null;
    this.geocodeController = null;
    this.geocodeDebounce = null;
    this.coordinateAssessmentController = null;
    this.activeTimelineForecast = [];
    this.map = null;
    this.charts = null;

    this.init();
  }

  init() {
    this.initClock();
    this.initCycloneBanner();
    this.initLocationDropdown();
    this.initAdvisories();
    this.initMap();
    this.initCharts();
    this.initTable();
    this.initSimulator();
    this.initExport();
    this.initTabs();

    // Initial render with the default location
    this.selectLocation(this.activeLocationId, true);
  }

  /* -------------------------------------------------------------
   * 1. Header Clock & Telemetry Timers
   * ------------------------------------------------------------- */
  initClock() {
    const clockEl = document.getElementById('header-clock');
    const updateTime = () => {
      if (clockEl) {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + " IST";
      }
    };
    updateTime();
    setInterval(updateTime, 1000);
  }

  /* -------------------------------------------------------------
   * 2. Cyclone Overview Banner
   * ------------------------------------------------------------- */
  initCycloneBanner() {
    const c = this.activeCyclone;
    if (!c) {
      document.getElementById('cyclone-name').textContent = 'No verified live cyclone track';
      document.getElementById('cyclone-system-id').textContent = 'Track unavailable';
      document.getElementById('cyclone-category-badge').textContent = 'No feed';
      document.getElementById('cyclone-last-updated').textContent = 'No official track source configured';
      document.getElementById('cyclone-status-summary').textContent = 'Select a location to load a real weather forecast and modeled risk assessment.';
      document.getElementById('cyclone-wind-speed').textContent = '--';
      document.getElementById('cyclone-gust').textContent = '--';
      document.getElementById('cyclone-bearing').textContent = '--';
      document.getElementById('cyclone-landfall-eta').textContent = '--';
      return;
    }
    document.getElementById('cyclone-name').textContent = c.name;
    document.getElementById('cyclone-system-id').textContent = c.id;
    document.getElementById('cyclone-category-badge').textContent = c.category.split("-")[0].trim();
    document.getElementById('cyclone-last-updated').textContent = `Updated: ${c.lastUpdated}`;
    document.getElementById('cyclone-status-summary').textContent = `${c.status} with central pressure of ${c.centralPressureHpa} hPa. Landfall target: ${c.estimatedLandfallLocation}.`;

    document.getElementById('cyclone-wind-speed').innerHTML = `${c.maxSustainedWindKmh} <span class="text-xs font-normal text-slate-400">km/h</span>`;
    document.getElementById('cyclone-gust').textContent = `${c.maxGustKmh} km/h`;
    document.getElementById('cyclone-bearing').textContent = c.movementBearing;
    document.getElementById('cyclone-landfall-eta').textContent = c.estimatedLandfallTime.split("at")[1] || c.estimatedLandfallTime;
  }

  /* -------------------------------------------------------------
   * 3. Location Dropdown Selector
   * ------------------------------------------------------------- */
  initLocationDropdown() {
    const input = document.getElementById('location-select');
    const suggestions = document.getElementById('location-suggestions');
    if (!input || !suggestions) return;

    suggestions.innerHTML = '';
    this.locations.forEach(loc => {
      [loc.name, ...(loc.aliases || [])].forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.label = `${loc.district}, ${loc.state}`;
        suggestions.appendChild(opt);
      });
    });

    input.addEventListener('input', () => this.handleLocationSearchInput(input.value));
    input.addEventListener('keydown', event => this.handleLocationSearchKeydown(event));
    input.addEventListener('change', () => this.selectFallbackLocation(input.value));
    document.addEventListener('click', event => {
      if (!event.target.closest('#location-search-container')) this.closeLocationSearch();
    });
  }

  findFallbackLocation(name) {
    const normalizedName = name.trim().toLowerCase();
    return this.locations.find(loc =>
      loc.name.toLowerCase() === normalizedName ||
      loc.aliases?.some(alias => alias.toLowerCase() === normalizedName)
    );
  }

  selectFallbackLocation(name) {
    const location = this.findFallbackLocation(name);
    if (location) {
      this.closeLocationSearch();
      this.selectLocation(location.id, true);
    }
  }

  handleLocationSearchInput(value) {
    const query = value.trim();
    this.geocodeSearchQuery = query;
    this.activeGeocodeIndex = -1;
    clearTimeout(this.geocodeDebounce);
    this.geocodeController?.abort();

    const fallbackLocation = this.findFallbackLocation(query);
    if (fallbackLocation) {
      this.closeLocationSearch();
      this.selectLocation(fallbackLocation.id, true);
      return;
    }

    if (query.length < 2) {
      this.renderLocationSearch('Type at least 2 characters to search worldwide places.', []);
      return;
    }

    const cachedResults = this.geocodeCache.get(query.toLowerCase());
    if (cachedResults) {
      this.renderLocationSearch(cachedResults.length ? 'Select a matching place.' : 'No worldwide locations found. Try another name.', cachedResults);
      return;
    }

    this.renderLocationSearch('Searching worldwide places…', []);
    this.geocodeDebounce = setTimeout(() => this.searchWorldwideLocations(query), GEOCODING_DEBOUNCE_MS);
  }

  handleLocationSearchKeydown(event) {
    if (event.key === 'Escape') {
      this.closeLocationSearch();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!this.geocodeResults.length) return;
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const current = this.activeGeocodeIndex < 0 ? (direction > 0 ? -1 : 0) : this.activeGeocodeIndex;
      this.activeGeocodeIndex = (current + direction + this.geocodeResults.length) % this.geocodeResults.length;
      this.updateActiveGeocodeOption();
      return;
    }

    if (event.key !== 'Enter') return;
    event.preventDefault();
    const fallbackLocation = this.findFallbackLocation(event.currentTarget.value);
    if (fallbackLocation) {
      this.selectLocation(fallbackLocation.id, true);
      this.closeLocationSearch();
      return;
    }

    if (this.geocodeResults.length) {
      this.selectGeocodedLocation(this.geocodeResults[Math.max(this.activeGeocodeIndex, 0)]);
      return;
    }

    const query = event.currentTarget.value.trim();
    if (query.length >= 2) {
      clearTimeout(this.geocodeDebounce);
      this.searchWorldwideLocations(query);
    }
  }

  updateActiveGeocodeOption() {
    const options = document.querySelectorAll('#location-search-results [role="option"]');
    options.forEach((option, index) => {
      option.classList.toggle('bg-ops-800', index === this.activeGeocodeIndex);
      option.setAttribute('aria-selected', String(index === this.activeGeocodeIndex));
    });
    const activeOption = options[this.activeGeocodeIndex];
    const input = document.getElementById('location-select');
    if (activeOption) {
      input.setAttribute('aria-activedescendant', activeOption.id);
      activeOption.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  renderLocationSearch(status, features) {
    const panel = document.getElementById('location-search-panel');
    const statusElement = document.getElementById('location-search-status');
    const resultsElement = document.getElementById('location-search-results');
    const input = document.getElementById('location-select');
    panel.classList.remove('hidden');
    input.setAttribute('aria-expanded', 'true');
    statusElement.textContent = status;
    resultsElement.replaceChildren();
    this.geocodeResults = features;

    features.forEach((feature, index) => {
      const properties = feature.properties || {};
      const name = properties.name || 'Unnamed place';
      const details = [properties.district || properties.county || properties.city, properties.state || properties.province, properties.country]
        .filter((value, detailIndex, values) => value && values.indexOf(value) === detailIndex && value !== name)
        .join(', ');
      const item = document.createElement('li');
      const option = document.createElement('button');
      option.type = 'button';
      option.id = `location-search-option-${index}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.className = 'block w-full px-3 py-2 text-left text-xs text-slate-100 hover:bg-ops-800 focus:bg-ops-800 focus:outline-none';
      const primary = document.createElement('span');
      primary.className = 'block font-semibold';
      primary.textContent = name;
      const secondary = document.createElement('span');
      secondary.className = 'mt-0.5 block text-[11px] text-slate-400';
      secondary.textContent = details || 'Administrative details unavailable';
      option.append(primary, secondary);
      option.addEventListener('click', () => this.selectGeocodedLocation(feature));
      item.appendChild(option);
      resultsElement.appendChild(item);
    });
  }

  closeLocationSearch() {
    document.getElementById('location-search-panel').classList.add('hidden');
    document.getElementById('location-select').setAttribute('aria-expanded', 'false');
    document.getElementById('location-select').removeAttribute('aria-activedescendant');
    this.geocodeResults = [];
    this.activeGeocodeIndex = -1;
  }

  async searchWorldwideLocations(query) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery || this.geocodeRequestQuery === normalizedQuery) return;

    const cachedResults = this.geocodeCache.get(normalizedQuery);
    if (cachedResults) {
      this.renderLocationSearch(cachedResults.length ? 'Select a matching place.' : 'No worldwide locations found. Try another name.', cachedResults);
      return;
    }

    const wait = GEOCODING_MIN_REQUEST_INTERVAL_MS - (Date.now() - this.lastGeocodeRequestAt);
    if (wait > 0) {
      this.geocodeDebounce = setTimeout(() => this.searchWorldwideLocations(query), wait);
      return;
    }

    this.geocodeController?.abort();
    this.geocodeController = new AbortController();
    this.geocodeRequestQuery = normalizedQuery;
    this.lastGeocodeRequestAt = Date.now();
    this.renderLocationSearch('Searching worldwide places…', []);
    let requestTimedOut = false;
    const timeoutId = setTimeout(() => {
      requestTimedOut = true;
      this.geocodeController?.abort();
    }, 10000);

    try {
      const url = new URL(GEOCODING_URL);
      url.searchParams.set('q', query);
      url.searchParams.set('limit', '6');
      url.searchParams.set('lang', 'en');
      const response = await fetch(url, { signal: this.geocodeController.signal });
      if (!response.ok) throw new Error(`Geocoding service returned HTTP ${response.status}.`);
      const data = await response.json();
      const features = Array.isArray(data.features) ? data.features : [];
      this.geocodeCache.set(normalizedQuery, features);
      if (this.geocodeCache.size > 50) this.geocodeCache.delete(this.geocodeCache.keys().next().value);
      if (this.geocodeSearchQuery.trim().toLowerCase() !== normalizedQuery) return;
      this.renderLocationSearch(features.length ? 'Select a matching place.' : 'No worldwide locations found. Try another name.', features);
    } catch (error) {
      if (error.name === 'AbortError' && !requestTimedOut) return;
      if (this.geocodeSearchQuery.trim().toLowerCase() === normalizedQuery) {
        const message = requestTimedOut
          ? 'Worldwide place search timed out. Try again in a moment.'
          : 'Worldwide place search is temporarily unavailable. Check your connection and try again.';
        this.renderLocationSearch(message, []);
      }
    } finally {
      clearTimeout(timeoutId);
      if (this.geocodeRequestQuery === normalizedQuery) this.geocodeRequestQuery = null;
    }
  }

  selectGeocodedLocation(feature) {
    const properties = feature.properties || {};
    const coordinates = feature.geometry?.coordinates || [];
    const lng = Number(coordinates[0]);
    const lat = Number(coordinates[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      this.renderLocationSearch('This result does not include usable coordinates. Choose another place.', []);
      return;
    }

    const geocoderId = `${properties.osm_type || 'place'}-${properties.osm_id || `${lat},${lng}`}`;
    let location = this.locations.find(candidate => candidate.geocoderId === geocoderId);
    if (!location) {
      location = {
        id: `GEO-${geocoderId.replace(/[^A-Za-z0-9_-]/g, '-')}`,
        geocoderId,
        name: properties.name || 'Selected place',
        country: properties.country || '',
        state: properties.state || properties.province || '',
        district: properties.district || properties.county || properties.state_district || properties.city || properties.municipality || properties.locality || '',
        lat,
        lng,
        source: 'Photon / OpenStreetMap',
        prototypeDataOnly: true,
        riskDataAvailable: false,
        distanceFromEyeKm: null,
        windSpeedKmh: null,
        gustKmh: null,
        rainfallMm24h: null,
        rainfallIntensityMmH: null,
        elevationMeters: null,
        stormSurgeMeters: null,
        tidePhase: null,
        populationDensity: null,
        windRiskScore: null,
        windRiskLevel: null,
        rainRiskScore: null,
        rainRiskLevel: null,
        floodRiskScore: null,
        floodRiskLevel: null,
        vulnerabilityScore: null,
        vulnerabilityLevel: null,
        compoundRiskScore: null,
        compoundRiskLevel: null,
        evacuationPriority: null,
        aiExplanation: 'Risk data unavailable for this location.',
        recommendedActions: []
      };
      this.locations.push(location);
      this.renderTableRows(this.locations);
      const option = document.createElement('option');
      option.value = location.name;
      option.label = [location.district, location.state, location.country].filter(Boolean).join(', ');
      document.getElementById('location-suggestions').appendChild(option);
    }

    this.closeLocationSearch();
    this.selectLocation(location.id, true);
  }

  selectManualLocation(name) {
    this.coordinateAssessmentController?.abort();
    this.activeLocationId = null;
    this.activeLocationName = name;
    document.getElementById('location-select').value = name;
    document.getElementById('selected-loc-name').textContent = name;
    document.getElementById('card-sub-loc-name').textContent = name;
    document.getElementById('selected-loc-meta').textContent = 'Location data not available for this prototype';
    document.getElementById('selected-loc-coords').textContent = 'Coordinates not provided';
    this.clearLocationRisk('Location data not available for this prototype. Select a listed location to view its data.');
    ['sim-wind-input', 'sim-rain-input', 'sim-distance-input', 'sim-flood-input', 'sim-elevation-input', 'sim-population-input']
      .forEach(id => { document.getElementById(id).value = ''; });
    if (this.map) this.map.renderLocations(this.locations, null);
    this.highlightTableRow(null);
  }

  clearLocationRisk(message) {
    document.getElementById('compound-score-display').textContent = '--';
    const heroBadge = document.getElementById('compound-risk-level-badge');
    heroBadge.className = 'px-3 py-1 rounded-full text-xs font-extrabold tracking-wider uppercase border shadow-sm bg-ops-800 text-slate-300 border-ops-600';
    heroBadge.textContent = 'DATA UNAVAILABLE';
    const circle = document.getElementById('compound-gauge-circle');
    circle.style.strokeDashoffset = 264;
    circle.style.stroke = '#64748B';
    ['loc-elevation', 'loc-surge', 'loc-pop-density', 'loc-evac-priority'].forEach(id => {
      document.getElementById(id).textContent = '--';
    });
    document.getElementById('cyclone-distance').textContent = '-- km';
    document.getElementById('cyclone-rain-intensity').textContent = '-- mm';
    document.getElementById('cyclone-rain-rate').textContent = '--';
    document.getElementById('compound-ai-explanation').textContent = message;
    this.updateHazardCards({});
    document.getElementById('recommended-actions-list').innerHTML = '';
    document.getElementById('sim-result-score').textContent = '--';
    document.getElementById('sim-result-badge').textContent = 'Data unavailable';
    ['sim-wind-risk', 'sim-rain-risk', 'sim-flood-risk', 'sim-vulnerability-risk'].forEach(id => {
      document.getElementById(id).textContent = '--';
    });
    document.getElementById('sim-result-text').textContent = message;
    if (this.charts) {
      this.charts.renderBreakdown({
        windRiskScore: null,
        rainRiskScore: null,
        floodRiskScore: null,
        vulnerabilityScore: null
      });
    }
  }

  /* -------------------------------------------------------------
   * 4. Interactive Map Initialization
   * ------------------------------------------------------------- */
  initMap() {
    this.map = new CycloneMap('riskMap', {
      onLocationSelect: (id) => this.selectLocation(id, true)
    });

    if (this.activeCyclone) this.map.renderCyclone(this.activeCyclone);
    this.map.renderLocations(this.locations, this.activeLocationId);
  }

  /* -------------------------------------------------------------
   * 5. Charts Initialization
   * ------------------------------------------------------------- */
  initCharts() {
    this.charts = new RiskCharts('breakdownChart', 'timelineChart');
    this.charts.renderTimeline([]);
  }

  initTabs() {
    const tabFactorsBtn = document.getElementById('tab-factors-btn');
    const tabTimelineBtn = document.getElementById('tab-timeline-btn');
    const chartFactorsCont = document.getElementById('chart-factors-container');
    const chartTimelineCont = document.getElementById('chart-timeline-container');

    if (tabFactorsBtn && tabTimelineBtn) {
      tabFactorsBtn.addEventListener('click', () => {
        tabFactorsBtn.className = "px-2.5 py-1 text-xs font-medium rounded-md bg-ops-700 text-white transition";
        tabTimelineBtn.className = "px-2.5 py-1 text-xs font-medium rounded-md bg-ops-850 text-slate-400 hover:text-white hover:bg-ops-800 transition";
        chartFactorsCont.classList.remove('hidden');
        chartTimelineCont.classList.add('hidden');
      });

      tabTimelineBtn.addEventListener('click', () => {
        tabTimelineBtn.className = "px-2.5 py-1 text-xs font-medium rounded-md bg-ops-700 text-white transition";
        tabFactorsBtn.className = "px-2.5 py-1 text-xs font-medium rounded-md bg-ops-850 text-slate-400 hover:text-white hover:bg-ops-800 transition";
        chartTimelineCont.classList.remove('hidden');
        chartFactorsCont.classList.add('hidden');
        this.charts.renderTimeline(this.activeTimelineForecast);
      });
    }
  }

  /* -------------------------------------------------------------
   * 6. Location Selection & View Synchronization
   * ------------------------------------------------------------- */
  selectLocation(locationId, shouldFlyMap = false, syncInputs = true) {
    const loc = this.locations.find(l => l.id === locationId);
    if (!loc) return;

    if (this.activeLocationId !== locationId && !loc.geocoderId && !loc.regionalGridPoint) {
      this.coordinateAssessmentController?.abort();
    }

    this.activeLocationId = locationId;
    this.activeLocationName = loc.name;

    // Update searchable location input
    const locationInput = document.getElementById('location-select');
    if (locationInput && locationInput.value !== loc.name) {
      locationInput.value = loc.name;
    }

    // A. Update Compound Hero Section
    document.getElementById('selected-loc-name').textContent = loc.name;
    document.getElementById('card-sub-loc-name').textContent = loc.name;
    document.getElementById('selected-loc-meta').textContent = [loc.district, loc.state, loc.country]
      .filter((value, index, values) => value && values.indexOf(value) === index)
      .join(', ') || 'Administrative details unavailable';
    document.getElementById('selected-loc-coords').textContent = `${loc.lat.toFixed(2)}°N, ${loc.lng.toFixed(2)}°E`;
    const awaitingAnalysis = loc.compoundRiskScore == null;
    document.getElementById('compound-score-display').textContent = displayValue(loc.compoundRiskScore);
    document.getElementById('loc-elevation').textContent = displayValue(loc.elevationMeters, ' m');
    document.getElementById('loc-surge').textContent = loc.stormSurgeMeters == null
      ? '--'
      : `${loc.stormSurgeMeters} m (${loc.tidePhase || 'tide data unavailable'})`;
    document.getElementById('loc-pop-density').textContent = displayValue(loc.populationDensity);
    document.getElementById('loc-evac-priority').textContent = displayValue(loc.evacuationPriority);
    document.getElementById('compound-ai-explanation').textContent = loc.forecastAssessment
      ? `Forecast screening estimate, not an official cyclone warning. ${loc.aiExplanation}`
      : loc.scenarioPrediction
        ? `Risk data unavailable for this location. Scenario estimate based on entered inputs: ${loc.aiExplanation}`
        : loc.aiExplanation;

    // Update Banner Distance & Rain Rate for Selected Station
    document.getElementById('cyclone-distance').innerHTML = `${displayValue(loc.distanceFromEyeKm)} <span class="text-xs font-normal text-slate-400">km</span>`;
    document.getElementById('cyclone-rain-intensity').innerHTML = `${displayValue(loc.rainfallMm24h)} <span class="text-xs font-normal text-slate-400">mm</span>`;
    document.getElementById('cyclone-rain-rate').textContent = displayValue(loc.rainfallIntensityMmH, ' mm/h');

    // Dynamic Compound Badge & Gauge Styling
    const badgeStyle = getRiskBadgeClasses(loc.compoundRiskLevel || 'Low');
    const heroBadge = document.getElementById('compound-risk-level-badge');
    heroBadge.className = awaitingAnalysis
      ? 'px-3 py-1 rounded-full text-xs font-extrabold tracking-wider uppercase border shadow-sm bg-ops-800 text-slate-300 border-ops-600'
      : `px-3 py-1 rounded-full text-xs font-extrabold tracking-wider uppercase border shadow-sm ${badgeStyle.badgeBg}`;
    heroBadge.textContent = awaitingAnalysis
      ? 'AWAITING ANALYSIS'
      : loc.forecastAssessment
        ? `${loc.compoundRiskLevel} FORECAST SCREENING`
        : loc.scenarioPrediction
        ? `${loc.compoundRiskLevel} SCENARIO ESTIMATE`
        : `${loc.compoundRiskLevel} RISK`;

    // Circular Gauge Animation (Circumference of r=42 is ~264)
    const circle = document.getElementById('compound-gauge-circle');
    const circumference = 264;
    const offset = loc.compoundRiskScore == null
      ? circumference
      : circumference - (loc.compoundRiskScore / 100) * circumference;
    circle.style.strokeDashoffset = offset;
    circle.style.stroke = awaitingAnalysis ? '#64748B' : badgeStyle.ringColor;

    // B. Update Disaggregated Hazard Cards
    this.updateHazardCards(loc);

    // C. Update Recommended Actions List
    const actionsList = document.getElementById('recommended-actions-list');
    actionsList.innerHTML = '';
    (loc.recommendedActions || []).forEach(act => {
      const li = document.createElement('li');
      li.textContent = act;
      actionsList.appendChild(li);
    });

    // D. Update Breakdown Chart
    if (this.charts) {
      this.charts.renderBreakdown(loc);
    }

    // E. Synchronize Map Markers & Focus
    if (this.map) {
      this.map.renderLocations(this.locations, this.activeLocationId);
      if (shouldFlyMap) {
        this.map.focusLocation(loc);
      }
    }

    // F. Highlight Table Row
    this.highlightTableRow(locationId);

    // G. Sync Simulator Values to Current Location
    if (syncInputs && loc.geocoderId) this.clearCoordinateInputs();
    else if (syncInputs && loc.riskDataAvailable === false) this.syncPrototypeScenario(loc);
    else if (syncInputs) this.syncSimulatorToLocation(loc);
    if (syncInputs) this.clearScenarioResult(loc.forecastAssessment
      ? `Live forecast assessment for ${loc.name}.`
      : loc.scenarioPrediction
      ? 'Risk data unavailable for this location. Showing a scenario estimate based on entered inputs.'
      : awaitingAnalysis
        ? 'Risk data unavailable for this location. Enter scenario values to request a modeled estimate.'
        : 'Select Analyze Scenario to calculate a backend prediction for this location.');

    this.activeTimelineForecast = loc.forecastTrend || [];
    if (this.charts) this.charts.renderTimeline(this.activeTimelineForecast);
    if (syncInputs && (loc.geocoderId || loc.regionalGridPoint) && this.shouldRefreshCoordinateAssessment(loc)) {
      this.assessCoordinateLocation(loc);
    }
  }

  shouldRefreshCoordinateAssessment(location) {
    return !location.assessedAt || Date.now() - location.assessedAt > 10 * 60 * 1000;
  }

  clearCoordinateInputs() {
    ['sim-wind-input', 'sim-rain-input', 'sim-distance-input', 'sim-flood-input', 'sim-elevation-input', 'sim-population-input']
      .forEach(id => { document.getElementById(id).value = ''; });
  }

  clearScenarioResult(message) {
    document.getElementById('sim-result-score').textContent = '--';
    document.getElementById('sim-result-badge').textContent = 'Awaiting Analysis';
    ['sim-wind-risk', 'sim-rain-risk', 'sim-flood-risk', 'sim-vulnerability-risk'].forEach(id => {
      document.getElementById(id).textContent = '--';
    });
    document.getElementById('sim-result-text').textContent = message;
    document.getElementById('sim-result-source').textContent = '';
  }

  /* -------------------------------------------------------------
   * 7. Update 4 Hazard Cards
   * ------------------------------------------------------------- */
  updateHazardCards(loc) {
    // Wind
    document.getElementById('wind-risk-score').textContent = displayValue(loc.windRiskScore);
    document.getElementById('wind-risk-bar').style.width = `${loc.windRiskScore || 0}%`;
    document.getElementById('wind-risk-level-badge').textContent = loc.windRiskLevel || 'Unavailable';
    document.getElementById('wind-stat-speed').textContent = displayValue(loc.windSpeedKmh, ' km/h');
    document.getElementById('wind-stat-gust').textContent = displayValue(loc.gustKmh, ' km/h');

    // Rain
    document.getElementById('rain-risk-score').textContent = displayValue(loc.rainRiskScore);
    document.getElementById('rain-risk-bar').style.width = `${loc.rainRiskScore || 0}%`;
    document.getElementById('rain-risk-level-badge').textContent = loc.rainRiskLevel || 'Unavailable';
    document.getElementById('rain-stat-accum').textContent = displayValue(loc.rainfallMm24h, ' mm');
    document.getElementById('rain-stat-rate').textContent = displayValue(loc.rainfallIntensityMmH, ' mm/h');

    // Flood
    document.getElementById('flood-risk-score').textContent = displayValue(loc.floodRiskScore);
    document.getElementById('flood-risk-bar').style.width = `${loc.floodRiskScore || 0}%`;
    document.getElementById('flood-risk-level-badge').textContent = loc.floodRiskLevel || 'Unavailable';
    document.getElementById('flood-stat-surge').textContent = displayValue(loc.stormSurgeMeters, ' m');
    document.getElementById('flood-stat-tide').textContent = displayValue(loc.tidePhase);

    // Vulnerability
    document.getElementById('vuln-risk-score').textContent = displayValue(loc.vulnerabilityScore);
    document.getElementById('vuln-risk-bar').style.width = `${loc.vulnerabilityScore || 0}%`;
    document.getElementById('vuln-risk-level-badge').textContent = loc.vulnerabilityLevel || 'Unavailable';
    document.getElementById('vuln-stat-shelter').textContent = displayValue(loc.shelterCapacityUsedPct, '% Occupied');
    document.getElementById('vuln-stat-density').textContent = loc.populationDensity
      ? loc.populationDensity.split('(')[0].trim()
      : '--';
  }

  /* -------------------------------------------------------------
   * 8. Location-Wise Risk Table
   * ------------------------------------------------------------- */
  initTable() {
    this.renderTableRows(this.locations);

    const searchInput = document.getElementById('table-search-input');
    const categoryFilter = document.getElementById('table-category-filter');

    const handleFilter = () => {
      const query = (searchInput.value || '').toLowerCase().trim();
      const cat = categoryFilter.value;

      const filtered = this.locations.filter(loc => {
        const matchesQuery = loc.name.toLowerCase().includes(query) ||
                             loc.district.toLowerCase().includes(query) ||
                             loc.state.toLowerCase().includes(query);
        const matchesCat = (cat === 'ALL') || (loc.compoundRiskLevel === cat);
        return matchesQuery && matchesCat;
      });

      this.renderTableRows(filtered);
    };

    searchInput.addEventListener('input', handleFilter);
    categoryFilter.addEventListener('change', handleFilter);
  }

  renderTableRows(locs) {
    const tbody = document.getElementById('risk-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (locs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="py-8 text-center text-slate-500 italic text-xs">
            No monitoring sectors match current filters.
          </td>
        </tr>
      `;
      return;
    }

    locs.forEach(loc => {
      const isSelected = loc.id === this.activeLocationId;
      const tr = document.createElement('tr');
      tr.id = `table-row-${loc.id}`;
      tr.className = `cursor-pointer transition-colors duration-150 ${isSelected ? 'bg-red-500/10 border-l-4 border-red-500' : 'hover:bg-ops-800/60'}`;

      const riskAvailable = loc.compoundRiskScore != null;
      const badge = riskAvailable
        ? getRiskBadgeClasses(loc.compoundRiskLevel)
        : { badgeBg: 'bg-ops-800 text-slate-400 border-ops-600' };

      tr.innerHTML = `
        <td class="py-3 px-4">
          <div class="font-bold text-slate-100">${escapeHtml(loc.name)}</div>
          <div class="text-[11px] text-slate-400">${escapeHtml([loc.district, loc.state, loc.country].filter(Boolean).join(', '))}</div>
        </td>
        <td class="py-3 px-3 text-center font-mono font-medium">${displayValue(loc.distanceFromEyeKm, ' km')}</td>
        <td class="py-3 px-3 text-center font-mono">${displayValue(loc.elevationMeters, 'm')}</td>
        <td class="py-3 px-3 text-center">
          <span class="font-mono font-bold ${loc.windRiskScore >= 80 ? 'text-red-400' : 'text-slate-300'}">${displayValue(loc.windRiskScore)}</span>
        </td>
        <td class="py-3 px-3 text-center">
          <span class="font-mono font-bold ${loc.rainRiskScore >= 80 ? 'text-cyan-400' : 'text-slate-300'}">${displayValue(loc.rainRiskScore)}</span>
        </td>
        <td class="py-3 px-3 text-center">
          <span class="font-mono font-bold ${loc.floodRiskScore >= 80 ? 'text-amber-400' : 'text-slate-300'}">${displayValue(loc.floodRiskScore)}</span>
        </td>
        <td class="py-3 px-3 text-center">
          <span class="font-mono font-black text-sm text-white">${riskAvailable ? `${loc.compoundRiskScore}%` : '--'}</span>
        </td>
        <td class="py-3 px-3 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badge.badgeBg}">
            ${loc.compoundRiskLevel || 'Awaiting Analysis'}
          </span>
        </td>
        <td class="py-3 px-4 text-center">
          <button class="px-2.5 py-1 bg-ops-800 hover:bg-ops-700 text-slate-200 rounded border border-ops-600 text-[11px] transition inline-flex items-center gap-1">
            <i class="fa-solid fa-crosshairs text-red-400"></i> Inspect
          </button>
        </td>
      `;

      tr.addEventListener('click', () => {
        this.selectLocation(loc.id, true);
      });

      tbody.appendChild(tr);
    });
  }

  highlightTableRow(locId) {
    this.locations.forEach(loc => {
      const row = document.getElementById(`table-row-${loc.id}`);
      if (row) {
        if (loc.id === locId) {
          row.className = "cursor-pointer transition-colors duration-150 bg-red-500/10 border-l-4 border-red-500";
        } else {
          row.className = "cursor-pointer transition-colors duration-150 hover:bg-ops-800/60";
        }
      }
    });
  }

  /* -------------------------------------------------------------
   * 9. What-If Scenario Simulation Studio
   * ------------------------------------------------------------- */
  initSimulator() {
    const windInput = document.getElementById('sim-wind-input');
    const rainInput = document.getElementById('sim-rain-input');
    const distanceInput = document.getElementById('sim-distance-input');
    const floodInput = document.getElementById('sim-flood-input');
    const elevationInput = document.getElementById('sim-elevation-input');
    const populationInput = document.getElementById('sim-population-input');
    const analyzeBtn = document.getElementById('sim-analyze-btn');
    const resetBtn = document.getElementById('reset-sim-btn');

    analyzeBtn.addEventListener('click', () => this.analyzeScenario(analyzeBtn));

    resetBtn.addEventListener('click', () => {
      const currentLoc = this.locations.find(l => l.id === this.activeLocationId);
      if (currentLoc?.geocoderId || currentLoc?.regionalGridPoint) this.assessCoordinateLocation(currentLoc, analyzeBtn);
      else if (currentLoc?.riskDataAvailable === false) this.syncPrototypeScenario(currentLoc);
      else if (currentLoc) this.syncSimulatorToLocation(currentLoc);
    });
  }

  async analyzeScenario(button) {
    const selectedLocation = this.locations.find(location => location.id === this.activeLocationId);
    if (!selectedLocation) {
      this.clearLocationRisk('Location data not available for this prototype. Select a listed location to analyze it.');
      return;
    }

    if (selectedLocation.geocoderId || selectedLocation.regionalGridPoint) {
      await this.assessCoordinateLocation(selectedLocation, button);
      return;
    }

    const fields = {
      wind_speed: document.getElementById('sim-wind-input'),
      rainfall: document.getElementById('sim-rain-input'),
      cyclone_distance: document.getElementById('sim-distance-input'),
      flood_vulnerability: document.getElementById('sim-flood-input'),
      elevation_risk: document.getElementById('sim-elevation-input'),
      population_vulnerability: document.getElementById('sim-population-input')
    };
    const status = document.getElementById('sim-result-text');
    const payload = {};

    for (const [name, input] of Object.entries(fields)) {
      const value = input.value.trim();
      const number = Number(value);
      const max = name === 'wind_speed' ? 300 : name === 'rainfall' ? 500 : name === 'cyclone_distance' ? 2000 : 100;
      if (!value || !Number.isFinite(number) || number < 0 || number > max) {
        status.textContent = `${name.replaceAll('_', ' ')} must be a number from 0 to ${max}.`;
        input.focus();
        return;
      }
      payload[name] = number;
    }

    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...';
    }
    status.textContent = 'Requesting a prediction from the backend...';

    try {
      const response = await fetch(`${API_BASE_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error('The prediction service returned an invalid JSON response.');
      }

      if (!response.ok) {
        throw new Error(result.message || result.error || `The prediction service returned HTTP ${response.status}.`);
      }

      const numericKeys = ['wind_risk', 'rainfall_risk', 'flood_risk', 'local_vulnerability', 'overall_risk'];
      if (!result || numericKeys.some(key => !Number.isFinite(Number(result[key]))) || typeof result.risk_level !== 'string') {
        throw new Error('The prediction service response is missing valid risk results.');
      }

      this.displayPrediction(result, payload);
    } catch (error) {
      status.textContent = error instanceof TypeError
        ? 'Cannot reach the prediction backend. Start Flask at http://localhost:5000 and try again.'
        : error.message || 'Prediction failed. Check the backend and try again.';
      document.getElementById('sim-result-badge').textContent = 'Unavailable';
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = '<i class="fa-solid fa-bolt"></i> Analyze Scenario';
      }
    }
  }

  async assessCoordinateLocation(location, button = null) {
    this.coordinateAssessmentController?.abort();
    const controller = new AbortController();
    this.coordinateAssessmentController = controller;
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    const status = document.getElementById('sim-result-text');
    const badge = document.getElementById('sim-result-badge');
    status.textContent = `Fetching live weather and elevation for ${location.name}…`;
    document.getElementById('sim-result-source').textContent = '';
    badge.textContent = 'Loading live data';
    badge.className = 'px-2.5 py-0.5 rounded text-[11px] font-extrabold uppercase bg-ops-800 text-slate-300 border border-ops-600';
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading data...';
    }

    try {
      const response = await fetch(RISK_ASSESSMENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          latitude: location.lat,
          longitude: location.lng,
          place_name: location.name,
          country: location.country,
          state: location.state,
          district: location.district
        })
      });
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error('The location assessment service returned an invalid response.');
      }
      if (!response.ok) throw new Error(result.message || `Live location assessment failed (HTTP ${response.status}).`);
      const resultKeys = ['wind_risk', 'rainfall_risk', 'flood_risk', 'local_vulnerability', 'overall_risk'];
      if (resultKeys.some(key => !Number.isFinite(Number(result[key]))) || !Array.isArray(result.trend)) {
        throw new Error('The location assessment response is incomplete.');
      }
      if (this.activeLocationId !== location.id) return;
      this.applyCoordinateAssessment(location, result);
    } catch (error) {
      if (error.name === 'AbortError' && this.activeLocationId !== location.id) return;
      if (this.activeLocationId !== location.id) return;

      const hadPreviousEstimate = Number.isFinite(location.compoundRiskScore) || Number.isFinite(location.windRiskScore);
      if (hadPreviousEstimate) {
        document.getElementById('sim-result-text').textContent = `Live assessment for ${location.name} is temporarily unavailable. Showing the last available estimate.`;
        document.getElementById('sim-result-badge').textContent = `${location.compoundRiskLevel || 'Last estimate'}${location.forecastAssessment ? ' Forecast' : ''}`;
        document.getElementById('sim-result-source').textContent = '';
        this.selectLocation(location.id, false, false);
        return;
      }

      Object.assign(location, {
        riskDataAvailable: false,
        forecastAssessment: false,
        compoundRiskScore: null,
        compoundRiskLevel: null,
        windRiskScore: null,
        rainRiskScore: null,
        floodRiskScore: null,
        vulnerabilityScore: null
      });
      const message = error.name === 'AbortError'
        ? 'Live location assessment timed out. Please retry.'
        : error.message || 'Live location assessment is unavailable. No risk estimate was generated.';
      this.selectLocation(location.id, false, false);
      this.clearLocationRisk(`Risk data unavailable for this location. ${message}`);
      document.getElementById('selected-loc-name').textContent = location.name;
      document.getElementById('selected-loc-meta').textContent = [location.district, location.state, location.country].filter(Boolean).join(', ');
      document.getElementById('selected-loc-coords').textContent = `${location.lat.toFixed(2)}°N, ${location.lng.toFixed(2)}°E`;
      document.getElementById('sim-result-text').textContent = `Risk data unavailable for ${location.name}. ${message}`;
      this.renderTableRows(this.locations);
    } finally {
      clearTimeout(timeoutId);
      if (this.coordinateAssessmentController === controller) this.coordinateAssessmentController = null;
      if (button) {
        button.disabled = false;
        button.innerHTML = '<i class="fa-solid fa-bolt"></i> Analyze Scenario';
      }
    }
  }

  applyCoordinateAssessment(location, result) {
    const inputs = result.inputs || {};
    Object.assign(location, {
      windSpeedKmh: inputs.wind_speed_kmh ?? null,
      gustKmh: inputs.wind_gust_kmh ?? null,
      rainfallMm24h: inputs.rainfall_24h_mm ?? null,
      rainfallIntensityMmH: inputs.rainfall_24h_mm == null ? null : Math.round(inputs.rainfall_24h_mm / 24 * 10) / 10,
      elevationMeters: inputs.elevation_m ?? null,
      stormSurgeMeters: inputs.wave_height_m ?? null,
      tidePhase: inputs.sea_level_height_msl == null ? null : `Sea level ${inputs.sea_level_height_msl} m MSL`,
      windRiskScore: result.wind_risk,
      windRiskLevel: result.breakdown?.wind_risk_level || result.risk_level,
      rainRiskScore: result.rainfall_risk,
      rainRiskLevel: result.breakdown?.rainfall_risk_level || result.risk_level,
      floodRiskScore: result.flood_risk,
      floodRiskLevel: result.breakdown?.flood_risk_level || result.risk_level,
      vulnerabilityScore: result.local_vulnerability,
      vulnerabilityLevel: result.breakdown?.local_vulnerability_level || result.risk_level,
      compoundRiskScore: result.overall_risk,
      compoundRiskLevel: result.risk_level,
      riskDataAvailable: true,
      forecastAssessment: true,
      scenarioPrediction: false,
      assessedAt: Date.now(),
      forecastTrend: result.trend,
      aiExplanation: `${result.risk_message} ${result.breakdown?.local_vulnerability_basis || ''}`
    });

    this.locations = this.locations.filter(candidate => candidate.parentGeoId !== location.id);
    (result.regional_subzones || []).forEach((subzone, index) => {
      if (!Number.isFinite(Number(subzone.latitude)) || !Number.isFinite(Number(subzone.longitude))) return;
      this.locations.push({
        id: `${location.id}-AREA-${index}`,
        parentGeoId: location.id,
        regionalGridPoint: true,
        name: `${subzone.name} of ${location.name}`,
        district: 'Nearby forecast grid sample',
        state: location.state,
        country: location.country,
        lat: Number(subzone.latitude),
        lng: Number(subzone.longitude),
        distanceFromEyeKm: null,
        elevationMeters: subzone.elevation_m,
        windSpeedKmh: null,
        gustKmh: null,
        rainfallMm24h: null,
        rainfallIntensityMmH: null,
        stormSurgeMeters: null,
        tidePhase: null,
        populationDensity: null,
        windRiskScore: subzone.wind_risk,
        windRiskLevel: subzone.risk_level,
        rainRiskScore: subzone.rainfall_risk,
        rainRiskLevel: subzone.risk_level,
        floodRiskScore: subzone.flood_risk,
        floodRiskLevel: subzone.risk_level,
        vulnerabilityScore: subzone.local_vulnerability,
        vulnerabilityLevel: subzone.risk_level,
        compoundRiskScore: subzone.overall_risk,
        compoundRiskLevel: subzone.risk_level,
        riskDataAvailable: true,
        forecastAssessment: true,
        scenarioPrediction: false,
        assessedAt: Date.now(),
        forecastTrend: [],
        aiExplanation: 'Nearby forecast grid sample; not an administrative sub-zone.' ,
        recommendedActions: []
      });
    });

    this.selectLocation(location.id, false, false);
    this.renderTableRows(this.locations);
    this.activeTimelineForecast = result.trend;
    if (this.charts) this.charts.renderTimeline(this.activeTimelineForecast);
    document.getElementById('sim-result-score').textContent = result.overall_risk;
    const resultBadge = document.getElementById('sim-result-badge');
    resultBadge.textContent = `${result.risk_level} Forecast Screening`;
    const badgeStyle = getRiskBadgeClasses(result.risk_level);
    resultBadge.className = `px-2.5 py-0.5 rounded text-[11px] font-extrabold uppercase border ${badgeStyle.badgeBg}`;
    document.getElementById('sim-wind-risk').textContent = `${result.wind_risk} / 100`;
    document.getElementById('sim-rain-risk').textContent = `${result.rainfall_risk} / 100`;
    document.getElementById('sim-flood-risk').textContent = `${result.flood_risk} / 100`;
    document.getElementById('sim-vulnerability-risk').textContent = `${result.local_vulnerability} / 100`;
    document.getElementById('sim-result-text').textContent = `Live forecast screening for ${location.name}: ${result.risk_message}`;
    this.setAssessmentAttribution(result.data_sources || []);
  }

  setAssessmentAttribution(sources) {
    const element = document.getElementById('sim-result-source');
    const sourceLinks = [
      { match: 'Open-Meteo', label: 'Open-Meteo', href: 'https://open-meteo.com/' },
      { match: 'Copernicus', label: 'Copernicus DEM', href: 'https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model' },
      { match: 'DWD', label: 'DWD', href: 'https://www.dwd.de/EN/service/copyright/copyright_node.html' }
    ];
    element.replaceChildren();
    const labels = sourceLinks.filter(source => sources.some(value => value.includes(source.match)));
    if (!labels.length) return;
    element.append('Data sources: ');
    labels.forEach((source, index) => {
      if (index) element.append(', ');
      const link = document.createElement('a');
      link.href = source.href;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.className = 'underline hover:text-slate-200';
      link.textContent = source.label;
      element.appendChild(link);
    });
  }

  displayPrediction(result, inputs) {
    const level = result.risk_level;
    const badgeStyle = getRiskBadgeClasses(level);
    const local = this.locations.find(location => location.id === this.activeLocationId);
    const locationName = this.activeLocationName || local?.name || 'Selected location';

    document.getElementById('sim-result-score').textContent = result.overall_risk;
    const resultBadge = document.getElementById('sim-result-badge');
    resultBadge.className = `px-2.5 py-0.5 rounded text-[11px] font-extrabold uppercase border ${badgeStyle.badgeBg}`;
    resultBadge.textContent = level;
    document.getElementById('sim-wind-risk').textContent = `${result.wind_risk} / 100`;
    document.getElementById('sim-rain-risk').textContent = `${result.rainfall_risk} / 100`;
    document.getElementById('sim-flood-risk').textContent = `${result.flood_risk} / 100`;
    document.getElementById('sim-vulnerability-risk').textContent = `${result.local_vulnerability} / 100`;
    const isScenarioEstimate = local?.riskDataAvailable === false;
    document.getElementById('sim-result-text').textContent = isScenarioEstimate
      ? `Risk data unavailable for ${locationName}. Scenario estimate: ${result.risk_message}`
      : `${locationName}: ${result.risk_message}`;

    if (!local || locationName !== local.name) return;
    const breakdown = result.breakdown || {};
    Object.assign(local, {
      windSpeedKmh: inputs.wind_speed,
      rainfallMm24h: inputs.rainfall,
      distanceFromEyeKm: inputs.cyclone_distance,
      windRiskScore: result.wind_risk,
      windRiskLevel: breakdown.wind_risk_level || level,
      rainRiskScore: result.rainfall_risk,
      rainRiskLevel: breakdown.rainfall_risk_level || level,
      floodRiskScore: result.flood_risk,
      floodRiskLevel: breakdown.flood_risk_level || level,
      vulnerabilityScore: result.local_vulnerability,
      vulnerabilityLevel: breakdown.local_vulnerability_level || level,
      compoundRiskScore: result.overall_risk,
      compoundRiskLevel: level,
      aiExplanation: result.risk_message,
      scenarioPrediction: isScenarioEstimate,
      scenarioInputs: { ...inputs }
    });
    this.selectLocation(local.id, false, false);
    this.renderTableRows(this.locations);
  }

  syncPrototypeScenario(loc) {
    const inputs = loc.scenarioInputs;
    document.getElementById('sim-wind-input').value = inputs?.wind_speed ?? '';
    document.getElementById('sim-rain-input').value = inputs?.rainfall ?? '';
    document.getElementById('sim-distance-input').value = loc.distanceFromEyeKm ?? '';
    document.getElementById('sim-flood-input').value = inputs?.flood_vulnerability ?? '';
    document.getElementById('sim-elevation-input').value = inputs?.elevation_risk ?? '';
    document.getElementById('sim-population-input').value = inputs?.population_vulnerability ?? '';
  }

  syncSimulatorToLocation(loc) {
    document.getElementById('sim-wind-input').value = loc.windSpeedKmh;
    document.getElementById('sim-rain-input').value = loc.rainfallMm24h;
    document.getElementById('sim-distance-input').value = loc.distanceFromEyeKm;
    document.getElementById('sim-flood-input').value = loc.floodRiskScore;
    document.getElementById('sim-elevation-input').value = Math.max(0, Math.min(100, 100 - loc.elevationMeters));
    document.getElementById('sim-population-input').value = loc.vulnerabilityScore;
  }

  /* -------------------------------------------------------------
   * 10. Emergency Advisories Feed
   * ------------------------------------------------------------- */
  initAdvisories() {
    const container = document.getElementById('advisories-container');
    if (!container) return;

    container.innerHTML = '';
    container.textContent = 'No official warning feed is connected. Consult your national meteorological and emergency-management agencies for active alerts.';
  }

  /* -------------------------------------------------------------
   * 11. Export Briefing Feature
   * ------------------------------------------------------------- */
  initExport() {
    const exportBtn = document.getElementById('export-briefing-btn');
    if (!exportBtn) return;

    exportBtn.addEventListener('click', () => {
      const loc = this.locations.find(l => l.id === this.activeLocationId);
      const briefData = {
        title: "AI-Based Cyclone Compound Local Impact Prediction Briefing",
        generatedAt: new Date().toISOString(),
        activeCyclone: this.activeCyclone,
        inspectedStation: loc,
        allMonitoredLocations: this.locations
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(briefData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Cyclone_Compound_Risk_${loc.id}_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
  }
}

// Instantiate on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
