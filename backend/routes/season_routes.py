from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from extensions import mongo

season_bp = Blueprint("seasons", __name__)

CROP_FACTORS = {
    "sugarcane": 1.45, "soybean": 1.20, "wheat": 1.10,
    "cotton": 1.00, "jowar": 0.95, "vegetables": 0.65,
    "grapes": 1.05, "orange": 1.10, "pomegranate": 1.00,
    "other": 0.90,
}

def _ser(doc):
    doc["_id"] = str(doc["_id"])
    for k in ["start_date", "end_date", "created_on"]:
        if doc.get(k): doc[k] = doc[k].isoformat()
    return doc

@season_bp.route("/farm/<farm_id>", methods=["GET"])
def get_seasons(farm_id):
    docs = list(mongo.db.seasons.find({"farm_id": farm_id}).sort("start_date", -1))
    return jsonify([_ser(d) for d in docs])

@season_bp.route("/farm/<farm_id>/active", methods=["GET"])
def get_active(farm_id):
    doc = mongo.db.seasons.find_one({"farm_id": farm_id, "status": "active"})
    return jsonify(_ser(doc)) if doc else jsonify(None)

@season_bp.route("/", methods=["POST"])
def create_season():
    d = request.get_json(force=True)
    for f in ["farm_id", "season_name", "crop_type", "start_date"]:
        if not d.get(f):
            return jsonify({"error": f"Missing: {f}"}), 400

    # Close any existing active season
    mongo.db.seasons.update_many(
        {"farm_id": d["farm_id"], "status": "active"},
        {"$set": {"status": "closed"}}
    )

    crop_factor = CROP_FACTORS.get(d["crop_type"].lower(), 0.90)
    season_id   = f"{d['farm_id']}-{d['season_name'].upper().replace(' ','-')}"

    mongo.db.seasons.insert_one({
        "season_id":   season_id,
        "farm_id":     d["farm_id"],
        "season_name": d["season_name"],
        "crop_type":   d["crop_type"],
        "crop_factor": crop_factor,
        "start_date":  datetime.fromisoformat(d["start_date"]),
        "end_date":    datetime.fromisoformat(d["end_date"]) if d.get("end_date") else None,
        "status":      "active",
        "created_on":  datetime.now(timezone.utc),
    })

    # Update farm current crop
    mongo.db.farms.update_one(
        {"farm_id": d["farm_id"]},
        {"$set": {"crop_type": d["crop_type"], "current_season": season_id}}
    )

    return jsonify({"status": "created", "season_id": season_id}), 201

@season_bp.route("/<season_id>/close", methods=["PATCH"])
def close_season(season_id):
    mongo.db.seasons.update_one(
        {"season_id": season_id},
        {"$set": {"status": "closed", "end_date": datetime.now(timezone.utc)}}
    )
    return jsonify({"status": "closed"})
