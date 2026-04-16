from flask import Blueprint, request, jsonify
from datetime import datetime, timezone, timedelta
from extensions import mongo
from config import MOISTURE_LOW_THRESHOLD, TEMP_HIGH_THRESHOLD
from bson import ObjectId

sensor_bp = Blueprint("sensors", __name__)

def validate_token(farm_id, token):
    farm = mongo.db.farms.find_one({"farm_id": farm_id})
    if not farm:
        return False
    return farm.get("device_token") == token

# POST /api/sensors/data  — called by ESP32
@sensor_bp.route("/data", methods=["POST"])
def receive():
    d = request.get_json(force=True)
    for f in ["farm_id", "soil_moisture", "temperature", "device_token"]:
        if f not in d:
            return jsonify({"error": f"Missing: {f}"}), 400

    if not validate_token(d["farm_id"], d["device_token"]):
        return jsonify({"error": "Invalid device token"}), 401

    rec = {
        "farm_id":        d["farm_id"],
        "soil_moisture":  float(d["soil_moisture"]),
        "temperature":    float(d["temperature"]),
        "humidity":       float(d.get("humidity", 0)),
        "soil_ph":        float(d.get("soil_ph", 7.0)),
        "ec":             float(d.get("ec", 0)),
        "soc_estimated":  float(d.get("soc_estimated", 1.5)),
        "device_id":      d.get("device_id", "unknown"),
        "timestamp":      datetime.now(timezone.utc),
    }
    mongo.db.sensor_readings.insert_one(rec)
# Auto-resolve alerts if sensor values have recovered
    if rec["soil_moisture"] >= MOISTURE_LOW_THRESHOLD:
        mongo.db.alerts.update_many(
            {"farm_id": d["farm_id"], "type": "low_moisture", "resolved": False},
            {"$set": {
                "resolved": True,
                "resolved_at": datetime.now(timezone.utc),
                "auto_resolved": True,
                "resolved_reason": f"Moisture recovered to {rec['soil_moisture']}%"
            }}
        )

    if rec["temperature"] <= TEMP_HIGH_THRESHOLD:
        mongo.db.alerts.update_many(
            {"farm_id": d["farm_id"], "type": "high_temperature", "resolved": False},
            {"$set": {
                "resolved": True,
                "resolved_at": datetime.now(timezone.utc),
                "auto_resolved": True,
                "resolved_reason": f"Temperature recovered to {rec['temperature']}°C"
            }}
        )

    mongo.db.farms.update_one(
        {"farm_id": d["farm_id"]},
        {"$set": {"latest_sensor": {
            "soil_moisture":  rec["soil_moisture"],
            "temperature":    rec["temperature"],
            "humidity":       rec["humidity"],
            "soil_ph":        rec["soil_ph"],
            "ec":             rec["ec"],
            "soc_estimated":  rec["soc_estimated"],
            "timestamp":      rec["timestamp"],
        }}}
    )

    alerts = []
    if rec["soil_moisture"] < MOISTURE_LOW_THRESHOLD:
        existing = mongo.db.alerts.find_one({
            "farm_id": d["farm_id"],
            "type": "low_moisture",
            "resolved": False
        })
        if not existing:
            mongo.db.alerts.insert_one({
                "farm_id":   d["farm_id"],
                "type":      "low_moisture",
            "severity":  "warning",
            "message":   f"Soil moisture {rec['soil_moisture']}% below {MOISTURE_LOW_THRESHOLD}% threshold",
            "timestamp": datetime.now(timezone.utc),
            "resolved":  False,
        })
        alerts.append("low_moisture")

    if rec["temperature"] > TEMP_HIGH_THRESHOLD:
        existing = mongo.db.alerts.find_one({
            "farm_id": d["farm_id"],
            "type": "high_temperature",
            "resolved": False
        })
        if not existing:
            mongo.db.alerts.insert_one({
                "farm_id":   d["farm_id"],
                "type":      "high_temperature",
            "severity":  "warning",
            "message":   f"Temperature {rec['temperature']}°C above {TEMP_HIGH_THRESHOLD}°C threshold",
            "timestamp": datetime.now(timezone.utc),
            "resolved":  False,
        })
        alerts.append("high_temperature")

    return jsonify({"status": "ok", "alerts": alerts}), 201


# GET /api/sensors/latest
@sensor_bp.route("/latest", methods=["GET"])
def latest():
    pipeline = [
        {"$sort": {"timestamp": -1}},
        {"$group": {
            "_id":           "$farm_id",
            "soil_moisture": {"$first": "$soil_moisture"},
            "temperature":   {"$first": "$temperature"},
            "humidity":      {"$first": "$humidity"},
            "soil_ph":       {"$first": "$soil_ph"},
            "ec":            {"$first": "$ec"},
            "soc_estimated": {"$first": "$soc_estimated"},
            "device_id":     {"$first": "$device_id"},
            "timestamp":     {"$first": "$timestamp"},
        }},
    ]
    rows = list(mongo.db.sensor_readings.aggregate(pipeline))
    for r in rows:
        r["farm_id"]   = r.pop("_id")
        r["timestamp"] = r["timestamp"].isoformat() if r.get("timestamp") else None
    return jsonify(rows)


# GET /api/sensors/history/<farm_id>
@sensor_bp.route("/history/<farm_id>", methods=["GET"])
def history(farm_id):
    limit = int(request.args.get("limit", 100))
    docs  = list(mongo.db.sensor_readings
                 .find({"farm_id": farm_id}, {"_id": 0})
                 .sort("timestamp", -1).limit(limit))
    for d in docs:
        d["timestamp"] = d["timestamp"].isoformat() if d.get("timestamp") else None
    return jsonify(docs)


# GET /api/sensors/live/<farm_id>  — latest single reading
@sensor_bp.route("/live/<farm_id>", methods=["GET"])
def live(farm_id):
    doc = mongo.db.sensor_readings.find_one(
        {"farm_id": farm_id}, {"_id": 0},
        sort=[("timestamp", -1)]
    )
    if not doc:
        return jsonify({"error": "No data"}), 404
    doc["timestamp"] = doc["timestamp"].isoformat()
    return jsonify(doc)


# GET /api/sensors/alerts
@sensor_bp.route("/alerts", methods=["GET"])
def get_alerts():
    farm_id = request.args.get("farm_id")
    query   = {"resolved": False}
    if farm_id:
        query["farm_id"] = farm_id
    docs = list(mongo.db.alerts.find(query).sort("timestamp", -1).limit(50))
    for d in docs:
        d["_id"]       = str(d["_id"])
        d["timestamp"] = d["timestamp"].isoformat() if d.get("timestamp") else None
    return jsonify(docs)


# PATCH /api/sensors/alerts/<id>/resolve
@sensor_bp.route("/alerts/<aid>/resolve", methods=["PATCH"])
def resolve(aid):
    mongo.db.alerts.update_one(
        {"_id": ObjectId(aid)},
        {"$set": {"resolved": True, "resolved_at": datetime.now(timezone.utc)}}
    )
    return jsonify({"status": "resolved"})


# GET /api/sensors/check-active/<farm_id>
@sensor_bp.route("/check-active/<farm_id>", methods=["GET"])
def check_active(farm_id):
    from config import SENSOR_INACTIVE_DAYS
    cutoff = datetime.now(timezone.utc) - timedelta(days=SENSOR_INACTIVE_DAYS)
    doc    = mongo.db.sensor_readings.find_one({
        "farm_id":   farm_id,
        "timestamp": {"$gte": cutoff}
    })
    return jsonify({"active": doc is not None})
