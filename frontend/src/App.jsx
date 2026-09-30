import React, { useState, useEffect } from 'react';
import EmergencyTicker from './components/EmergencyTicker';
import Header from './components/Header';
import InputPanel from './components/InputPanel';
import RiskGauge from './components/RiskGauge';
import RiskBreakdown from './components/RiskBreakdown';
import MapComponent from './components/MapComponent';
import ImpactCharts from './components/ImpactCharts';
import ActionRecommendations from './components/ActionRecommendations';
import RegionalSubzones from './components/RegionalSubzones';
import LocationSearch from './components/LocationSearch';
import LiveWeatherPanel from './components/LiveWeatherPanel';
import {
  checkBackendHealth,
  fetchCycloneMetadata,
  predictRisk,
  assessCoordinateRisk,
  getLiveWeather,
} from './services/api';
import { MapPin, Wind, Satellite } from 'lucide-react';

const DEFAULT_PARAMS = {
  wind_speed: 165,
  rainfall: 240,
  cyclone_distance: 68,
  flood_vulnerability: 95,
  elevation_risk: 90,
  population_vulnerability: 82,
};

export default function App() {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [activeCyclone, setActiveCyclone] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState('custom');
  const [assessment, setAssessment] = useState(null);
  const [liveWeatherData, setLiveWeatherData] = useState(null);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState('coordinates'); // Start with location mode
  const [selectedCoord, setSelectedCoord] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Initial setup
  useEffect(() => {
    async function init() {
      const health = await checkBackendHealth();
      setIsBackendConnected(!!health);

      const meta = await fetchCycloneMetadata();
      if (meta) {
        setActiveCyclone(meta.active_cyclone);
        setScenarios(meta.sample_scenarios || []);
      }
    }
    init();
  }, []);

  // Calculate manual risk from sliders
  const calculateManualRisk = async (inputParams) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await predictRisk(inputParams || params);
      setAssessment(res);
      setLiveWeatherData(null); // Clear live weather when using manual mode
    } catch (err) {
      setErrorMessage(err.message || 'Error communicating with backend API.');
    } finally {
      setIsLoading(false);
    }
  };

  // Assess risk for a selected location using live weather API
  const handleLocationSelect = async (loc) => {
    setIsLoading(true);
    setErrorMessage(null);
    const coord = { lat: loc.lat, lng: loc.lng, name: loc.name };
    setSelectedCoord(coord);

    try {
      // 1. Get live weather
      const weatherRes = await getLiveWeather(loc.lat, loc.lng);
      setLiveWeatherData(weatherRes);

      // 2. Get compound risk assessment
      const riskRes = await assessCoordinateRisk(loc.lat, loc.lng, {
        name: loc.name,
        country: loc.country || '',
        state: loc.state || '',
        district: loc.district || '',
      });
      setAssessment(riskRes);

      // Sync sliders from returned inputs
      if (riskRes.inputs) {
        setParams((prev) => ({
          ...prev,
          wind_speed: Math.round(riskRes.inputs.wind_speed || prev.wind_speed),
          rainfall: Math.round(riskRes.inputs.rainfall || prev.rainfall),
          flood_vulnerability: Math.round(riskRes.inputs.flood_vulnerability || prev.flood_vulnerability),
          elevation_risk: Math.round(riskRes.inputs.elevation_risk || prev.elevation_risk),
        }));
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to fetch live weather data. Check backend.');
    } finally {
      setIsLoading(false);
    }
  };

  // Scenario preset selection
  const handleSelectScenario = (scenarioName) => {
    setSelectedScenario(scenarioName);
    if (scenarioName === 'custom') return;
    const found = scenarios.find((s) => s.name === scenarioName);
    if (found?.input) {
      setParams(found.input);
      calculateManualRisk(found.input);
      setMode('manual');
    }
  };

  const handleReset = () => {
    setParams(DEFAULT_PARAMS);
    setSelectedScenario('custom');
    setAssessment(null);
    setLiveWeatherData(null);
    setSelectedCoord(null);
    setErrorMessage(null);
  };

  const handleMapLocationClick = (lat, lng) => {
    const loc = {
      lat, lng,
      name: `Map Point (${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E)`,
      country: '', state: '', district: ''
    };
    handleLocationSelect(loc);
  };

  return (
    <div className="min-h-screen bg-[#070C18] text-slate-100 flex flex-col antialiased">
      {/* Emergency Ticker Bar */}
      <EmergencyTicker activeCyclone={activeCyclone} isBackendConnected={isBackendConnected} />

      {/* Header */}
      <Header
        activeCyclone={activeCyclone}
        scenarios={scenarios}
        selectedScenario={selectedScenario}
        onSelectScenario={handleSelectScenario}
        onReset={handleReset}
        isPredicting={isLoading}
      />

      {/* Error Banner */}
      {errorMessage && (
        <div className="max-w-7xl mx-auto px-4 mt-3 w-full">
          <div className="bg-red-950/80 border border-red-500/50 text-red-200 px-4 py-2.5 rounded-lg text-xs flex items-center justify-between shadow">
            <span>⚠ {errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white font-bold ml-4">✕</button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ─── LOCATION SEARCH BAR (Full Width) ─── */}
        <div className="bg-[#0F172A] border border-[#334155]/60 rounded-xl p-4 shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Location — Worldwide & All Tamil Nadu Districts
            </h2>
            <span className="ml-auto text-[10px] text-slate-400 bg-ops-900 px-2 py-1 rounded border border-ops-700">
              🌐 Free API: <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">open-meteo.com</a> — No API Key
            </span>
          </div>
          <LocationSearch
            onSelectLocation={handleLocationSelect}
            selectedLocation={selectedCoord}
          />
          {selectedCoord && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
              <Satellite className="w-3.5 h-3.5 text-blue-400" />
              <span>
                Currently assessing: <strong className="text-white">{selectedCoord.name}</strong>
                <span className="font-mono ml-2">{selectedCoord.lat.toFixed(4)}°N, {selectedCoord.lng.toFixed(4)}°E</span>
              </span>
              {isLoading && (
                <span className="text-blue-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping"></span>
                  Fetching live data...
                </span>
              )}
            </div>
          )}
        </div>

        {/* ─── MAIN GRID: Left Controls + Right Risk Panels ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-5">
            <InputPanel
              params={params}
              onChange={(newParams) => {
                setParams(newParams);
                setSelectedScenario('custom');
              }}
              onCalculate={() => {
                setMode('manual');
                calculateManualRisk(params);
              }}
              onCoordinateAssess={(lat, lng, locData) =>
                handleLocationSelect({ lat, lng, ...locData })
              }
              isLoading={isLoading}
              mode={mode}
              setMode={setMode}
            />
          </div>

          {/* Risk Gauge + Breakdown */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <RiskGauge assessment={assessment} isLoading={isLoading} />
            <RiskBreakdown assessment={assessment} />
          </div>
        </div>

        {/* ─── LIVE WEATHER PANEL ─── */}
        {(liveWeatherData || assessment?.live_weather) && (
          <LiveWeatherPanel
            weatherData={liveWeatherData || { live_weather: assessment?.live_weather }}
            locationName={selectedCoord?.name}
          />
        )}

        {/* ─── MAP ─── */}
        <MapComponent
          cycloneData={{ active_cyclone: activeCyclone }}
          selectedCoord={selectedCoord}
          assessment={assessment}
          regionalSubzones={assessment?.regional_subzones}
          onLocationSelect={handleMapLocationClick}
        />

        {/* ─── REGIONAL SUBZONES ─── */}
        {assessment?.regional_subzones?.length > 0 && (
          <RegionalSubzones
            subzones={assessment.regional_subzones}
            selectedLocation={selectedCoord}
          />
        )}

        {/* ─── CHARTS ─── */}
        <ImpactCharts assessment={assessment} params={params} />

        {/* ─── ACTION DIRECTIVES ─── */}
        <ActionRecommendations assessment={assessment} params={params} />

        {/* ─── FREE API CREDITS ─── */}
        <div className="bg-[#0F172A] border border-[#334155]/60 rounded-xl p-4 shadow">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            🔓 Free APIs Used (No API Key Required)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                name: 'Open-Meteo Weather API',
                url: 'https://open-meteo.com',
                desc: 'Real-time worldwide weather forecast — wind, rain, temperature, pressure',
                badge: 'FREE'
              },
              {
                name: 'Open-Meteo Geocoding API',
                url: 'https://geocoding-api.open-meteo.com',
                desc: 'Worldwide location search — cities, districts, Tamil Nadu, all countries',
                badge: 'FREE'
              },
              {
                name: 'Open-Meteo Marine API',
                url: 'https://marine-api.open-meteo.com',
                desc: 'Coastal wave height, sea level, swell data for flood surge assessment',
                badge: 'FREE'
              }
            ].map((api) => (
              <a
                key={api.name}
                href={api.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-[#1E293B] border border-[#334155]/80 rounded-lg p-3 hover:border-blue-500/50 transition group"
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-xs font-bold text-white group-hover:text-blue-300">{api.name}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-400 border border-emerald-500/30">
                    {api.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{api.desc}</p>
                <span className="text-[10px] text-blue-400 font-mono mt-1 inline-block">{api.url} ↗</span>
              </a>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#070C18] border-t border-[#1E293B] text-slate-400 text-xs py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AI Cyclone Compound Impact Predictor — Powered by Python Flask + React Vite</span>
          <span>All weather data: <a href="https://open-meteo.com" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">open-meteo.com</a> — Free, No API Key</span>
        </div>
      </footer>
    </div>
  );
}
