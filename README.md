# AI-Based Cyclone Compound Local Impact Prediction System (Frontend Dashboard)

A disaster operations dashboard for assessing modeled local weather risk. Coordinate assessments use Open-Meteo forecasts and available marine forecasts with elevation-based estimates. These are screening estimates, not observed flood depth, official cyclone tracks, warnings, or evacuation orders. Manual simulations use user-supplied values.

---

## 🌪️ Problem & Compound Risk Solution

Standard meteorological advisories provide isolated weather metrics (e.g., wind speed in km/h or forecast precipitation), but disaster response teams need to understand the **combined compounding impact** on local communities. 

This system computes:
- **Wind Risk** (structural damage, flying debris, gust indices)
- **Rainfall Risk** (precipitation volume, flash runoff threshold)
- **Flood & Surge Risk Estimate** (forecast rainfall, elevation, and available marine forecast inputs; not observed inundation)
- **Elevation-Based Vulnerability Proxy** (population, shelter capacity, and infrastructure exposure are not currently sourced)
- **Overall Compound Risk Score & Level** (Low, Moderate, High, Very High) with dynamic AI diagnostic rationales.

---

## 📁 Project Structure

```
cyclone-impact-predictor/
├── index.html               # Main dashboard HTML5 markup with Tailwind dark ops theme
├── css/
│   └── styles.css           # Glassmorphism cards, pulse rings, animations, print stylesheet
├── js/
│   ├── locationData.js      # Curated location coordinates; not weather observations
│   ├── riskEngine.js        # Multi-criteria compound calculation & AI explanation generator
│   ├── mapComponent.js      # Leaflet geospatial map (track, cone of uncertainty, wind radii, risk markers)
│   ├── chartsComponent.js   # Chart.js visualizations (factor attribution & 48h temporal progression)
│   └── app.js               # Central application controller connecting all widgets & state
└── README.md                # System documentation and execution guide
```

---

## 🚀 How to Run the Frontend & backend

The application is built using standard ES Modules, Tailwind CSS, Leaflet, and Chart.js. It requires zero compilation or node package build steps.

###server only: Using Python HTTP Server only (Recommended)
Open PowerShell or your terminal in this directory:
```powershell
python -m http.server 5000
```

###Run All backend and frontend by concurrently: (Recommended)
Open PowerShell or your terminal in this directory:
```powershell
npm run dev
```
Then open your browser to:
[http://localhost:5173](http://localhost:5173)

### Option 2: Using VS Code / Cursor "Live Server" Extension
1. Open the folder `C:\Users\sound\.gemini\antigravity\scratch\cyclone-impact-predictor` in your IDE.
2. Right click on `index.html` and choose **"Open with Live Server"**.

### Option 3: Direct Browser File Opening
Double-click `index.html` or open `index.html` directly in Google Chrome, Microsoft Edge, Firefox, or Brave. (For standard local ES module loading, running a lightweight server like Option 1 or 2 is optimal).

---

## 🎯 Features Implemented

1. **System Status**: Live clock and backend state; no cyclone-track or official warning feed is configured.
2. **Cyclone Track Status**: Shows when verified live track data is unavailable.
3. **Compound Risk Hero & AI Synthesis**:
   - Animated circular percentage gauge (0-100%).
   - Dynamic risk category badge (`VERY HIGH`, `HIGH`, `MODERATE`, `LOW`).
   - Forecast-derived screening estimate with explicit source and limitation labels.
   - Model rationale for the selected zone.
4. **4 Disaggregated Hazard Risk Cards**: Forecast wind and rain, modeled flood risk, and elevation-based vulnerability.
5. **Interactive Geospatial Impact Map**:
   - Leaflet dark ops map with CartoDB basemap.
   - No cyclone eye, track, or wind radii unless a verified track source is configured.
   - Location markers and forecast-derived nearby grid samples.
6. **Location-Wise Compound Risk Matrix**:
   - Full search bar and category dropdown filter (`Very High`, `High`, `Moderate`, `Low`).
   - Real-time station inspection.
7. **What-If Scenario Simulation Studio**:
   - Interactive range sliders for wind speed, rainfall, storm surge height, and elevation.
   - Live recalculation of compound risk score and AI rationale in real time.
8. **Response Guidance**: Modeled planning guidance; official warning feeds and local shelter inventories are not connected.
9. **Export Briefing**:
   - Instant JSON data export for operational logging or downstream reporting.

---

## Deploy to Netlify

Netlify builds a minified static site into `dist/` using `build.py`. The JavaScript modules remain separate so their existing imports work. Tailwind, Leaflet, Chart.js, and Font Awesome continue to load from their configured CDNs.

1. Import this repository into Netlify. The included `netlify.toml` installs the Python build dependencies, runs the build, and publishes `dist/`.
2. The Flask API is not part of the static Netlify deployment. Deploy `backend/` to a Python host and set the Netlify environment variable `CYCLONE_API_URL` to that service's base URL (for example, `https://your-api.example.com`). Configure the API host's CORS policy to allow your Netlify site.
3. Trigger a new deploy after setting `CYCLONE_API_URL`. Without it, the dashboard loads, but prediction requests will target the Netlify site and cannot reach Flask.

To build locally, install the build dependencies and run:

```powershell
python -m pip install -r build-requirements.txt
python build.py
```

For local development, run `python backend/app.py` and `python -m http.server 8080` in separate terminals from the project root. The frontend uses `http://localhost:5000` for API requests while running locally.

## Deploy Frontend and Backend Together to Vercel

The root `app.py` exposes the Flask application, which also serves the original dashboard and static assets. Import the repository into Vercel using the repository root as the project root. The dashboard and API endpoints are then available on the same domain; no `CYCLONE_API_URL` setting is needed.
