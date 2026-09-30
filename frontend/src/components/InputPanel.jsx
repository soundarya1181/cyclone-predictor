import React, { useState } from 'react';
import { Sliders, MapPin, Wind, CloudRain, Navigation, Droplets, Mountain, Users, Play, Crosshair } from 'lucide-react';

const PRESET_COORDINATES = [
  { name: 'Paradip Port, Odisha', lat: 20.26, lng: 86.66, state: 'Odisha', country: 'India' },
  { name: 'Puri Coastal Sector', lat: 19.81, lng: 85.83, state: 'Odisha', country: 'India' },
  { name: 'Digha Coast, West Bengal', lat: 21.62, lng: 87.51, state: 'West Bengal', country: 'India' },
  { name: 'Kolkata Metropolitan', lat: 22.57, lng: 88.36, state: 'West Bengal', country: 'India' },
  { name: 'Visakhapatnam Harbor', lat: 17.68, lng: 83.21, state: 'Andhra Pradesh', country: 'India' },
  { name: 'Chennai Harbor, TN', lat: 13.08, lng: 80.27, state: 'Tamil Nadu', country: 'India' },
];

export default function InputPanel({
  params,
  onChange,
  onCalculate,
  onCoordinateAssess,
  isLoading,
  mode,
  setMode
}) {
  const [coords, setCoords] = useState({ lat: '20.26', lng: '86.66', name: 'Paradip Port, Odisha' });

  const handleSliderChange = (key, value) => {
    onChange({
      ...params,
      [key]: Number(value)
    });
  };

  const handleCoordSelect = (preset) => {
    setCoords({
      lat: preset.lat.toString(),
      lng: preset.lng.toString(),
      name: preset.name
    });
  };

  const handleCoordinateSubmit = (e) => {
    e.preventDefault();
    if (onCoordinateAssess) {
      onCoordinateAssess(parseFloat(coords.lat), parseFloat(coords.lng), { name: coords.name });
    }
  };

  return (
    <div className="bg-ops-850 border border-ops-700/60 rounded-xl p-5 shadow-xl flex flex-col gap-5">
      {/* Mode Switcher Tabs */}
      <div className="flex bg-ops-900 p-1 rounded-lg border border-ops-700/80">
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-md transition-all ${
            mode === 'manual'
              ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" /> Simulation Parameters
        </button>
        <button
          onClick={() => setMode('coordinates')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-md transition-all ${
            mode === 'coordinates'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" /> Live Location Forecast
        </button>
      </div>

      {mode === 'manual' ? (
        /* Manual Parameter Sliders */
        <div className="space-y-4">
          <div className="border-b border-ops-700/40 pb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Meteorological Hazard Drivers
            </h3>
            <p className="text-[11px] text-slate-400">Atmospheric kinematics and precipitation volume</p>
          </div>

          {/* Wind Speed */}
          <div className="space-y-1.5 bg-ops-900/70 p-3 rounded-lg border border-ops-750">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-300 font-medium flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-cyan-400" /> Max Sustained Wind Speed
              </label>
              <span className="font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40 text-xs">
                {params.wind_speed} km/h
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="280"
              step="5"
              value={params.wind_speed}
              onChange={(e) => handleSliderChange('wind_speed', e.target.value)}
              className="w-full h-1.5 bg-ops-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 km/h (Calm)</span>
              <span>120 (Cat 1)</span>
              <span>220+ (Super)</span>
            </div>
          </div>

          {/* 24h Rainfall */}
          <div className="space-y-1.5 bg-ops-900/70 p-3 rounded-lg border border-ops-750">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-300 font-medium flex items-center gap-1.5">
                <CloudRain className="w-3.5 h-3.5 text-blue-400" /> 24-Hour Rainfall Accumulation
              </label>
              <span className="font-mono font-bold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/40 text-xs">
                {params.rainfall} mm
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="450"
              step="10"
              value={params.rainfall}
              onChange={(e) => handleSliderChange('rainfall', e.target.value)}
              className="w-full h-1.5 bg-ops-950 rounded-lg appearance-none cursor-pointer accent-blue-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 mm</span>
              <span>150 mm (Heavy)</span>
              <span>450 mm (Extreme)</span>
            </div>
          </div>

          {/* Cyclone Distance */}
          <div className="space-y-1.5 bg-ops-900/70 p-3 rounded-lg border border-ops-750">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-300 font-medium flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-amber-400" /> Distance from Eye Center
              </label>
              <span className="font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40 text-xs">
                {params.cyclone_distance} km
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="500"
              step="5"
              value={params.cyclone_distance}
              onChange={(e) => handleSliderChange('cyclone_distance', e.target.value)}
              className="w-full h-1.5 bg-ops-950 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 km (Direct Eye)</span>
              <span>250 km</span>
              <span>500 km (Periphery)</span>
            </div>
          </div>

          <div className="border-b border-ops-700/40 pt-2 pb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Local Vulnerability Multipliers
            </h3>
            <p className="text-[11px] text-slate-400">Terrain, surge exposure and demographic density</p>
          </div>

          {/* Flood Vulnerability */}
          <div className="space-y-1.5 bg-ops-900/70 p-3 rounded-lg border border-ops-750">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-300 font-medium flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-teal-400" /> Flood & Surge Exposure
              </label>
              <span className="font-mono font-bold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800/40 text-xs">
                {params.flood_vulnerability} / 100
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={params.flood_vulnerability}
              onChange={(e) => handleSliderChange('flood_vulnerability', e.target.value)}
              className="w-full h-1.5 bg-ops-950 rounded-lg appearance-none cursor-pointer accent-teal-400"
            />
          </div>

          {/* Elevation Risk */}
          <div className="space-y-1.5 bg-ops-900/70 p-3 rounded-lg border border-ops-750">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-300 font-medium flex items-center gap-1.5">
                <Mountain className="w-3.5 h-3.5 text-emerald-400" /> Low-Elevation Risk Factor
              </label>
              <span className="font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40 text-xs">
                {params.elevation_risk} / 100
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={params.elevation_risk}
              onChange={(e) => handleSliderChange('elevation_risk', e.target.value)}
              className="w-full h-1.5 bg-ops-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
          </div>

          {/* Population Vulnerability */}
          <div className="space-y-1.5 bg-ops-900/70 p-3 rounded-lg border border-ops-750">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-300 font-medium flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-purple-400" /> Population & Shelter Strain
              </label>
              <span className="font-mono font-bold text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40 text-xs">
                {params.population_vulnerability} / 100
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={params.population_vulnerability}
              onChange={(e) => handleSliderChange('population_vulnerability', e.target.value)}
              className="w-full h-1.5 bg-ops-950 rounded-lg appearance-none cursor-pointer accent-purple-400"
            />
          </div>

          {/* Calculate Button */}
          <button
            onClick={onCalculate}
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-lg shadow-lg shadow-red-900/40 flex items-center justify-center gap-2 text-sm transition-all transform active:scale-98 disabled:opacity-50"
          >
            <Play className={`w-4 h-4 fill-white ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Computing Compound Risk...' : 'Recalculate Compound Risk'}
          </button>
        </div>
      ) : (
        /* Coordinates Lookup Mode */
        <form onSubmit={handleCoordinateSubmit} className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-blue-400" />
              Live Coordinate Assessment
            </h3>
            <p className="text-[11px] text-slate-400">
              Queries real-time meteorological API & elevation data for precise geographic coordinates.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Quick Coastal Presets:</label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_COORDINATES.map((preset) => (
                <button
                  type="button"
                  key={preset.name}
                  onClick={() => handleCoordSelect(preset)}
                  className={`text-left p-2 rounded text-[11px] border transition ${
                    coords.name === preset.name
                      ? 'bg-blue-900/40 border-blue-500 text-blue-200'
                      : 'bg-ops-900 border-ops-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div className="font-bold truncate">{preset.name}</div>
                  <div className="font-mono text-[10px] text-slate-400">{preset.lat}°N, {preset.lng}°E</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Latitude (°N)</label>
              <input
                type="number"
                step="0.0001"
                min="-90"
                max="90"
                value={coords.lat}
                onChange={(e) => setCoords({ ...coords, lat: e.target.value })}
                className="w-full bg-ops-900 border border-ops-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Longitude (°E)</label>
              <input
                type="number"
                step="0.0001"
                min="-180"
                max="180"
                value={coords.lng}
                onChange={(e) => setCoords({ ...coords, lng: e.target.value })}
                className="w-full bg-ops-900 border border-ops-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-blue-500 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Location Label</label>
            <input
              type="text"
              value={coords.name}
              onChange={(e) => setCoords({ ...coords, name: e.target.value })}
              className="w-full bg-ops-900 border border-ops-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-3 py-3 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold rounded-lg shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2 text-sm transition-all disabled:opacity-50"
          >
            <MapPin className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Querying Live Forecast...' : 'Assess Coordinate Risk'}
          </button>
        </form>
      )}
    </div>
  );
}
