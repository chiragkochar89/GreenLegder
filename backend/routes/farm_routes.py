from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from extensions import mongo

farm_bp = Blueprint("farms", __name__)

def _ser(doc):
    doc["_id"] = str(doc["_id"])
    for k in ["registered_on", "ndvi_updated"]:
        if doc.get(k): doc[k] = doc[k].isoformat()
    ls = doc.get("latest_sensor", {})
    if ls and ls.get("timestamp"):
        ls["timestamp"] = ls["timestamp"].isoformat()
    return doc

@farm_bp.route("/", methods=["GET"])
def list_farms():
    return jsonify([_ser(d) for d in mongo.db.farms.find({"active": True})])

@farm_bp.route("/<fid>", methods=["GET"])
def get_farm(fid):
    doc = mongo.db.farms.find_one({"farm_id": fid})
    return jsonify(_ser(doc)) if doc else (jsonify({"error": "Not found"}), 404)

@farm_bp.route("/by-phone/<phone>", methods=["GET"])
def get_by_phone(phone):
    doc = mongo.db.farms.find_one({"phone": phone, "active": True})
    return jsonify(_ser(doc)) if doc else (jsonify({"error": "Not found"}), 404)

@farm_bp.route("/<fid>/bank-details", methods=["PATCH"])
def update_bank_details(fid):
    d = request.get_json(force=True)
    mongo.db.farms.update_one(
        {"farm_id": fid},
        {"$set": {"bank_details": {
            "upi_id":       d.get("upi_id", ""),
            "account_no":   d.get("account_no", ""),
            "ifsc":         d.get("ifsc", ""),
            "bank_name":    d.get("bank_name", ""),
            "account_name": d.get("account_name", ""),
            "updated_on":   datetime.now(timezone.utc).isoformat(),
        }}}
    )
    return jsonify({"status": "updated"})

@farm_bp.route("/<fid>/ndvi", methods=["PATCH"])
def update_ndvi(fid):
    ndvi = float(request.get_json(force=True).get("ndvi", 0))
    mongo.db.farms.update_one(
        {"farm_id": fid},
        {"$set": {"ndvi": ndvi, "ndvi_updated": datetime.now(timezone.utc)}}
    )
    mongo.db.ndvi_history.insert_one({
        "farm_id":   fid,
        "ndvi":      ndvi,
        "source":    "satellite",
        "timestamp": datetime.now(timezone.utc),
    })
    return jsonify({"status": "updated", "ndvi": ndvi})

@farm_bp.route("/<fid>/ndvi/history", methods=["GET"])
def ndvi_history(fid):
    docs = list(mongo.db.ndvi_history.find({"farm_id": fid}, {"_id": 0})
                .sort("timestamp", -1).limit(24))
    for d in docs:
        d["timestamp"] = d["timestamp"].isoformat()
    return jsonify(docs)
