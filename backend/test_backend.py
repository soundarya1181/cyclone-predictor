"""
Automated unit & integration test suite for Cyclone Impact Prediction Backend.
Tests model calculations, input validation, and Flask API endpoints.
"""

import json
import unittest
from unittest.mock import patch
import app as backend_app_module
from app import app
from risk_model import validate_input_data, calculate_compound_risk, calculate_coordinate_risk, determine_risk_level


class TestRiskModel(unittest.TestCase):

    def test_risk_level_mapping(self):
        self.assertEqual(determine_risk_level(15), "Low")
        self.assertEqual(determine_risk_level(25), "Low")
        self.assertEqual(determine_risk_level(26), "Moderate")
        self.assertEqual(determine_risk_level(50), "Moderate")
        self.assertEqual(determine_risk_level(51), "High")
        self.assertEqual(determine_risk_level(75), "High")
        self.assertEqual(determine_risk_level(76), "Very High")
        self.assertEqual(determine_risk_level(95), "Very High")

    def test_input_validation_valid(self):
        data = {
            "wind_speed": 110,
            "rainfall": 180,
            "cyclone_distance": 80,
            "flood_vulnerability": 80,
            "elevation_risk": 70,
            "population_vulnerability": 75
        }
        is_valid, params, err = validate_input_data(data)
        self.assertTrue(is_valid)
        self.assertIsNone(err)
        self.assertEqual(params["wind_speed"], 110.0)

    def test_input_validation_accepts_far_coastal_location_distance(self):
        data = {
            "wind_speed": 110,
            "rainfall": 180,
            "cyclone_distance": 1201,
            "flood_vulnerability": 80,
            "elevation_risk": 70,
            "population_vulnerability": 75
        }
        is_valid, params, err = validate_input_data(data)
        self.assertTrue(is_valid)
        self.assertIsNone(err)
        self.assertEqual(params["cyclone_distance"], 1201.0)

    def test_input_validation_missing_param(self):
        data = {
            "wind_speed": 110,
            "rainfall": 180
        }
        is_valid, params, err = validate_input_data(data)
        self.assertFalse(is_valid)
        self.assertIn("Missing required parameter", err)

    def test_input_validation_negative_param(self):
        data = {
            "wind_speed": -10,
            "rainfall": 180,
            "cyclone_distance": 80,
            "flood_vulnerability": 80,
            "elevation_risk": 70,
            "population_vulnerability": 75
        }
        is_valid, params, err = validate_input_data(data)
        self.assertFalse(is_valid)
        self.assertIn("cannot be negative", err)

    def test_input_validation_out_of_range_score(self):
        data = {
            "wind_speed": 110,
            "rainfall": 180,
            "cyclone_distance": 80,
            "flood_vulnerability": 101,
            "elevation_risk": 70,
            "population_vulnerability": 75
        }
        is_valid, params, err = validate_input_data(data)
        self.assertFalse(is_valid)
        self.assertIn("cannot exceed 100", err)

    def test_risk_calculation_output(self):
        data = {
            "wind_speed": 110,
            "rainfall": 180,
            "cyclone_distance": 80,
            "flood_vulnerability": 80,
            "elevation_risk": 70,
            "population_vulnerability": 75
        }
        res = calculate_compound_risk(data)
        self.assertIn("wind_risk", res)
        self.assertIn("rainfall_risk", res)
        self.assertIn("flood_risk", res)
        self.assertIn("local_vulnerability", res)
        self.assertIn("overall_risk", res)
        self.assertIn("risk_level", res)
        self.assertIn("message", res)
        self.assertIsInstance(res["overall_risk"], int)
        self.assertIn(res["risk_level"], ["Low", "Moderate", "High", "Very High"])

    def test_coordinate_risk_uses_live_forecast_and_returns_trend(self):
        weather = {
            "latitude": 35.7,
            "longitude": 139.75,
            "elevation": 12,
            "hourly": {
                "time": [f"2026-09-30T{hour:02d}:00" for hour in range(24)],
                "wind_speed_10m": [80] * 24,
                "wind_gusts_10m": [100] * 24,
                "precipitation": [2] * 24
            }
        }
        assessment = calculate_coordinate_risk(weather)
        self.assertEqual(assessment["assessment_type"], "forecast_model_estimate")
        self.assertEqual(assessment["inputs"]["rainfall_24h_mm"], 48)
        self.assertFalse(assessment["inputs"]["marine_data_available"])
        self.assertTrue(assessment["trend"])
        self.assertIn("not an official cyclone warning", assessment["risk_message"])


