import React from 'react';
import { AlertOctagon, Zap, Anchor, Truck, ShieldAlert } from 'lucide-react';

export default function ActionRecommendations({ assessment }) {
  if (!assessment) {
    return (
      <div className="bg-ops-850 border border-ops-700/60 rounded-xl p-5 text-sm text-slate-400">
        Response guidance is unavailable until a risk assessment has been run.
      </div>
    );
  }

  const score = assessment?.overall_risk ?? 0;
  // Derive dynamic emergency directives based on real scores
  const getDirectives = () => {
    if (score >= 76) {
      return {
        level: 'CRITICAL DISASTER EMERGENCY',
        badgeColor: 'bg-red-500/20 text-red-400 border-red-500/40',
        evacuation: 'Mandatory Immediate Evacuation of all low-lying coastal zones (<5m elevation) and kutcha/fragile settlements within 30km radius.',
        powerGrid: 'Preemptive power grid shutdown in vulnerable feeder lines to prevent catastrophic electrocution and transformer fires.',
        maritime: 'Total port shutdown. Complete prohibition on maritime navigation, fishing vessels, and coastal ferry services.',
        shelter: 'Activate all Level-1 Multi-Purpose Cyclone Shelters with 72-hour emergency food, drinking water, and backup diesel generators.'
      };
    } else if (score >= 51) {
      return {
        level: 'HIGH ALERT & ACTIVE MOBILIZATION',
        badgeColor: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
        evacuation: 'Targeted evacuation of elderly, pregnant women, and high-vulnerability populations to designated fortified cyclone shelters.',
        powerGrid: 'Deploy rapid restoration teams on standby; secure communication towers and emergency satellite nodes.',
        maritime: 'Signal Cautionary Alert Level 4 at major ports; all small crafts instructed to remain anchored in safe berths.',
        shelter: 'Stock disaster relief kits, medical supply packets, and water purification tablets at block-level depots.'
      };
    } else if (score >= 26) {
      return {
        level: 'MODERATE PRECAUTIONARY READINESS',
        badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
        evacuation: 'Advise residents to secure loose tin roofs, hoardings, and stay indoors during peak gale periods.',
        powerGrid: 'Tree trimming along high-tension electrical corridors; test hospital emergency generator backups.',
        maritime: 'Advise fishermen not to venture into deep sea regions; keep VHF radio channels open.',
        shelter: 'Inspect cyclone shelter readiness and drainage outlets to prevent localized water stagnation.'
      };
    } else {
      return {
        level: 'ROUTINE VIGILANCE & MONITORING',
        badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
        evacuation: 'No immediate evacuation required. Standard disaster advisory broadcast active.',
        powerGrid: 'Standard operations; normal municipal maintenance procedures.',
        maritime: 'Normal maritime operations with routine weather monitoring updates.',
        shelter: 'Standby shelter protocol.'
      };
    }
  };

  const directives = getDirectives();

  const recommendations = [
    {
      title: 'Evacuation & Public Safety',
      icon: ShieldAlert,
      text: directives.evacuation,
      color: 'text-red-400',
    },
    {
      title: 'Power Grid & Utilities',
      icon: Zap,
      text: directives.powerGrid,
      color: 'text-amber-400',
    },
    {
      title: 'Maritime & Port Operations',
      icon: Anchor,
      text: directives.maritime,
      color: 'text-cyan-400',
    },
    {
      title: 'Relief Logistics & Shelters',
      icon: Truck,
      text: directives.shelter,
      color: 'text-purple-400',
    },
  ];

  return (
    <div className="bg-ops-850 border border-ops-700/60 rounded-xl p-5 shadow-xl">
      <div className="flex items-center justify-between border-b border-ops-700/40 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-5 h-5 text-red-500" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Modeled Response Guidance
          </h3>
        </div>
        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${directives.badgeColor}`}>
          {directives.level}
        </span>
      </div>

      <p className="text-[10px] text-amber-300/80 mb-3">
        Automated planning guidance based on a forecast risk estimate. Not an official warning or evacuation order.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {recommendations.map((rec) => {
          const Icon = rec.icon;
          return (
            <div key={rec.title} className="bg-ops-900/90 p-3.5 rounded-lg border border-ops-750 flex items-start gap-3">
              <div className={`p-2 rounded-lg bg-ops-800 ${rec.color} flex-shrink-0 mt-0.5`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-slate-200 mb-1">{rec.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{rec.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
