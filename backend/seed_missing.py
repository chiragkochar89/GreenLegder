from pymongo import MongoClient
from datetime import datetime, timezone, timedelta
import os
import random
import math

URI = os.getenv("MONGO_URI")

if not URI:
    raise Exception("MONGO_URI is not set")

db = MongoClient(URI)["greenledger"]

farms = list(db.farms.find({"active": True}))

if not farms:
    raise Exception("No farms found in Atlas")

now = datetime.now(timezone.utc)

# Sensor readings
readings = []

for farm in farms:
    for day in range(14):
        for hour in range(0, 24, 2):
            moisture = round(random.uniform(30, 82), 1)
            ec = round(random.uniform(0.8, 2.5), 2)

            soc_est = round(
                0.347 * math.log(ec + 0.01)
                + 1.24 * (moisture / 100)
                + 0.18, 2
            )

            soc_est = max(0.5, min(5.0, soc_est))

            readings.append({
                "farm_id": farm["farm_id"],
                "soil_moisture": moisture,
                "temperature": round(random.uniform(22, 36), 1),
                "humidity": round(random.uniform(48, 86), 1),
                "soil_ph": round(random.uniform(5.8, 7.4), 2),
                "ec": ec,
                "soc_estimated": soc_est,
                "device_id": farm.get("device_id"),
                "timestamp": now - timedelta(days=day, hours=hour)
            })

if db.sensor_readings.count_documents({}) == 0:
    db.sensor_readings.insert_many(readings)
    print(f"Inserted {len(readings)} sensor readings")
else:
    print("Sensor readings already exist - skipped")

# NDVI history
ndvi_docs = []

for farm in farms:
    for m in range(12):
        ndvi_docs.append({
            "farm_id": farm["farm_id"],
            "ndvi": round(farm["ndvi"] + random.uniform(-0.08, 0.08), 3),
            "source": "satellite",
            "timestamp": now - timedelta(days=30 * m)
        })

if db.ndvi_history.count_documents({}) == 0:
    db.ndvi_history.insert_many(ndvi_docs)
    print(f"Inserted {len(ndvi_docs)} NDVI records")
else:
    print("NDVI history already exists - skipped")

# Seasons
seasons = []
season_names = ["Kharif 2024", "Rabi 2024", "Kharif 2025"]

if db.seasons.count_documents({}) == 0:
    for farm in farms:
        for i, name in enumerate(season_names):
            status = "active" if i == 2 else "closed"

            seasons.append({
                "season_id": f"{farm['farm_id']}-{name.upper().replace(' ', '-')}",
                "farm_id": farm["farm_id"],
                "season_name": name,
                "crop_type": farm["crop_type"],
                "crop_factor": 1.0,
                "start_date": now - timedelta(days=300 - i * 120),
                "end_date": None if status == "active"
                    else now - timedelta(days=180 - i * 120),
                "status": status,
                "created_on": now - timedelta(days=300 - i * 120)
            })

    db.seasons.insert_many(seasons)
    print(f"Inserted {len(seasons)} seasons")
else:
    print("Seasons already exist - skipped")

# Carbon credits
credits = []
num = 1

if db.carbon_credits.count_documents({}) == 0:
    for farm in farms:
        for i in range(3):
            co2 = round(
                farm["ndvi"] * farm["area_hectares"] * 1.8
                + random.uniform(-0.4, 0.4), 2
            )

            units = math.floor(co2)

            credits.append({
                "credit_id": f"CRD-{num:04d}",
                "farm_id": farm["farm_id"],
                "farmer_name": farm["farmer_name"],
                "co2_tons": co2,
                "credits": units,
                "value_inr": units * 500,
                "status": "verified",
                "issued_on": now - timedelta(days=random.randint(5, 60)),
                "verified_on": now - timedelta(days=random.randint(2, 30)),
                "notes": ""
            })

            num += 1

    db.carbon_credits.insert_many(credits)
    print(f"Inserted {len(credits)} carbon credits")
else:
    print("Carbon credits already exist - skipped")

# Alert
if db.alerts.count_documents({}) == 0:
    db.alerts.insert_one({
        "farm_id": "F-07",
        "type": "low_moisture",
        "severity": "warning",
        "message": "Soil moisture below threshold",
        "timestamp": now,
        "resolved": False
    })
    print("Inserted demo alert")
else:
    print("Alerts already exist - skipped")

print("SUCCESS - Demo data added safely!")