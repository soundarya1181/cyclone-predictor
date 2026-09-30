# AI-Based Cyclone Compound Local Impact Prediction System - Backend API

Flask-powered REST API backend for calculating compound multi-hazard local cyclone impact risk scores.

Coordinate assessments use Open-Meteo forecasts and elevation to produce screening estimates. Flood scores are not observed flood depth. If live weather data is unavailable, the API returns HTTP 503 instead of substituting synthetic weather. No authoritative cyclone-track or warning feed is configured.

---

## 📁 Backend Directory Structure

```
backend/
├── app.py                  # Flask application with REST API endpoints & CORS
├── requirements.txt        # Python dependency specifications
├── risk_model.py           # Transparent explainable compound risk calculation engine
├── data/
└── README.md               # Backend documentation & API execution guide
```

---

## ⚙️ Requirements & Installation

1. Open your terminal or PowerShell and navigate to the `backend` directory:
```powershell
cd C:\Users\sound\.gemini\antigravity\scratch\cyclone-impact-predictor\backend
```

2. Install the required Python packages:
```powershell
pip install -r requirements.txt
```

---

## 🚀 Running the Flask Backend

Start the server:
```powershell
python app.py
```

The server will initialize on:
**`http://localhost:5000`** (or `http://127.0.0.1:5000`)

---

## 📡 REST API Endpoints

### 1. Health Check
- **Endpoint**: `GET /api/health`
- **Description**: Verifies that the Flask backend is active and healthy.
- **Example Response (200 OK)**:
```json
{
  "service": "Cyclone Compound Risk Prediction Backend",
  "status": "healthy",
  "timestamp": "2026-09-29T14:58:30.123456+00:00",
  "version": "1.0.0"
}
```

---

### 2. Compound Risk Prediction
- **Endpoint**: `POST /api/predict`
- **Headers**: `Content-Type: application/json`
- **Description**: Evaluates storm kinematics & local vulnerability parameters to compute individual and compound risk scores.

#### Example JSON Request Body:
```json
{
  "wind_speed": 110,
  "rainfall": 180,
  "cyclone_distance": 80,
  "flood_vulnerability": 80,
  "elevation_risk": 70,
  "population_vulnerability": 75
}
```

#### Example JSON Response (200 OK):
```json
{
  "wind_risk": 64,
  "rainfall_risk": 64,
  "flood_risk": 73,
  "local_vulnerability": 74,
  "overall_risk": 68,
  "risk_level": "High",
  "message": "High compound cyclone impact risk detected, primarily driven by critical storm inundation. Precautionary evacuations and coastal defense reinforcement advised.",
  "breakdown": {
    "distance_decay_factor": 0.79,
    "flood_risk_level": "High",
    "local_vulnerability_level": "High",
    "rainfall_risk_level": "High",
    "synergy_multiplier_applied": false,
    "wind_risk_level": "High"
  }
}
```

---

## 🛡️ Risk Levels Scale

| Score Range | Risk Level | Meaning |
| :--- | :--- | :--- |
| **0 – 25** | `Low` | Minimal immediate structural or flooding hazard |
| **26 – 50** | `Moderate` | Localized wind & rainfall effects; monitoring advised |
| **51 – 75** | `High` | Significant compound danger; precautionary evacuation advised |
| **76 – 100** | `Very High` | Severe compounding surge, destructive winds, extreme threat |

---

## 🧪 Testing with cURL / PowerShell

### PowerShell:
```powershell
# 1. Test Health
Invoke-RestMethod -Uri "http://localhost:5000/api/health" -Method Get

# 2. Test Predict
$body = @{
    wind_speed = 110
    rainfall = 180
    cyclone_distance = 80
    flood_vulnerability = 80
    elevation_risk = 70
    population_vulnerability = 75
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/predict" -Method Post -ContentType "application/json" -Body $body
```

### cURL:
```bash
# 1. Health
curl -X GET http://localhost:5000/api/health

# 2. Predict
curl -X POST http://localhost:5000/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "wind_speed": 110,
    "rainfall": 180,
    "cyclone_distance": 80,
    "flood_vulnerability": 80,
    "elevation_risk": 70,
    "population_vulnerability": 75
  }'
```
