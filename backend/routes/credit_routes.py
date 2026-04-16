from flask import Blueprint, request, jsonify
from datetime import datetime, timezone, timedelta
from extensions import mongo
from config import SENSOR_INACTIVE_DAYS
import math

credit_bp = Blueprint("credits", __name__)

def _ser(doc):
    doc["_id"] = str(doc["_id"])
    for k in ["issued_on", "verified_on"]:
        if doc.get(k): doc[k] = doc[k].isoformat()
    return doc

def log_action(action, details, admin="admin"):
    mongo.db.audit_log.insert_one({
        "action": action, "details": details,
        "admin": admin, "timestamp": datetime.now(timezone.utc),
    })

@credit_bp.route("/", methods=["GET"])
def list_credits():
    q = {}
    if request.args.get("status"): q["status"] = request.args["status"]
    if request.args.get("farm_id"): q["farm_id"] = request.args["farm_id"]
    return jsonify([_ser(d) for d in mongo.db.carbon_credits.find(q).sort("issued_on", -1).limit(200)])

@credit_bp.route("/summary", methods=["GET"])
def summary():
    pipeline = [{"$group": {
        "_id": "$status",
        "total_credits": {"$sum": "$credits"},
        "total_co2":     {"$sum": "$co2_tons"},
        "total_value":   {"$sum": "$value_inr"},
        "count":         {"$sum": 1},
    }}]
    return jsonify(list(mongo.db.carbon_credits.aggregate(pipeline)))

@credit_bp.route("/issue", methods=["POST"])
def issue():
    d = request.get_json(force=True)
    for f in ["farm_id", "co2_tons"]:
        if f not in d:
            return jsonify({"error": f"Missing: {f}"}), 400

    farm = mongo.db.farms.find_one({"farm_id": d["farm_id"]})
    if not farm:
        return jsonify({"error": "Farm not found"}), 404

    # Block if sensor inactive
    cutoff = datetime.now(timezone.utc) - timedelta(days=SENSOR_INACTIVE_DAYS)
    recent_count = mongo.db.sensor_readings.count_documents({
        "farm_id":   d["farm_id"],
        "timestamp": {"$gte": cutoff}
    })
    if recent_count < 100:
        return jsonify({
            "error": f"Cannot issue credit — insufficient sensor data. Found {recent_count} readings in last {SENSOR_INACTIVE_DAYS} days. Minimum 100 required.",
            "blocked": True,
            "readings_found": recent_count,
            "readings_required": 100
        }), 400
    co2   = float(d["co2_tons"])
    units = math.floor(co2)
    value = units * 500
    count = mongo.db.carbon_credits.count_documents({}) + 1
    cid   = f"CRD-{count:04d}"

    season_id = d.get("season_id")

    mongo.db.carbon_credits.insert_one({
        "credit_id":   cid,
        "farm_id":     d["farm_id"],
        "farmer_name": farm.get("farmer_name", ""),
        "season_id":   season_id,
        "co2_tons":    round(co2, 3),
        "credits":     units,
        "value_inr":   value,
        "ndvi_used":   float(d.get("ndvi", farm.get("ndvi", 0))),
        "soc_used":    float(d.get("soc", farm.get("soil_organic_carbon", 1.5))),
        "status":      "pending",
        "issued_on":   datetime.now(timezone.utc),
        "verified_on": None,
        "notes":       d.get("notes", ""),
    })
    mongo.db.farms.update_one(
        {"farm_id": d["farm_id"]},
        {"$inc": {"total_credits": units, "total_co2": co2}}
    )
    log_action("issue_credit", {"credit_id": cid, "farm_id": d["farm_id"], "co2": co2})
    return jsonify({"status": "issued", "credit_id": cid,
                    "credits": units, "co2_tons": round(co2,3), "value_inr": value}), 201

