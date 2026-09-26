import os
from dotenv import load_dotenv
load_dotenv()

MODE = os.getenv("MODE", "production")

# ── Database ──────────────────────────────────────────
MONGO_URI_DEV  = "mongodb://localhost:27017/greenledger"
MONGO_URI_PROD = os.getenv("MONGO_URI")
MONGO_URI = MONGO_URI_PROD if MODE == "production" else MONGO_URI_DEV

# ── API URL (used by frontend + app) ─────────────────
API_URL_DEV  = "http://192.168.1.8:5000"
API_URL_PROD = os.getenv("API_URL", "https://greenledger.up.railway.app")

API_URL = API_URL_PROD if MODE == "production" else API_URL_DEV

# ── Admin credentials ─────────────────────────────────
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "greenledger@admin")

# ── Firebase ──────────────────────────────────────────
FIREBASE_PROJECT_ID = "greenledger-13842"

# ── Upload folder ─────────────────────────────────────
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")

# ── Sensor thresholds ─────────────────────────────────
MOISTURE_LOW_THRESHOLD  = 25.0   # % — alert if below
TEMP_HIGH_THRESHOLD     = 38.0   # °C — alert if above
SENSOR_INACTIVE_DAYS    = 30     # days — block credits if no reading

print(f"Running in {MODE} mode")
print(f"MongoDB: {'Atlas' if MODE == 'production' else 'Local'}")
