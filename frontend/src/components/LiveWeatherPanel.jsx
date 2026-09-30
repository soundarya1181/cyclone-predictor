import React from 'react';
import { Thermometer, Droplets, Wind, Activity, Eye, Waves, BarChart, Globe } from 'lucide-react';

export default function LiveWeatherPanel({ weatherData, locationName }) {
  if (!weatherData) return null;

  const current = weatherData.current || {};
  const liveWeather = weatherData.live_weather || {};
  const forecast48 = weatherData.forecast_48h || {};
  const daily7day = weatherData.daily_7day || {};

  // Use liveWeather if assessment, else current if direct weather endpoint
  const temp = liveWeather.temperature_c ?? current.temperature_c ?? null;
  const humidity = liveWeather.humidity_pct ?? current.humidity_pct ?? null;
  const windSpeed = liveWeather.wind_speed_kmh ?? current.wind_speed_kmh ?? null;
  const windGust = liveWeather.wind_gust_kmh ?? current.wind_gust_kmh ?? null;
  const precipitation = liveWeather.precipitation_mm ?? current.precipitation_mm ?? null;
  const pressure = liveWeather.surface_pressure_hpa ?? current.surface_pressure_hpa ?? null;
  const elevation = liveWeather.elevation_m ?? weatherData.elevation_m ?? null;
  const waveHeight = liveWeather.wave_height_m ?? null;
  const maxWind48h = liveWeather.max_wind_48h_kmh ?? null;
  const totalRain48h = liveWeather.total_rain_48h_mm ?? null;
  const dataSource = weatherData.data_source || 'Open-Meteo — open-meteo.com';

  const getWindClass = (spd) => {
    if (spd >= 120) return 'text-red-400';
    if (spd >= 60) return 'text-orange-400';
    if (spd >= 30) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const metrics = [
    { label: 'Temperature', value: temp !== null ? `${temp}°C` : '—', icon: Thermometer, color: 'text-orange-400', sub: 'Current' },
    { label: 'Humidity', value: humidity !== null ? `${humidity}%` : '—', icon: Droplets, color: 'text-blue-400', sub: 'Relative' },
    { label: 'Wind Speed', value: windSpeed !== null ? `${windSpeed} km/h` : '—', icon: Wind, color: getWindClass(windSpeed || 0), sub: 'Surface 10m' },
    { label: 'Wind Gust', value: windGust !== null ? `${windGust} km/h` : '—', icon: Activity, color: getWindClass(windGust || 0), sub: 'Peak Gust' },
    { label: 'Precipitation', value: precipitation !== null ? `${precipitation} mm` : '—', icon: Droplets, color: 'text-cyan-400', sub: '24h Total' },
    { label: 'Pressure', value: pressure !== null ? `${pressure} hPa` : '—', icon: BarChart, color: pressure < 990 ? 'text-red-400' : 'text-slate-300', sub: 'Surface' },
    { label: 'Elevation', value: elevation !== null ? `${elevation} m` : '—', icon: Eye, color: elevation < 10 ? 'text-red-400' : 'text-emerald-400', sub: 'Above Sea Level' },
    { label: 'Wave Height', value: waveHeight !== null ? `${waveHeight} m` : 'Inland', icon: Waves, color: 'text-teal-400', sub: 'Marine / Coastal' },
  ];

  return (
    <div className="bg-ops-850 border border-ops-700/60 rounded-xl p-5 shadow-xl">
      <div className="flex items-center justify-between border-b border-ops-700/40 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Live Weather Data
          </h3>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold text-slate-200">{locationName || 'Selected Location'}</div>
          <a
            href="https://open-meteo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-blue-400 hover:underline"
          >
            Source: open-meteo.com — Free API ↗
          </a>
        </div>
      </div>

      {/* Metric Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="bg-ops-900/80 p-3 rounded-lg border border-ops-700/60 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                <Icon className={`w-3.5 h-3.5 ${m.color}`} />
                {m.label}
              </div>
              <div className={`text-lg font-extrabold font-mono ${m.color}`}>{m.value}</div>
              <div className="text-[10px] text-slate-500">{m.sub}</div>
            </div>
          );
        })}
      </div>

      {/* 48h Summary */}
      {(maxWind48h || totalRain48h) && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-ops-900/80 p-3 rounded-lg border border-ops-700/60">
            <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Max Wind (48h Forecast)</div>
            <div className={`text-xl font-extrabold font-mono ${getWindClass(maxWind48h || 0)}`}>
              {maxWind48h} <span className="text-sm font-semibold">km/h</span>
            </div>
          </div>
          <div className="bg-ops-900/80 p-3 rounded-lg border border-ops-700/60">
            <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Total Rain (48h Forecast)</div>
            <div className="text-xl font-extrabold font-mono text-cyan-400">
              {totalRain48h?.toFixed(1)} <span className="text-sm font-semibold">mm</span>
            </div>
          </div>
        </div>
      )}

      {/* 7-Day Daily Summary Table */}
      {daily7day.dates && daily7day.dates.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">7-Day Forecast Summary</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-slate-300 border-collapse">
              <thead>
                <tr className="border-b border-ops-700 text-[10px] text-slate-400 uppercase tracking-wider">
                  <th className="py-1.5 text-left font-semibold px-2">Date</th>
                  <th className="py-1.5 text-center font-semibold">Max Temp</th>
                  <th className="py-1.5 text-center font-semibold">Max Wind</th>
                  <th className="py-1.5 text-center font-semibold">Rain Sum</th>
                </tr>
              </thead>
              <tbody>
                {daily7day.dates.slice(0, 7).map((date, idx) => (
                  <tr key={date} className="border-b border-ops-800/50 hover:bg-ops-900/40">
                    <td className="py-1.5 px-2 font-mono text-slate-300">{date}</td>
                    <td className="py-1.5 text-center text-orange-400">
                      {daily7day.max_temp_c?.[idx] ?? '—'}°C
                    </td>
                    <td className={`py-1.5 text-center font-mono ${getWindClass(daily7day.max_wind_kmh?.[idx] || 0)}`}>
                      {daily7day.max_wind_kmh?.[idx] ?? '—'} km/h
                    </td>
                    <td className="py-1.5 text-center text-cyan-400">
                      {daily7day.precipitation_sum_mm?.[idx] ?? '—'} mm
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-ops-700/40 text-[10px] text-slate-500">
        {dataSource}
      </div>
    </div>
  );
}
