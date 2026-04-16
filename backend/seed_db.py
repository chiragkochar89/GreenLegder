from pymongo import MongoClient
from datetime import datetime, timezone, timedelta
import os, random, math, sys

# Use Atlas by default, local if --local flag passed
if "--local" in sys.argv:
    URI = "mongodb://localhost:27017/greenledger"
    print("Using LOCAL MongoDB")
else:
    URI = "mongodb+srv://greenledger:greenledger2025@greenledger.4bdteyn.mongodb.net/greenledger?retryWrites=true&w=majority&appName=greenledger"
    print("Using MongoDB ATLAS")

db = MongoClient(URI)["greenledger"]

for c in ["farms","sensor_readings","carbon_credits","ndvi_history",
          "alerts","ai_predictions","seasons","farmer_applications","audit_log"]:
    db[c].drop()
    print(f"  Cleared {c}")

FARMS = [
    {"farm_id":"F-01","farmer_name":"Ramesh Patil",   "phone":"+919876543210","aadhaar_last4":"1234","location":"Pune",       "district":"Pune",       "area_hectares":4.2,"crop_type":"Soybean",    "practice":"no_till",     "ndvi":0.71,"soil_organic_carbon":2.8,"latitude":18.5204,"longitude":73.8567,"device_id":"GL-F01","device_token":"gl-f01-a3f9c2e1"},
    {"farm_id":"F-02","farmer_name":"Sunita Jadhav",  "phone":"+919876543211","aadhaar_last4":"2345","location":"Nashik",     "district":"Nashik",     "area_hectares":3.1,"crop_type":"Grapes",     "practice":"cover_crop",  "ndvi":0.65,"soil_organic_carbon":2.4,"latitude":20.0112,"longitude":73.7898,"device_id":"GL-F02","device_token":"gl-f02-b4g0d3f2"},
    {"farm_id":"F-03","farmer_name":"Mohan Shinde",   "phone":"+919876543212","aadhaar_last4":"3456","location":"Kolhapur",   "district":"Kolhapur",   "area_hectares":5.8,"crop_type":"Sugarcane",  "practice":"conventional","ndvi":0.58,"soil_organic_carbon":1.9,"latitude":16.7050,"longitude":74.2433,"device_id":"GL-F03","device_token":"gl-f03-c5h1e4g3"},
    {"farm_id":"F-04","farmer_name":"Lata Deshmukh",  "phone":"+919876543213","aadhaar_last4":"4567","location":"Aurangabad", "district":"Aurangabad", "area_hectares":2.6,"crop_type":"Cotton",     "practice":"no_till",     "ndvi":0.74,"soil_organic_carbon":3.1,"latitude":19.8762,"longitude":75.3433,"device_id":"GL-F04","device_token":"gl-f04-d6i2f5h4"},
    {"farm_id":"F-05","farmer_name":"Vijay More",     "phone":"+919876543214","aadhaar_last4":"5678","location":"Satara",     "district":"Satara",     "area_hectares":3.9,"crop_type":"Jowar",      "practice":"conventional","ndvi":0.62,"soil_organic_carbon":2.2,"latitude":17.6805,"longitude":74.0183,"device_id":"GL-F05","device_token":"gl-f05-e7j3g6i5"},
    {"farm_id":"F-06","farmer_name":"Priya Kulkarni", "phone":"+919876543215","aadhaar_last4":"6789","location":"Solapur",    "district":"Solapur",    "area_hectares":4.5,"crop_type":"Pomegranate","practice":"cover_crop",  "ndvi":0.68,"soil_organic_carbon":2.6,"latitude":17.6599,"longitude":75.9064,"device_id":"GL-F06","device_token":"gl-f06-f8k4h7j6"},
    {"farm_id":"F-07","farmer_name":"Santosh Gaikwad","phone":"+919876543216","aadhaar_last4":"7890","location":"Latur",      "district":"Latur",      "area_hectares":2.2,"crop_type":"Tur Dal",    "practice":"conventional","ndvi":0.44,"soil_organic_carbon":1.5,"latitude":18.4088,"longitude":76.5604,"device_id":"GL-F07","device_token":"gl-f07-g9l5i8k7"},
    {"farm_id":"F-08","farmer_name":"Kavita Thorat",  "phone":"+919876543217","aadhaar_last4":"8901","location":"Pune",       "district":"Pune",       "area_hectares":6.0,"crop_type":"Wheat",      "practice":"no_till",     "ndvi":0.79,"soil_organic_carbon":3.4,"latitude":18.6298,"longitude":73.7997,"device_id":"GL-F08","device_token":"gl-f08-h0m6j9l8"},
    {"farm_id":"F-09","farmer_name":"Dilip Bhosale",  "phone":"+919876543218","aadhaar_last4":"9012","location":"Nagpur",     "district":"Nagpur",     "area_hectares":3.3,"crop_type":"Orange",     "practice":"agroforestry","ndvi":0.56,"soil_organic_carbon":2.0,"latitude":21.1458,"longitude":79.0882,"device_id":"GL-F09","device_token":"gl-f09-i1n7k0m9"},
]

