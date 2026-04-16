from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, timezone
from extensions import mongo
from config import UPLOAD_FOLDER, FIREBASE_PROJECT_ID
import os, requests, math, random, string

reg_bp = Blueprint("register", __name__)

def gen_farm_id():
    count = mongo.db.farms.count_documents({}) + 1
    return f"F-{count:02d}"

def gen_device_token(farm_id):
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"gl-{farm_id.lower()}-{suffix}"

def log_action(action, details, admin=None):
    mongo.db.audit_log.insert_one({
        "action":    action,
        "details":   details,
        "admin":     admin,
        "timestamp": datetime.now(timezone.utc),
    })

# POST /api/register/apply
@reg_bp.route("/apply", methods=["POST"])
def apply():
    d = request.form.to_dict()
    required = ["full_name","phone","aadhaar_last4","village",
                "district","area_acres","crop_type","practice"]
    for f in required:
        if not d.get(f):
            return jsonify({"error": f"Missing: {f}"}), 400

    if mongo.db.farmer_applications.find_one({"phone": d["phone"], "status": {"$in": ["pending","approved"]}}):
        return jsonify({"error": "Application already exists for this phone number"}), 409

    app_id = f"APP-{mongo.db.farmer_applications.count_documents({}) + 1:04d}"

    docs = {}
    for field in ["selfie", "document_712", "aadhaar_photo"]:
        if field in request.files:
            file = request.files[field]
            folder = os.path.join(UPLOAD_FOLDER, app_id)
            os.makedirs(folder, exist_ok=True)
            ext      = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
            filename = f"{field}.{ext}"
            file.save(os.path.join(folder, filename))
            docs[field] = f"uploads/{app_id}/{filename}"

    application = {
        "application_id":   app_id,
        "full_name":         d["full_name"],
        "phone":             d["phone"],
        "aadhaar_last4":     d["aadhaar_last4"],
        "village":           d["village"],
        "district":          d["district"],
        "state":             d.get("state", "Maharashtra"),
        "area_acres":        float(d["area_acres"]),
        "area_hectares":     float(d["area_acres"]) * 0.404686,
        "crop_type":         d["crop_type"],
        "practice":          d["practice"],
        "latitude":          float(d.get("latitude", 0)),
        "longitude":         float(d.get("longitude", 0)),
        "documents":         docs,
        "phone_verified":    False,
        "status":            "pending",
        "applied_on":        datetime.now(timezone.utc),
        "reviewed_by":       None,
        "reviewed_on":       None,
        "rejection_reason":  None,
    }
    mongo.db.farmer_applications.insert_one(application)
    return jsonify({"status": "submitted", "application_id": app_id}), 201


# POST /api/register/verify-otp
@reg_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    d = request.get_json(force=True)
    phone      = d.get("phone")
    id_token   = d.get("id_token")

    if not phone or not id_token:
        return jsonify({"error": "Missing phone or id_token"}), 400

    try:
        verify_url = f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyCeEgnwaiF5pdo-rhuXPyXTe4qoBrRsgqM"
        resp = requests.post(verify_url, json={"idToken": id_token}, timeout=10)
        data = resp.json()
        if "users" not in data:
            return jsonify({"error": "Invalid OTP token"}), 401
    except Exception as e:
        return jsonify({"error": f"OTP verification failed: {str(e)}"}), 500

    mongo.db.farmer_applications.update_one(
        {"phone": phone, "status": "pending"},
        {"$set": {"phone_verified": True}}
    )
    return jsonify({"status": "verified"})


# GET /api/register/applications  — admin
@reg_bp.route("/applications", methods=["GET"])
def list_applications():
    status = request.args.get("status", "pending")
    docs   = list(mongo.db.farmer_applications.find(
        {"status": status} if status != "all" else {}
    ).sort("applied_on", -1))
    for d in docs:
        d["_id"]        = str(d["_id"])
        d["applied_on"] = d["applied_on"].isoformat() if d.get("applied_on") else None
        if d.get("reviewed_on"):
            d["reviewed_on"] = d["reviewed_on"].isoformat()
    return jsonify(docs)


