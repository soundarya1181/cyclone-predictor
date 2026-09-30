import React from 'react';
import { Wind, ShieldAlert, Zap, Compass, RefreshCw } from 'lucide-react';

export default function Header({ 
  activeCyclone, 
  scenarios, 
  selectedScenario, 
  onSelectScenario, 
  onReset,
  isPredicting
}) {
  return (
    <header className="bg-ops-950/90 backdrop-blur border-b border-ops-700/50 sticky top-0 z-40 px-4 sm:px-6 lg:px-8 py-3.5 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        {/* Brand & Title */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 via-rose-600 to-amber-600 flex items-center justify-center text-white text-xl shadow-lg shadow-red-500/20 ring-2 ring-red-400/30 flex-shrink-0 animate-spin-slow">
            <Wind className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                Cyclone Compound Local Impact Predictor
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                AI Engine v2.4 (React + Flask)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
              Multi-hazard compound modeling synthesizing cyclone kinematics, storm surge, hydrological runoff & local vulnerability.
            </p>
          </div>
        </div>

        {/* Header Preset Scenarios Selector & Actions */}
        <div className="flex items-center gap-2.5 flex-wrap md:flex-nowrap">
          <div className="flex items-center gap-2 bg-ops-900 border border-ops-700/70 rounded-lg px-3 py-1.5 shadow-inner">
            <Compass className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-xs text-slate-400 hidden lg:inline">Scenario:</span>
            <select
              value={selectedScenario}
              onChange={(e) => onSelectScenario(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-200 outline-none cursor-pointer focus:text-white"
            >
              <option value="custom" className="bg-ops-900 text-slate-200">⚙️ Custom Parameters</option>
              {scenarios.map((sc) => (
                <option key={sc.name} value={sc.name} className="bg-ops-900 text-slate-200">
                  📍 {sc.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onReset}
            title="Reset to default baseline"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ops-800 hover:bg-ops-700 text-slate-300 hover:text-white border border-ops-700 text-xs font-medium transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPredicting ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>

      </div>
    </header>
  );
}
