# GreenLedger — AI-Based Carbon Credit Monitoring System

> BTech Final Year Project | Vishwakarma Institute of Technology, Pune  
> Guide: Prof. Prachi Kamlesh Sorte

---

## What is GreenLedger?

GreenLedger is a full-stack IoT + AI platform that enables small Indian farmers to monitor carbon sequestration on their land and earn verified carbon credits — an income stream currently inaccessible to them due to high verification costs.

**Stack:** Python Flask · MongoDB · scikit-learn Random Forest · ESP8266 NodeMCU · HTML/CSS/JS · Docker

---

## Run in 3 Commands (Docker — works anywhere)

```bash
git clone https://github.com/YOUR_USERNAME/greenledger.git
cd greenledger
docker compose up --build
```

Then open **http://localhost:8080** in your browser.

> Docker will automatically: start MongoDB, train the AI model, seed demo data, and serve the dashboard.

---

## Run Without Docker (Windows / Mac / Linux)

### Prerequisites
- Python 3.11+
- MongoDB Community running on port 27017 — download at https://www.mongodb.com/try/download/community

### Steps

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/greenledger.git
cd greenledger

# 2. Install Python dependencies
cd backend
pip install -r requirements.txt

# 3. Train the AI model
python model/train_model.py

# 4. Seed demo data into MongoDB
python seed_db.py

# 5. Start Flask API
python app.py
```

Open a second terminal:
```bash
# 6. Serve the frontend (Python built-in server)
cd greenledger/frontend
python -m http.server 8080
```

Open **http://localhost:8080** — the dashboard connects to the API at port 5000.

---

## Project Structure

```
greenledger/
├── docker-compose.yml        ← one-command deployment
├── nginx.conf                ← frontend proxy config
├── .github/workflows/ci.yml  ← GitHub Actions CI
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app.py                ← Flask entry point
│   ├── seed_db.py            ← populate demo data
│   ├── routes/
│   │   ├── sensor_routes.py  ← IoT data ingestion
│   │   ├── farm_routes.py    ← farm CRUD
│   │   ├── credit_routes.py  ← carbon credit ledger
│   │   └── ai_routes.py      ← AI estimation endpoints
│   └── model/
│       ├── train_model.py    ← train Random Forest
│       └── predictor.py      ← inference helper
│
├── frontend/
│   └── index.html            ← full dashboard (single file)
│
└── esp8266/
    └── greenledger_sensor.ino ← Arduino firmware
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/sensors/data` | ESP8266 pushes reading |
| GET | `/api/sensors/latest` | Latest reading per farm |
| GET | `/api/sensors/history/<farm_id>` | Reading history |
| GET | `/api/sensors/alerts` | Active alerts |
| GET | `/api/farms/` | List all farms |
| POST | `/api/farms/` | Register new farm |
| PATCH | `/api/farms/<id>/ndvi` | Update NDVI |
| GET | `/api/credits/` | All carbon credits |
| POST | `/api/credits/issue` | Issue a credit |
| PATCH | `/api/credits/<id>/verify` | Verify a credit |
| GET | `/api/credits/summary` | Totals by status |
| POST | `/api/ai/estimate` | Estimate CO₂ |
| POST | `/api/ai/estimate/farm/<id>` | Estimate for stored farm |

**Example — push sensor reading:**
```bash
curl -X POST http://localhost:5000/api/sensors/data \
  -H "Content-Type: application/json" \
  -d '{"farm_id":"F-01","soil_moisture":62,"temperature":28.4,"humidity":71,"device_id":"GL-8266"}'
```

---

## ESP8266 Hardware Setup

### Components
- NodeMCU ESP8266 (any version)
- Capacitive soil moisture sensor (or resistive)
- DHT11 temperature + humidity sensor
- Breadboard + jumper wires

### Wiring

```
NodeMCU  →  Sensor
─────────────────────────────
A0       →  Soil moisture SIG
D4       →  DHT11 DATA
3.3V     →  VCC (both sensors)
GND      →  GND (both sensors)
```

### Flash the firmware

1. Install [Arduino IDE](https://www.arduino.cc/en/software)
2. Add ESP8266 board: `File > Preferences > Additional URLs`:  
   `http://arduino.esp8266.com/stable/package_esp8266com_index.json`
3. Install via Library Manager: **ArduinoJson**, **DHT sensor library**, **Adafruit Unified Sensor**
4. Open `esp8266/greenledger_sensor.ino`
5. Edit the config block at the top (WiFi credentials + your laptop IP)
6. **Tools > Board > NodeMCU 1.0 (ESP-12E)** → Upload

Find your laptop IP: run `ipconfig` on Windows, look for IPv4 Address.

---

## AI Model

| Property | Value |
|----------|-------|
| Algorithm | Random Forest Regressor |
| Trees | 200 |
| Features | NDVI, area, SOC%, avg temp, avg moisture, months, practice |
| Target | CO₂ sequestered (tonnes) |
| R² score | ~0.94 |
| MAE | ~1.5 t CO₂ |
| Carbon formula | `Credits = floor(CO₂_tonnes)` · 1 credit = 1 tonne |

---

## Team

| Name | Role |
|------|------|
| Ram Sunil Rajurkar | AI model |
| Chirag Kochar | Frontend dashboard |
| Atharva Satish Gaikwad | ESP8266 firmware + hardware + Backend + Database |
| Prem Mangesh Palhade | Deployment + App Development |

**Guide:** Prof. Prachi Kamlesh Sorte  
**Institution:** Vishwakarma Institute of Technology, Pune
