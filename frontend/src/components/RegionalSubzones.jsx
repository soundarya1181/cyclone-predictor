import React from 'react';
import { Compass, Wind, Droplets, Mountain } from 'lucide-react';

export default function RegionalSubzones({ subzones, selectedLocation }) {
  if (!subzones || subzones.length === 0) return null;

  const getRiskColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'very high':
        return 'text-red-400 bg-red-950/40 border-red-500/30';
      case 'high':
        return 'text-orange-400 bg-orange-950/40 border-orange-500/30';
      case 'moderate':
        return 'text-amber-400 bg-amber-950/40 border-amber-500/30';
      default:
        return 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30';
    }
  };

  return (
    <div className="bg-ops-850 border border-ops-700/60 rounded-xl p-5 shadow-xl">
      <div className="flex items-center justify-between border-b border-ops-700/40 pb-2 mb-4">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Nearby Regional Subzones Analysis
          </h3>
        </div>
        <span className="text-[11px] text-slate-400">
          Centered on: <strong className="text-slate-200">{selectedLocation?.name || 'Target Site'}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {subzones.map((zone, idx) => (
          <div key={idx} className="bg-ops-900/80 p-3.5 rounded-lg border border-ops-700/60 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-slate-200">{zone.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getRiskColor(zone.risk_level)}`}>
                  {zone.risk_level}
                </span>
              </div>
              
              <div className="text-[11px] text-slate-400 font-mono mb-2">
                {zone.distance_km} km away • {zone.elevation_m}m elev
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-300">
                  <span className="flex items-center gap-1"><Wind className="w-3 h-3 text-cyan-400" /> Wind Risk</span>
                  <span className="font-mono">{zone.wind_risk}/100</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="flex items-center gap-1"><Droplets className="w-3 h-3 text-blue-400" /> Flood Risk</span>
                  <span className="font-mono">{zone.flood_risk}/100</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-ops-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">Overall Risk:</span>
              <span className="font-mono font-bold text-white text-sm">{zone.overall_risk}/100</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