now = datetime.now(timezone.utc)
for f in FARMS:
    f.update({"total_credits":0,"total_co2":0.0,"active":True,"state":"Maharashtra",
              "registered_on":now-timedelta(days=random.randint(60,180)),
              "approved_by":"admin"})
db.farms.insert_many(FARMS)
print(f"  Inserted {len(FARMS)} farms")

readings = []
for farm in FARMS:
    for day in range(14):
        for hour in range(0,24,2):
            moisture = round(random.uniform(30,82),1)
            ec       = round(random.uniform(0.8,2.5),2)
            soc_est  = round(0.347*math.log(ec+0.01)+1.24*(moisture/100)+0.18, 2)
            soc_est  = max(0.5, min(5.0, soc_est))
            readings.append({
                "farm_id":       farm["farm_id"],
                "soil_moisture": moisture,
                "temperature":   round(random.uniform(22,36),1),
                "humidity":      round(random.uniform(48,86),1),
                "soil_ph":       round(random.uniform(5.8,7.4),2),
                "ec":            ec,
                "soc_estimated": soc_est,
                "device_id":     farm["device_id"],
                "timestamp":     now-timedelta(days=day,hours=hour),
            })
db.sensor_readings.insert_many(readings)
print(f"  Inserted {len(readings)} sensor readings")

ndvi_docs = []
for farm in FARMS:
    for m in range(12):
        ndvi_docs.append({"farm_id":farm["farm_id"],
                          "ndvi":round(farm["ndvi"]+random.uniform(-0.08,0.08),3),
                          "source":"satellite","timestamp":now-timedelta(days=30*m)})
db.ndvi_history.insert_many(ndvi_docs)

seasons = []
season_names = ["Kharif 2024","Rabi 2024","Kharif 2025"]
for farm in FARMS:
    for i,sn in enumerate(season_names):
        status = "active" if i==2 else "closed"
        seasons.append({"season_id":f"{farm['farm_id']}-{sn.upper().replace(' ','-')}",
                        "farm_id":farm["farm_id"],"season_name":sn,
                        "crop_type":farm["crop_type"],"crop_factor":1.0,
                        "start_date":now-timedelta(days=300-i*120),
                        "end_date":None if status=="active" else now-timedelta(days=180-i*120),
                        "status":status,"created_on":now-timedelta(days=300-i*120)})
db.seasons.insert_many(seasons)

credits, num = [], 1
for farm in FARMS:
    for i in range(random.randint(2,4)):
        co2    = round(farm["ndvi"]*farm["area_hectares"]*1.8+random.uniform(-0.4,0.4),2)
        units  = math.floor(co2)
        status = random.choices(["verified","pending","rejected"],[6,3,1])[0]
        issued = now-timedelta(days=random.randint(5,120))
        credits.append({
            "credit_id":f"CRD-{num:04d}","farm_id":farm["farm_id"],
            "farmer_name":farm["farmer_name"],"co2_tons":co2,"credits":units,
            "value_inr":units*500,"status":status,"issued_on":issued,
            "verified_on":issued+timedelta(days=3) if status=="verified" else None,"notes":""})
        num += 1
db.carbon_credits.insert_many(credits)

db.alerts.insert_one({"farm_id":"F-07","type":"low_moisture","severity":"warning",
    "message":"Soil moisture 18% — below 25% threshold","timestamp":now,"resolved":False})

print(f"  Inserted {len(ndvi_docs)} NDVI | {len(seasons)} seasons | {len(credits)} credits")
print("\nDatabase seeded successfully!")