@credit_bp.route("/<cid>/initiate-payment", methods=["PATCH"])
def initiate_payment(cid):
    credit = mongo.db.carbon_credits.find_one({"credit_id": cid})
    if not credit:
        return jsonify({"error": "Credit not found"}), 404
    if credit.get("status") != "verified":
        return jsonify({"error": "Credit must be verified before payment"}), 400

    farm = mongo.db.farms.find_one({"farm_id": credit["farm_id"]})
    bank = farm.get("bank_details", {}) if farm else {}

    mongo.db.carbon_credits.update_one(
        {"credit_id": cid},
        {"$set": {
            "payment_status": "initiated",
            "payment_initiated_on": datetime.now(timezone.utc),
            "payment_method": "upi" if bank.get("upi_id") else "bank_transfer",
            "payment_ref": f"GL-PAY-{cid}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        }}
    )
    log_action("initiate_payment", {"credit_id": cid, "farm_id": credit["farm_id"]})
    return jsonify({
        "status": "payment_initiated",
        "credit_id": cid,
        "amount": credit.get("value_inr", 0),
        "farmer": credit.get("farmer_name"),
        "bank_details": bank,
        "note": "In production this triggers automatic UPI/bank transfer via Razorpay"
    })

@credit_bp.route("/<cid>/mark-paid", methods=["PATCH"])
def mark_paid(cid):
    d = request.get_json(force=True) or {}
    mongo.db.carbon_credits.update_one(
        {"credit_id": cid},
        {"$set": {
            "payment_status": "paid",
            "payment_completed_on": datetime.now(timezone.utc),
            "transaction_id": d.get("transaction_id", f"TXN{cid}"),
            "farmer_confirmed": False,
            "payment_disputed": False,
        }}
    )
    log_action("mark_paid", {"credit_id": cid})
    return jsonify({"status": "paid"})

@credit_bp.route("/<cid>/confirm-receipt", methods=["PATCH"])
def confirm_receipt(cid):
    mongo.db.carbon_credits.update_one(
        {"credit_id": cid},
        {"$set": {
            "farmer_confirmed": True,
            "farmer_confirmed_on": datetime.now(timezone.utc),
            "payment_disputed": False,
        }}
    )
    log_action("farmer_confirmed_payment", {"credit_id": cid})
    return jsonify({"status": "confirmed"})

@credit_bp.route("/<cid>/dispute-payment", methods=["PATCH"])
def dispute_payment(cid):
    d = request.get_json(force=True) or {}
    mongo.db.carbon_credits.update_one(
        {"credit_id": cid},
        {"$set": {
            "payment_disputed": True,
            "dispute_reason": d.get("reason", "Payment not received"),
            "disputed_on": datetime.now(timezone.utc),
            "farmer_confirmed": False,
        }}
    )
    log_action("payment_disputed", {"credit_id": cid, "reason": d.get("reason")})
    return jsonify({"status": "disputed"})

@credit_bp.route("/farmer-summary/<farm_id>", methods=["GET"])
def farmer_summary(farm_id):
    pipeline = [
        {"$match": {"farm_id": farm_id}},
        {"$group": {
            "_id": "$status",
            "total_credits": {"$sum": "$credits"},
            "total_co2":     {"$sum": "$co2_tons"},
            "total_value":   {"$sum": "$value_inr"},
            "count":         {"$sum": 1},
        }}
    ]
    rows = list(mongo.db.carbon_credits.aggregate(pipeline))
    paid = list(mongo.db.carbon_credits.find({
        "farm_id": farm_id,
        "payment_status": "paid"
    }, {"_id": 0, "credit_id": 1, "value_inr": 1, "payment_completed_on": 1}))
    return jsonify({"summary": rows, "paid_credits": paid})

@credit_bp.route("/<cid>/verify", methods=["PATCH"])
def verify(cid):
    mongo.db.carbon_credits.update_one(
        {"credit_id": cid},
        {"$set": {"status": "verified", "verified_on": datetime.now(timezone.utc)}}
    )
    log_action("verify_credit", {"credit_id": cid})
    return jsonify({"status": "verified"})

@credit_bp.route("/<cid>/reject", methods=["PATCH"])
def reject(cid):
    reason = (request.get_json(force=True) or {}).get("reason", "")
    mongo.db.carbon_credits.update_one(
        {"credit_id": cid},
        {"$set": {"status": "rejected", "rejection_reason": reason,
                  "verified_on": datetime.now(timezone.utc)}}
    )
    log_action("reject_credit", {"credit_id": cid, "reason": reason})
    return jsonify({"status": "rejected"})
