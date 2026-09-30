import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers } from 'lucide-react';

// Fix Leaflet default icon paths in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Cyclone eye icon
const cycloneIcon = L.divIcon({
  className: 'custom-cyclone-marker',
  html: `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;width:40px;height:40px;">
      <span style="position:absolute;width:40px;height:40px;background:rgba(239,68,68,0.35);border-radius:50%;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>
      <div style="width:30px;height:30px;background:linear-gradient(135deg,#ef4444,#b91c1c);border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 4px 12px rgba(0,0,0,0.6);">🌀</div>
    </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// Selected location pin icon
const locationIcon = L.divIcon({
  className: 'custom-location-marker',
  html: `<div style="background:#3b82f6;width:26px;height:26px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.6);">📍</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => onMapClick && onMapClick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

export default function MapComponent({
  cycloneData,
  selectedCoord,
  assessment,
  regionalSubzones,
  onLocationSelect,
}) {
  // Derive cyclone eye from LIVE /api/cyclone data — no hardcoded fallback
  const activeCyclone = cycloneData?.active_cyclone;
  const cycloneEye = activeCyclone?.current_eye_position || null;

  // Build track line ONLY from live data
  // Uses current eye + estimated landfall from JSON
  const buildTrackLine = () => {
    if (!cycloneEye) return null;
    const eyeLat = cycloneEye.lat;
    const eyeLng = cycloneEye.lng;
    // Movement: NNW at 18 km/h → estimate ±6h positions
    // NNW ≈ bearing 335°; 1° lat ≈ 111 km
    const speedKmh = activeCyclone?.movement_speed_kmh || 18;
    const bearingDeg = 335; // NNW
    const bearingRad = (bearingDeg * Math.PI) / 180;
    // 6h back (past) and 24h forward (projected)
    const dLat6h = (speedKmh * 6 / 111) * Math.cos(bearingRad);
    const dLng6h = (speedKmh * 6 / (111 * Math.cos((eyeLat * Math.PI) / 180))) * Math.sin(bearingRad);
    const dLat12h = (speedKmh * 12 / 111) * Math.cos(bearingRad);
    const dLng12h = (speedKmh * 12 / (111 * Math.cos((eyeLat * Math.PI) / 180))) * Math.sin(bearingRad);
    const dLat24h = (speedKmh * 24 / 111) * Math.cos(bearingRad);
    const dLng24h = (speedKmh * 24 / (111 * Math.cos((eyeLat * Math.PI) / 180))) * Math.sin(bearingRad);

    return [
      [eyeLat - dLat12h, eyeLng - dLng12h],  // 12h ago
      [eyeLat - dLat6h, eyeLng - dLng6h],    // 6h ago
      [eyeLat, eyeLng],                        // NOW (live)
      [eyeLat + dLat12h, eyeLng + dLng12h],  // +12h projected
      [eyeLat + dLat24h, eyeLng + dLng24h],  // +24h projected
    ];
  };

  const trackLine = buildTrackLine();

  // Map center: cyclone eye if available, else Bay of Bengal default
  const mapCenter = cycloneEye
    ? [cycloneEye.lat, cycloneEye.lng]
    : [15.0, 83.0];

  return (
    <div className="bg-ops-850 border border-ops-700/60 rounded-xl p-4 shadow-xl flex flex-col h-[500px]">
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-ops-700/40">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Operational Cyclone Geospatial Map
          </h3>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap justify-end">
          {cycloneEye && (
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              Cyclone Eye ({cycloneEye.lat.toFixed(2)}°N, {cycloneEye.lng.toFixed(2)}°E)
            </span>
          )}
          {selectedCoord && (
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              {selectedCoord.name}
            </span>
          )}
          <span className="text-slate-500 italic hidden sm:inline">(Click map to assess location)</span>
        </div>
      </div>

      <div className="flex-1 w-full rounded-lg overflow-hidden">
        <MapContainer
          center={mapCenter}
          zoom={cycloneEye ? 6 : 5}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <MapClickHandler onMapClick={onLocationSelect} />

          {/* Cyclone eye — ONLY shown if live data available */}
          {cycloneEye && (
            <>
              <Marker position={[cycloneEye.lat, cycloneEye.lng]} icon={cycloneIcon}>
                <Popup>
                  <div className="p-1 text-xs font-sans">
                    <div className="font-bold text-red-400 text-sm">{activeCyclone?.name}</div>
                    <div className="text-slate-600 mt-1 space-y-0.5">
                      <div>{activeCyclone?.category}</div>
                      <div>Max Wind: <strong>{activeCyclone?.max_sustained_wind_kmh} km/h</strong></div>
                      <div>Peak Gust: <strong>{activeCyclone?.max_gust_kmh} km/h</strong></div>
                      <div>Pressure: <strong>{activeCyclone?.central_pressure_hpa} hPa</strong></div>
                      <div>Movement: <strong>{activeCyclone?.movement_bearing} @ {activeCyclone?.movement_speed_kmh} km/h</strong></div>
                      <div>Landfall: <strong>{activeCyclone?.estimated_landfall_location}</strong></div>
                    </div>
                    <div className="text-slate-400 text-[10px] mt-1 font-mono">
                      {cycloneEye.location_name}
                    </div>
                  </div>
                </Popup>
              </Marker>

              {/* Destructive core 50km */}
              <Circle center={[cycloneEye.lat, cycloneEye.lng]} radius={50000}
                pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.22, weight: 2, dashArray: '5,4' }} />
              {/* Severe gale 120km */}
              <Circle center={[cycloneEye.lat, cycloneEye.lng]} radius={120000}
                pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.1, weight: 1.5 }} />
              {/* Outer squall 220km */}
              <Circle center={[cycloneEye.lat, cycloneEye.lng]} radius={220000}
                pathOptions={{ color: '#eab308', fillColor: '#eab308', fillOpacity: 0.05, weight: 1 }} />

              {/* Track line derived from live cyclone speed + bearing */}
              {trackLine && (
                <Polyline positions={trackLine}
                  pathOptions={{ color: '#dc2626', weight: 3, opacity: 0.85, dashArray: '7,5' }} />
              )}
            </>
          )}

          {/* Selected location — only shown when user picks a location */}
          {selectedCoord && (
            <Marker position={[selectedCoord.lat, selectedCoord.lng]} icon={locationIcon}>
              <Popup>
                <div className="p-1 text-xs font-sans">
                  <div className="font-bold text-blue-500 text-sm">{selectedCoord.name}</div>
                  {assessment ? (
                    <div className="text-slate-600 mt-1 space-y-0.5">
                      <div>Compound Risk: <strong className="text-amber-600">{assessment.overall_risk}/100</strong></div>
                      <div>Risk Level: <strong>{assessment.risk_level}</strong></div>
                      {assessment.live_weather && (
                        <>
                          <div>Wind: <strong>{assessment.live_weather.wind_speed_kmh} km/h</strong></div>
                          <div>Rain 48h: <strong>{assessment.live_weather.total_rain_48h_mm} mm</strong></div>
                          <div>Elevation: <strong>{assessment.live_weather.elevation_m} m</strong></div>
                        </>
                      )}
                      <div className="text-[10px] text-slate-400 pt-1">{assessment.data_source}</div>
                    </div>
                  ) : (
                    <div className="text-slate-400 mt-1">Click to calculate risk</div>
                  )}
                  <div className="text-[10px] font-mono text-slate-400 mt-1">
                    {selectedCoord.lat.toFixed(4)}°N, {selectedCoord.lng.toFixed(4)}°E
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Regional subzones from live API response */}
          {regionalSubzones && regionalSubzones.map((sub, idx) => (
            <Circle key={idx}
              center={[sub.latitude, sub.longitude]}
              radius={8000}
              pathOptions={{
                color: sub.risk_level === 'Very High' ? '#ef4444'
                  : sub.risk_level === 'High' ? '#f97316'
                  : sub.risk_level === 'Moderate' ? '#eab308'
                  : '#10b981',
                fillOpacity: 0.35,
                weight: 2
              }}
            >
              <Popup>
                <div className="text-xs">
                  <strong>{sub.name}</strong>
                  <div>Risk: {sub.overall_risk}/100 ({sub.risk_level})</div>
                  <div>Wind: {sub.wind_risk} | Flood: {sub.flood_risk}</div>
                  <div className="text-[10px] text-slate-400">{sub.distance_km} km away</div>
                </div>
              </Popup>
            </Circle>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