# GET /api/register/applications/<app_id>
@reg_bp.route("/applications/<app_id>", methods=["GET"])
def get_application(app_id):
    doc = mongo.db.farmer_applications.find_one({"application_id": app_id})
    if not doc:
        return jsonify({"error": "Not found"}), 404
    doc["_id"]        = str(doc["_id"])
    doc["applied_on"] = doc["applied_on"].isoformat()
    return jsonify(doc)


# PATCH /api/register/applications/<app_id>/approve
@reg_bp.route("/applications/<app_id>/approve", methods=["PATCH"])
def approve(app_id):
    app_doc = mongo.db.farmer_applications.find_one({"application_id": app_id})
    if not app_doc:
        return jsonify({"error": "Not found"}), 404

    farm_id      = gen_farm_id()
    device_token = gen_device_token(farm_id)
    now          = datetime.now(timezone.utc)

    farm = {
        "farm_id":             farm_id,
        "farmer_name":         app_doc["full_name"],
        "phone":               app_doc["phone"],
        "aadhaar_last4":       app_doc["aadhaar_last4"],
        "application_id":      app_id,
        "location":            app_doc["village"],
        "district":            app_doc["district"],
        "state":               app_doc.get("state", "Maharashtra"),
        "area_hectares":       app_doc["area_hectares"],
        "crop_type":           app_doc["crop_type"],
        "practice":            app_doc["practice"],
        "latitude":            app_doc.get("latitude", 0),
        "longitude":           app_doc.get("longitude", 0),
        "device_id":           f"GL-{farm_id.replace('-','')}",
        "device_token":        device_token,
        "ndvi":                0.5,
        "soil_organic_carbon": 1.5,
        "total_credits":       0,
        "total_co2":           0.0,
        "registered_on":       now,
        "approved_by":         "admin",
        "active":              True,
    }
    mongo.db.farms.insert_one(farm)

    mongo.db.farmer_applications.update_one(
        {"application_id": app_id},
        {"$set": {"status": "approved", "farm_id": farm_id,
                  "reviewed_on": now, "reviewed_by": "admin"}}
    )

    log_action("approve_registration", {"app_id": app_id, "farm_id": farm_id}, "admin")

    return jsonify({
        "status":       "approved",
        "farm_id":      farm_id,
        "device_token": device_token,
    })


# PATCH /api/register/applications/<app_id>/reject
@reg_bp.route("/applications/<app_id>/reject", methods=["PATCH"])
def reject(app_id):
    d      = request.get_json(force=True) or {}
    reason = d.get("reason", "Documents could not be verified")
    now    = datetime.now(timezone.utc)
    mongo.db.farmer_applications.update_one(
        {"application_id": app_id},
        {"$set": {"status": "rejected", "rejection_reason": reason,
                  "reviewed_on": now, "reviewed_by": "admin"}}
    )
    log_action("reject_registration", {"app_id": app_id, "reason": reason}, "admin")
    return jsonify({"status": "rejected"})


# POST /api/register/farmer-login
@reg_bp.route("/farmer-login", methods=["POST"])
def farmer_login():
    d     = request.get_json(force=True)
    phone = d.get("phone")
    if not phone:
        return jsonify({"error": "Phone required"}), 400

    farm = mongo.db.farms.find_one({"phone": phone, "active": True})
    if farm:
        farm["_id"] = str(farm["_id"])
        if farm.get("registered_on"):
            farm["registered_on"] = farm["registered_on"].isoformat()
        return jsonify({"status": "approved", "farm": farm})

    app_doc = mongo.db.farmer_applications.find_one({"phone": phone})
    if app_doc:
        return jsonify({"status": app_doc["status"]})

    return jsonify({"error": "No application found for this number"}), 404
