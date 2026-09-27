from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from extensions import mongo
from config import MONGO_URI, UPLOAD_FOLDER
import os

app = Flask(__name__)
CORS(app, origins="*")

app.config["MONGO_URI"]    = MONGO_URI
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16MB max upload

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)
mongo.init_app(app)

print("MONGO_URI configured:", bool(MONGO_URI))
try:
    mongo.db.command("ping")
    print("MongoDB connection: OK")
    print("Farms:", mongo.db.farms.count_documents({}))
except Exception as e:
    print("MongoDB connection ERROR:", type(e).__name__, str(e))

from routes.sensor_routes       import sensor_bp
from routes.farm_routes         import farm_bp
from routes.credit_routes       import credit_bp
from routes.ai_routes           import ai_bp
from routes.auth_routes         import auth_bp
from routes.registration_routes import reg_bp
from routes.season_routes       import season_bp

app.register_blueprint(sensor_bp, url_prefix="/api/sensors")
app.register_blueprint(farm_bp,   url_prefix="/api/farms")
app.register_blueprint(credit_bp, url_prefix="/api/credits")
app.register_blueprint(ai_bp,     url_prefix="/api/ai")
app.register_blueprint(auth_bp,   url_prefix="/api/auth")
app.register_blueprint(reg_bp,    url_prefix="/api/register")
app.register_blueprint(season_bp, url_prefix="/api/seasons")

@app.route("/api/debug/routes")
def debug_routes():
    return jsonify(sorted([
        rule.rule
        for rule in app.url_map.iter_rules()
    ]))

@app.route("/")
def index():
    return jsonify({"project": "GreenLedger", "version": "2.0.0", "status": "running"})

@app.route("/api/health")
def health():
    try:
        mongo.db.command("ping")
        db_status = "connected"
        print("MongoDB ping: SUCCESS")
    except Exception as e:
        db_status = "disconnected"
        print(f"MongoDB ping ERROR: {type(e).__name__}: {e}")
    return jsonify({"api": "ok", "database": db_status})
