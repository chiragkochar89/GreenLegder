from flask import Blueprint, request, jsonify
from model.predictor import predict
from extensions import mongo
from datetime import datetime, timezone

ai_bp = Blueprint("ai", __name__)

CROP_FACTORS = {
    "sugarcane": 1.45, "soybean": 1.20, "wheat": 1.10,
    "cotton": 1.00, "jowar": 0.95, "vegetables": 0.65,
    "grapes": 1.05, "orange": 1.10, "pomegranate": 1.00,
    "other": 0.90,
}

@ai_bp.route("/estimate", methods=["POST"])
def estimate():
    d = request.get_json(force=True)
    for f in ["ndvi", "area_hectares", "soil_organic_carbon"]:
        if f not in d:
            return jsonify({"error": f"Missing: {f}"}), 400
    try:
        result = predict(
            ndvi=float(d["ndvi"]), area_hectares=float(d["area_hectares"]),
            soil_organic_carbon=float(d["soil_organic_carbon"]),
            temperature_avg=float(d.get("temperature_avg", 28.0)),
            soil_moisture_avg=float(d.get("soil_moisture_avg", 55.0)),
            monitoring_months=int(d.get("monitoring_months", 6)),
            practice=d.get("practice", "conventional"),
        )
        crop    = d.get("crop_type", "other").lower()
        factor  = CROP_FACTORS.get(crop, 0.90)
        result["co2_tons"] = round(result["co2_tons"] * factor, 3)
        result["credits"]  = int(result["co2_tons"])
        result["crop_factor"] = factor
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 503
    return jsonify(result)

@ai_bp.route("/estimate/farm/<fid>", methods=["POST"])
def estimate_farm(fid):
    farm = mongo.db.farms.find_one({"farm_id": fid})
    if not farm:
        return jsonify({"error": "Farm not found"}), 404

    months = int((request.get_json(force=True) or {}).get("monitoring_months", 6))
    pipeline = [
        {"$match": {"farm_id": fid}},
        {"$sort": {"timestamp": -1}},
        {"$limit": 50},
        {"$group": {"_id": None,
                    "avg_moisture": {"$avg": "$soil_moisture"},
                    "avg_temp":     {"$avg": "$temperature"},
                    "avg_soc":      {"$avg": "$soc_estimated"}}},
    ]
    agg          = list(mongo.db.sensor_readings.aggregate(pipeline))
    avg_moisture = agg[0]["avg_moisture"] if agg else 55.0
    avg_temp     = agg[0]["avg_temp"]     if agg else 28.0
    avg_soc      = agg[0]["avg_soc"]      if agg else farm.get("soil_organic_carbon", 1.5)

    try:
        result = predict(
            ndvi=farm.get("ndvi", 0.5), area_hectares=farm.get("area_hectares", 1.0),
            soil_organic_carbon=avg_soc, temperature_avg=avg_temp,
            soil_moisture_avg=avg_moisture, monitoring_months=months,
            practice=farm.get("practice", "conventional"),
        )
        crop   = farm.get("crop_type", "other").lower()
        factor = CROP_FACTORS.get(crop, 0.90)
        result["co2_tons"]    = round(result["co2_tons"] * factor, 3)
        result["credits"]     = int(result["co2_tons"])
        result["crop_factor"] = factor
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 503

    result.update({"farm_id": fid, "farmer_name": farm.get("farmer_name"),
                   "months_used": months, "avg_moisture": round(avg_moisture, 1),
                   "avg_temp": round(avg_temp, 1), "avg_soc": round(avg_soc, 2)})

    mongo.db.ai_predictions.insert_one({
        "farm_id": fid, "co2_tons": result["co2_tons"],
        "credits": result["credits"], "confidence": result["confidence"],
        "timestamp": datetime.now(timezone.utc),
    })
    return jsonify(result)
