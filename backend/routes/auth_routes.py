from flask import Blueprint, request, jsonify, session
from config import ADMIN_USERNAME, ADMIN_PASSWORD
from functools import wraps

auth_bp = Blueprint("auth", __name__)

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("X-Admin-Token")
        if token != f"{ADMIN_USERNAME}:{ADMIN_PASSWORD}":
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated

@auth_bp.route("/admin/login", methods=["POST"])
def admin_login():
    d = request.get_json(force=True)
    if d.get("username") == ADMIN_USERNAME and d.get("password") == ADMIN_PASSWORD:
        token = f"{ADMIN_USERNAME}:{ADMIN_PASSWORD}"
        return jsonify({"status": "ok", "token": token})
    return jsonify({"error": "Invalid credentials"}), 401

@auth_bp.route("/admin/verify", methods=["GET"])
def verify_token():
    token = request.headers.get("X-Admin-Token")
    if token == f"{ADMIN_USERNAME}:{ADMIN_PASSWORD}":
        return jsonify({"status": "ok"})
    return jsonify({"error": "Invalid token"}), 401
