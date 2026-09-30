import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

export default function EmergencyTicker({ activeCyclone, isBackendConnected }) {
  const [timeString, setTimeString] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }) + ' UTC');
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // All ticker text is driven from live /api/cyclone data
  const cycloneName = activeCyclone?.name;
  const cycloneCategory = activeCyclone?.category;
  const landfall = activeCyclone?.estimated_landfall_location;
  const gusts = activeCyclone?.max_gust_kmh;
  const wind = activeCyclone?.max_sustained_wind_kmh;
  const pressure = activeCyclone?.central_pressure_hpa;
  const movement = activeCyclone?.movement_speed_kmh;
  const bearing = activeCyclone?.movement_bearing;

  // Show loading state until live data is ready
  const hasData = !!cycloneName;

  return (
    <div className="bg-gradient-to-r from-red-950 via-red-900 to-amber-950 border-b border-red-500/30 text-white text-xs py-2 px-4 flex items-center justify-between overflow-hidden shadow-lg z-50">
      <div className="flex items-center gap-2 flex-shrink-0 font-bold tracking-wider uppercase bg-slate-700 px-2.5 py-0.5 rounded text-[11px] shadow-sm">
        <AlertTriangle className="w-3.5 h-3.5" /> Track Status
      </div>

      <div className="overflow-hidden relative flex-1 mx-4">
        {hasData ? (
          <div className="animate-marquee whitespace-nowrap font-medium text-red-100 flex items-center gap-6">
            <span>🌀 {cycloneName} — {cycloneCategory}</span>
            <span>•</span>
            <span>Estimated Landfall: {landfall}</span>
            <span>•</span>
            <span>Max Sustained Wind: {wind} km/h | Peak Gusts: {gusts} km/h</span>
            <span>•</span>
            <span>Central Pressure: {pressure} hPa | Moving {bearing} at {movement} km/h</span>
            <span>•</span>
            <span>Source: verified cyclone-track feed</span>
          </div>
        ) : (
          <div className="text-slate-400 text-[11px] italic">
            {isBackendConnected
              ? 'No verified live cyclone-track feed is configured. Weather forecasts are available by location.'
              : 'Connecting to weather assessment backend...'}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 text-slate-300 text-[11px] flex-shrink-0">
        <span className="hidden sm:inline-flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-400" />
          <span className="font-mono">{timeString}</span>
        </span>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/80 border ${
          isBackendConnected ? 'border-emerald-500/50 text-emerald-400' : 'border-amber-500/50 text-amber-400'
        } font-mono text-[10px]`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isBackendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'}`}></span>
          {isBackendConnected ? 'BACKEND ONLINE' : 'BACKEND OFFLINE'}
        </span>
      </div>
    </div>
  );
}
