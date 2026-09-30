import React from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
} from 'chart.js';
import { Radar, Bar } from 'react-chartjs-2';
import { BarChart3, PieChart } from 'lucide-react';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

export default function ImpactCharts({ assessment }) {
  if (!assessment) {
    return (
      <div className="bg-ops-850 border border-ops-700/60 rounded-xl p-5 text-sm text-slate-400">
        Select a location for a live forecast assessment or run a manual simulation to see risk charts.
      </div>
    );
  }

  const windRisk = assessment.wind_risk;
  const rainRisk = assessment.rainfall_risk;
  const floodRisk = assessment.flood_risk;
  const vulnRisk = assessment.local_vulnerability;
  const overallRisk = assessment.overall_risk;
  const dataSource = assessment.data_source || assessment.data_sources?.join(' + ') || 'User-supplied simulation';
  const scoreValues = [windRisk, rainRisk, floodRisk, vulnRisk, overallRisk];

  // Radar Chart Data
  const radarData = {
    labels: ['Wind Risk', 'Rainfall Risk', 'Flood Risk Estimate', 'Local Vulnerability', 'Overall Risk'],
    datasets: [
      {
        label: 'Current Impact Footprint',
        data: scoreValues,
        backgroundColor: 'rgba(239, 68, 68, 0.35)',
        borderColor: '#ef4444',
        borderWidth: 2,
        pointBackgroundColor: '#ef4444',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#ef4444'
      },
      {
        label: 'Moderate Hazard Baseline',
        data: [40, 40, 40, 40, 40],
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: '#3b82f6',
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
      }
    ],
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        angleLines: { color: 'rgba(71, 85, 105, 0.4)' },
        grid: { color: 'rgba(71, 85, 105, 0.3)' },
        pointLabels: {
          color: '#cbd5e1',
          font: { size: 10, weight: 'bold' }
        },
        ticks: {
          backdropColor: 'transparent',
          color: '#64748b',
          stepSize: 20,
          font: { size: 9 }
        },
        min: 0,
        max: 100,
      }
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#94a3b8',
          font: { size: 10 },
          boxWidth: 12
        }
      }
    }
  };

  // Compare model scores on a shared 0-100 scale.
  const barData = {
    labels: ['Wind Risk', 'Rainfall Risk', 'Flood Risk Estimate', 'Local Vulnerability', 'Overall Risk'],
    datasets: [
      {
        label: 'Current Value',
        data: [
          ...scoreValues
        ],
        backgroundColor: [
          'rgba(6, 182, 212, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(20, 184, 166, 0.8)',
          overallRisk > 75 ? 'rgba(239, 68, 68, 0.9)' : 'rgba(245, 158, 11, 0.9)'
        ],
        borderRadius: 6,
      }
    ]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { size: 10 } }
      },
      y: {
        grid: { color: 'rgba(71, 85, 105, 0.25)' },
        ticks: { color: '#64748b', font: { size: 9 } },
        min: 0,
        max: 100,
      }
    },
    plugins: {
      legend: { display: false }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Radar Chart */}
      <div className="bg-ops-850 border border-ops-700/60 rounded-xl p-4 shadow-xl flex flex-col h-[280px]">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-ops-700/40">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <PieChart className="w-3.5 h-3.5 text-red-400" />
            Compound Hazard Radar
          </h4>
          <span className="text-[10px] text-slate-400">Risk estimates · 0–100</span>
        </div>
        <div className="flex-1 relative">
          <Radar data={radarData} options={radarOptions} />
        </div>
      </div>

      {/* Bar Chart */}
      <div className="bg-ops-850 border border-ops-700/60 rounded-xl p-4 shadow-xl flex flex-col h-[280px]">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-ops-700/40">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
            Direct Hazard Metric Quantiles
          </h4>
          <span className="text-[10px] text-slate-400">{dataSource}</span>
        </div>
        <div className="flex-1 relative">
          <Bar data={barData} options={barOptions} />
        </div>
      </div>
    </div>
  );
}
