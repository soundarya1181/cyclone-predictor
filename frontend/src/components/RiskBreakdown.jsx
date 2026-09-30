import React from 'react';
import { Wind, CloudRain, Waves, ShieldCheck, TrendingUp } from 'lucide-react';

export default function RiskBreakdown({ assessment }) {
  if (!assessment) {
    return (
      <div className="bg-ops-850 border border-ops-700/60 rounded-xl p-5 text-sm text-slate-400">
        Hazard scores will appear after a location forecast or manual risk calculation.
      </div>
    );
  }

  const windRisk = assessment?.wind_risk ?? 0;
  const rainRisk = assessment?.rainfall_risk ?? 0;
  const floodRisk = assessment?.flood_risk ?? 0;
  const vulnRisk = assessment?.local_vulnerability ?? 0;
  const breakdown = assessment?.breakdown || {};

  const metrics = [
    {
      name: 'Wind Hazard Force',
      score: windRisk,
      level: breakdown.wind_risk_level || 'Moderate',
      weight: '28% Compound Weight',
      icon: Wind,
      color: 'text-cyan-400',
      barColor: 'bg-cyan-500',
      description: 'Kinematic wind destructiveness based on IMD cyclonic storm wind bands.',
    },
    {
      name: 'Hydrological Rain Threat',
      score: rainRisk,
      level: breakdown.rainfall_risk_level || 'Moderate',
      weight: '22% Compound Weight',
      icon: CloudRain,
      color: 'text-blue-400',
      barColor: 'bg-blue-500',
      description: 'Torrential 24h precipitation rate driving flash floods and water-logging.',
    },
    {
      name: 'Flood & Surge Model Estimate',
      score: floodRisk,
      level: breakdown.flood_risk_level || 'High',
      weight: '32% Compound Weight',
      icon: Waves,
      color: 'text-teal-400',
      barColor: 'bg-teal-500',
      description: 'Modeled from forecast rainfall, elevation, and available marine forecast data; not observed flood depth.',
    },
    {
      name: 'Local Vulnerability Strain',
      score: vulnRisk,
      level: breakdown.local_vulnerability_level || 'High',
      weight: '18% Compound Weight',
      icon: ShieldCheck,
      color: 'text-purple-400',
      barColor: 'bg-purple-500',
      description: breakdown.local_vulnerability_basis || 'Elevation-based vulnerability proxy; population and infrastructure data are unavailable.',
    },
  ];

  const getLevelBadge = (level) => {
    switch (level?.toLowerCase()) {
      case 'very high':
      case 'severe':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'moderate':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default:
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    }
  };

  return (
    <div className="bg-ops-850 border border-ops-700/60 rounded-xl p-5 shadow-xl">
      <div className="flex items-center justify-between border-b border-ops-700/40 pb-2 mb-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          Disaggregated Hazard Decomposition
        </h3>
          <span className="text-[11px] text-slate-400 font-mono">Forecast screening model · not an official warning</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metrics.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.name} className="bg-ops-900/80 p-3.5 rounded-lg border border-ops-700/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-md bg-ops-800 ${item.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{item.name}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">{item.weight}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-base font-extrabold text-white">{item.score}</span>
                    <span className="text-[10px] text-slate-400">/100</span>
                  </div>
                </div>

                <div className="w-full bg-ops-950 rounded-full h-2 overflow-hidden my-2 border border-ops-800">
                  <div
                    className={`h-full ${item.barColor} transition-all duration-700 rounded-full`}
                    style={{ width: `${Math.min(100, Math.max(0, item.score))}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-1 text-[10px]">
                <p className="text-slate-400 leading-tight pr-2">{item.description}</p>
                <span className={`px-2 py-0.5 rounded font-bold border whitespace-nowrap ${getLevelBadge(item.level)}`}>
                  {item.level}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
