/**
 * Interactive Leaflet Map Component for Cyclone Compound Local Impact
 */

export class CycloneMap {
  constructor(containerId, { onLocationSelect }) {
    this.containerId = containerId;
    this.onLocationSelect = onLocationSelect;
    this.map = null;
    this.markersLayer = null;
    this.trackLayer = null;
    this.coneLayer = null;
    this.radiiLayer = null;
    this.selectedMarkerHalo = null;
    this.currentSelectedId = null;
    this.init();
  }

  init() {
    if (typeof L === 'undefined') {
      console.warn("Leaflet library not loaded yet.");
      return;
    }

    // Initialize Map with dark command theme
    this.map = L.map(this.containerId, {
      center: [20.65, 87.10],
      zoom: 7,
      minZoom: 5,
      maxZoom: 13,
      zoomControl: false
    });

    // Custom Top-Right Zoom Control
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // CartoDB Dark Matter Basemap (high contrast for disaster visualization)
    const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    });

    // OpenStreetMap Standard fallback
    const osmStandard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    });

    cartoDark.addTo(this.map);

    // Layer groups
    this.trackLayer = L.layerGroup().addTo(this.map);
    this.coneLayer = L.layerGroup().addTo(this.map);
    this.radiiLayer = L.layerGroup().addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);

    // Base Layer Control
    L.control.layers({
      "Dark Ops Map": cartoDark,
      "Standard Map": osmStandard
    }, {
      "Cyclone Eye & Radii": this.radiiLayer,
      "Forecast Track & Cone": this.coneLayer,
      "Impact Stations": this.markersLayer
    }, { position: 'bottomright', collapsed: true }).addTo(this.map);
  }

  renderCyclone(cyclone) {
    if (!this.map || !cyclone?.currentEyePosition) return;
    this.radiiLayer.clearLayers();
    this.coneLayer.clearLayers();

    const eye = cyclone.currentEyePosition;

    // 1. Wind Radii Danger Buffer Circles
    // 64 knot (118 km/h) Core Hurricane Wind Zone (radius ~ 65km)
    L.circle([eye.lat, eye.lng], {
      radius: 65000,
      color: '#EF4444',
      fillColor: '#EF4444',
      fillOpacity: 0.22,
      weight: 2,
      dashArray: '4, 4'
    }).bindTooltip("<b>Core Wind Field (≥118 km/h)</b><br>Destructive surge & structural damage zone", { sticky: true }).addTo(this.radiiLayer);

    // 50 knot (92 km/h) Destructive Gale Zone (radius ~ 125km)
    L.circle([eye.lat, eye.lng], {
      radius: 125000,
      color: '#F59E0B',
      fillColor: '#F59E0B',
      fillOpacity: 0.12,
      weight: 1.5,
      dashArray: '6, 6'
    }).bindTooltip("<b>50kt Gale Ring (≥92 km/h)</b><br>Extensive tree falls and power outage perimeter", { sticky: true }).addTo(this.radiiLayer);

    // 34 knot (63 km/h) Gale Perimeter (radius ~ 220km)
    L.circle([eye.lat, eye.lng], {
      radius: 220000,
      color: '#06B6D4',
      fillColor: '#06B6D4',
      fillOpacity: 0.05,
      weight: 1
    }).bindTooltip("<b>Peripheral Gale Boundary (≥63 km/h)</b>", { sticky: true }).addTo(this.radiiLayer);

    // 2. Animated Cyclone Eye Marker
    const eyeIcon = L.divIcon({
      className: 'cyclone-eye-div-icon',
      html: `
        <div class="relative flex items-center justify-center w-12 h-12">
          <div class="absolute w-12 h-12 rounded-full bg-red-500/30 animate-ping"></div>
          <div class="absolute w-8 h-8 rounded-full bg-red-600/60 animate-pulse"></div>
          <div class="relative w-6 h-6 rounded-full bg-red-500 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold">
            <i class="fa-solid fa-hurricane animate-spin" style="animation-duration: 3s;"></i>
          </div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });

    L.marker([eye.lat, eye.lng], { icon: eyeIcon })
      .bindPopup(`
        <div class="p-2 text-slate-900">
          <div class="flex items-center gap-1.5 font-bold text-red-600 uppercase text-xs tracking-wider">
            <i class="fa-solid fa-hurricane"></i> ${cyclone.name}
          </div>
          <div class="text-sm font-semibold text-slate-800 mt-1">${cyclone.category}</div>
          <div class="text-xs text-slate-600 mt-1">
            <strong>Max Wind:</strong> ${cyclone.maxSustainedWindKmh} km/h (Gusts: ${cyclone.maxGustKmh} km/h)<br>
            <strong>Pressure:</strong> ${cyclone.centralPressureHpa} hPa<br>
            <strong>Movement:</strong> ${cyclone.movementBearing} @ ${cyclone.movementSpeedKmh} km/h<br>
            <strong>Est. Landfall:</strong> ${cyclone.estimatedLandfallTime}
          </div>
        </div>
      `)
      .addTo(this.radiiLayer);

    // 3. Forecast Track & Cone of Uncertainty
    const trackPoints = [
      [18.5, 87.8], // 12h ago
      [19.1, 87.5], // 6h ago
      [eye.lat, eye.lng], // Present
      [20.75, 86.95], // Landfall (~6h)
      [21.65, 86.70], // Post-landfall (~18h)
      [22.80, 86.40]  // Dissipating (~30h)
    ];

    // Past & Present Track Line
    L.polyline(trackPoints.slice(0, 3), {
      color: '#EF4444',
      weight: 3.5,
      opacity: 0.9
    }).addTo(this.coneLayer);

    // Forecast Track Line (Dashed)
    L.polyline(trackPoints.slice(2), {
      color: '#F59E0B',
      weight: 3,
      dashArray: '8, 6',
      opacity: 0.85
    }).addTo(this.coneLayer);

    // Cone of uncertainty polygon
    const conePolygon = [
      [eye.lat, eye.lng],
      [20.9, 86.3],
      [22.0, 85.9],
      [23.1, 85.6],
      [23.2, 87.3],
      [22.1, 87.6],
      [20.8, 87.5],
      [eye.lat, eye.lng]
    ];

    L.polygon(conePolygon, {
      color: '#F59E0B',
      weight: 1,
      fillColor: '#F59E0B',
      fillOpacity: 0.12,
      dashArray: '4, 4'
    }).bindTooltip("<b>70% Probability Cone of Uncertainty</b>", { sticky: true }).addTo(this.coneLayer);
  }

  renderLocations(locations, activeLocationId) {
    if (!this.map) return;
    this.markersLayer.clearLayers();

    locations.forEach(loc => {
      const isSelected = loc.id === activeLocationId;
      const riskAvailable = loc.compoundRiskScore != null;
      const colorMap = {
        "Very High": { bg: "#EF4444", border: "#FEE2E2", ring: "rgba(239, 68, 68, 0.4)" },
        "High": { bg: "#F59E0B", border: "#FEF3C7", ring: "rgba(245, 158, 11, 0.4)" },
        "Moderate": { bg: "#EAB308", border: "#FEF9C3", ring: "rgba(234, 179, 8, 0.4)" },
        "Low": { bg: "#10B981", border: "#D1FAE5", ring: "rgba(16, 185, 129, 0.4)" },
        "Pending": { bg: "#64748B", border: "#CBD5E1", ring: "rgba(100, 116, 139, 0.4)" }
      };

      const c = riskAvailable
        ? colorMap[loc.compoundRiskLevel] || colorMap["Moderate"]
        : colorMap.Pending;
      const riskLabel = riskAvailable
        ? `${loc.compoundRiskLevel}${loc.scenarioPrediction ? ' scenario estimate' : ''} (${loc.compoundRiskScore}%)`
        : 'Risk awaiting scenario analysis';
      const display = (value, suffix = '') => value == null ? 'Unavailable' : `${value}${suffix}`;
      const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[character]);

      const iconHtml = `
        <div class="relative group cursor-pointer transition-transform duration-200 transform ${isSelected ? 'scale-125 z-50' : 'hover:scale-110'}">
          ${isSelected ? `<div class="absolute -inset-2 rounded-full animate-ping opacity-75" style="background: ${c.bg};"></div>` : ''}
          <div class="relative w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-xl border-2" 
               style="background-color: ${c.bg}; border-color: ${c.border}; box-shadow: 0 0 14px ${c.ring};">
            ${riskAvailable ? loc.compoundRiskScore : '--'}
          </div>
          <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/90 text-slate-100 text-[10px] px-1.5 py-0.5 rounded shadow border border-slate-700 pointer-events-none">
            ${escapeHtml(loc.name.split(" ")[0])}
          </div>
        </div>
      `;

      const markerIcon = L.divIcon({
        className: 'location-risk-marker',
        html: iconHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([loc.lat, loc.lng], { icon: markerIcon });

      const popupContent = `
        <div class="p-2.5 text-slate-900 max-w-[240px]">
          <div class="flex items-center justify-between pb-1 border-b border-slate-200">
            <span class="font-bold text-xs text-slate-900">${escapeHtml(loc.name)}</span>
            <span class="px-1.5 py-0.5 text-[10px] font-bold rounded" style="background: ${c.bg}; color: white;">
              ${riskLabel}
            </span>
          </div>
          <div class="text-[11px] text-slate-600 mt-2 space-y-1">
            <div class="flex justify-between"><span>Dist to Eye:</span> <strong class="text-slate-800">${display(loc.distanceFromEyeKm, ' km')}</strong></div>
            <div class="flex justify-between"><span>Elevation:</span> <strong class="text-slate-800">${display(loc.elevationMeters, 'm')}</strong></div>
            <div class="flex justify-between"><span>Wind Speed:</span> <strong class="text-slate-800">${display(loc.windSpeedKmh, ' km/h')}</strong></div>
            <div class="flex justify-between"><span>24h Rainfall:</span> <strong class="text-slate-800">${display(loc.rainfallMm24h, ' mm')}</strong></div>
            <div class="flex justify-between"><span>Storm Surge:</span> <strong class="text-red-600">${display(loc.stormSurgeMeters, ' m')}</strong></div>
          </div>
          <button id="map-btn-${loc.id}" class="mt-2.5 w-full py-1 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-medium transition flex items-center justify-center gap-1">
            <i class="fa-solid fa-crosshairs"></i> Focus Station
          </button>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`map-btn-${loc.id}`);
        if (btn) {
          btn.addEventListener('click', () => {
            if (this.onLocationSelect) this.onLocationSelect(loc.id);
            marker.closePopup();
          });
        }
      });

      marker.on('click', () => {
        if (this.onLocationSelect) {
          this.onLocationSelect(loc.id);
        }
      });

      marker.addTo(this.markersLayer);
    });
  }

  focusLocation(loc) {
    if (!this.map || !loc) return;
    this.map.flyTo([loc.lat, loc.lng], 9, {
      animate: true,
      duration: 1.2
    });
  }
}