class TestFlaskEndpoints(unittest.TestCase):

    def setUp(self):
        self.client = app.test_client()

    def test_root_endpoint(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, "text/html")
        self.assertIn(b"js/app.js", response.get_data())
        response.close()

    def test_frontend_assets(self):
        css_response = self.client.get("/css/styles.css")
        js_response = self.client.get("/js/app.js")
        self.assertEqual(css_response.status_code, 200)
        self.assertEqual(js_response.status_code, 200)
        css_response.close()
        js_response.close()

    def test_health_endpoint(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("timestamp", data)

    def test_predict_endpoint_success(self):
        payload = {
            "wind_speed": 110,
            "rainfall": 180,
            "cyclone_distance": 80,
            "flood_vulnerability": 80,
            "elevation_risk": 70,
            "population_vulnerability": 75
        }
        response = self.client.post(
            "/api/predict",
            data=json.dumps(payload),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn("wind_risk", data)
        self.assertIn("rainfall_risk", data)
        self.assertIn("flood_risk", data)
        self.assertIn("local_vulnerability", data)
        self.assertIn("overall_risk", data)
        self.assertIn("risk_level", data)
        self.assertIn("message", data)
        self.assertIn("risk_message", data)
        self.assertEqual(data["risk_message"], data["message"])
        print("\n--- SAMPLE PREDICT RESPONSE ---")
        print(json.dumps(data, indent=2))

    def test_coordinate_assessment_endpoint_success(self):
        weather = {
            "latitude": 35.7,
            "longitude": 139.75,
            "elevation": 12,
            "hourly": {
                "time": [f"2026-09-30T{hour:02d}:00" for hour in range(48)],
                "wind_speed_10m": [80] * 48,
                "wind_gusts_10m": [100] * 48,
                "precipitation": [2] * 48
            }
        }
        regional = [(dict(weather), None) for _ in range(4)]
        payload = {
            "latitude": 35.68,
            "longitude": 139.76,
            "place_name": "Tokyo",
            "country": "Japan",
            "state": "Tokyo"
        }
        with patch.object(backend_app_module, "fetch_realtime_weather", return_value=weather), \
            patch.object(backend_app_module, "fetch_marine_data", return_value=None):
            response = self.client.post("/api/risk-assessment", json=payload)

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result["location"]["name"], "Tokyo")
        self.assertEqual(result["assessment_type"], "forecast_model_estimate")
        self.assertEqual(len(result["regional_subzones"]), 4)
        self.assertTrue(result["trend"])

    def test_coordinate_assessment_does_not_fabricate_data_when_live_feed_fails(self):
        backend_app_module.coordinate_assessment_cache.clear()
        payload = {
            "latitude": 48.21,
            "longitude": 16.37,
            "place_name": "Vienna",
            "country": "Austria",
            "state": "Vienna"
        }
        with patch.object(backend_app_module, "fetch_realtime_weather", side_effect=ValueError("Live data unavailable")):
            response = self.client.post("/api/risk-assessment", json=payload)

        self.assertEqual(response.status_code, 503)
        result = response.get_json()
        self.assertEqual(result["error"], "Live Risk Data Unavailable")
        self.assertIn("No simulated values", result["message"])

    def test_cyclone_endpoint_does_not_publish_sample_as_live(self):
        response = self.client.get("/api/cyclone")

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertIsNone(result["active_cyclone"])
        self.assertEqual(result["sample_scenarios"], [])
        self.assertIn("No authoritative", result["message"])

    def test_coordinate_assessment_rejects_invalid_coordinates(self):
        response = self.client.post("/api/risk-assessment", json={"latitude": 100, "longitude": 0})
        self.assertEqual(response.status_code, 400)

    def test_predict_validation_failure(self):
        # Missing required parameter
        payload = {
            "wind_speed": 110,
            "rainfall": 180
        }
        response = self.client.post(
            "/api/predict",
            data=json.dumps(payload),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertEqual(data["error"], "Validation Error")

    def test_predict_invalid_json(self):
        response = self.client.post(
            "/api/predict",
            data="not json",
            content_type="text/plain"
        )
        self.assertEqual(response.status_code, 400)

    def test_404_handler(self):
        response = self.client.get("/api/unknown-endpoint")
        self.assertEqual(response.status_code, 404)
        data = response.get_json()
        self.assertEqual(data["error"], "Not Found")


if __name__ == "__main__":
    unittest.main()
