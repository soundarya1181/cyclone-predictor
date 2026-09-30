import React from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, Flame, Info } from 'lucide-react';

export default function RiskGauge({ assessment, isLoading }) {
  const score = assessment?.overall_risk ?? 0;
  const level = assessment?.risk_level || 'Low';
  const message = assessment?.message || assessment?.risk_message || 'No prediction calculated yet.';
  const breakdown = assessment?.breakdown || {};

  // Gauge colors and descriptions
  const getRiskDetails = (riskLevel) => {
    switch (riskLevel?.toLowerCase()) {
      case 'very high':
      case 'severe':
      case 'critical':
        return {
          textColor: 'text-red-500',
          bgColor: 'bg-red-500/20',
          borderColor: 'border-red-500/40',
          ringColor: '#EF4444',
          label: 'VERY HIGH / CATASTROPHIC',
          desc: 'Immediate life safety threat, destructive compound surges & catastrophic inland flooding expected.'
        };
      case 'high':
        return {
          textColor: 'text-orange-500',
          bgColor: 'bg-orange-500/20',
          borderColor: 'border-orange-500/40',
          ringColor: '#F97316',
          label: 'HIGH RISK',
          desc: 'Significant damage to vulnerable structures, extensive flooding, urgent evacuation protocols.'
        };
      case 'moderate':
        return {
          textColor: 'text-amber-400',
          bgColor: 'bg-amber-500/20',
          borderColor: 'border-amber-500/40',
          ringColor: '#FBBF24',
          label: 'MODERATE RISK',
          desc: 'Localized inundation, high wind gusts, structural readiness advisories required.'
        };
      default:
        return {
          textColor: 'text-emerald-400',
          bgColor: 'bg-emerald-500/20',
          borderColor: 'border-emerald-500/40',
          ringColor: '#10B981',
          label: 'LOW RISK',
          desc: 'Minimal compound hazard, manageable squalls with standard cautionary vigilance.'
        };
    }
  };

  const details = getRiskDetails(level);

  // SVG Gauge calculations
  // Gauge is a semi-circle from 180 to 0 deg
  const radius = 80;
  const circumference = Math.PI * radius; // Half-circle
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-ops-850 border border-ops-700/60 rounded-xl p-5 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between border-b border-ops-700/40 pb-2 mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Compound Local Risk Index
            </h3>
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${details.bgColor} ${details.textColor} ${details.borderColor}`}>
            {details.label}
          </span>
        </div>

        {/* Gauge Center Graphic */}
        <div className="relative flex flex-col items-center justify-center my-2">
          <svg className="w-52 h-28 overflow-visible" viewBox="0 0 200 110">
            {/* Background Arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#1e293b"
              strokeWidth="16"
              strokeLinecap="round"
            />
            {/* Colored Active Arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke={details.ringColor}
              strokeWidth="16"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          {/* Value Display */}
          <div className="absolute top-12 flex flex-col items-center">
            <span className={`text-4xl font-extrabold tracking-tight font-mono ${details.textColor}`}>
              {score}
            </span>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
              / 100 Composite
            </span>
          </div>
        </div>

        {/* AI Explainable Risk Message */}
        <div className={`mt-3 p-3.5 rounded-lg border text-xs ${details.bgColor} ${details.borderColor}`}>
          <div className="flex items-start gap-2">
            <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${details.textColor}`} />
            <p className="text-slate-200 leading-relaxed font-medium">
              {message}
            </p>
          </div>
        </div>
      </div>

      {/* Synergistic Multipliers Tag */}
      <div className="mt-4 pt-3 border-t border-ops-700/40 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <Info className="w-3.5 h-3.5 text-slate-500" />
          Distance Decay: <strong className="text-slate-200">{breakdown.distance_decay_factor ?? '1.0'}</strong>
        </span>
        {breakdown.synergy_multiplier_applied && (
          <span className="flex items-center gap-1 text-red-400 font-bold bg-red-950/80 px-2 py-0.5 rounded border border-red-800/60">
            <Flame className="w-3 h-3 text-red-400" /> Synergy Amplified (+8%)
          </span>
        )}
      </div>
    </div>
  );
}
