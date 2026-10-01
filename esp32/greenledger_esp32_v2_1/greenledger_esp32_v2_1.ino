/*
 * GreenLedger — ESP32 Sensor Node v2.1
 * =====================================
 * Sensors  : Soil Moisture (GPIO34) + DHT11 (GPIO4)
 * EC sensor removed — not available in current prototype
 * Sends    : JSON POST to Flask API every 30s
 * Security : Device token in every request header
 *
 * Wiring:
 *   Soil Moisture AOUT  →  GPIO34
 *   Soil Moisture VCC   →  3.3V
 *   Soil Moisture GND   →  GND
 *   DHT11 DATA          →  GPI15
 *   DHT11 VCC           →  3.3V
 *   DHT11 GND           →  GND
 *
 * Libraries needed (Arduino Library Manager):
 *   ArduinoJson v6   by Benoit Blanchon
 *   DHT sensor       by Adafruit
 *   Adafruit Unified Sensor
 *
 * Board: DOIT ESP32 DEVKIT V1
 * Upload Speed: 115200
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

/* ════ CHANGE THESE ══════════════════════════════════════ */
const char* WIFI_SSID     = "Chirag";
const char* WIFI_PASSWORD = "11111111";

// Use local backend while testing on laptop:
//const char* API_URL = "http://192.168.1.8:5000/api/sensors/data";

// Switch to this when using Railway:
const char* API_URL = "https://greenledger-api-tzkg.onrender.com/api/sensors/data";

const char* FARM_ID      = "F-01";
const char* DEVICE_ID    = "GL-F01";
const char* DEVICE_TOKEN = "gl-f01-a3f9c2e1";

const unsigned long SEND_INTERVAL = 30000UL; // 30 seconds
/* ════════════════════════════════════════════════════════ */

/* ── Pin definitions ── */
#define SOIL_PIN    34
#define DHT_PIN     15
#define DHT_TYPE    DHT11
#define LED_PIN     2

/* ── Soil moisture calibration ── */
// Step 1: Hold sensor in dry air → note RAW value → set as SOIL_DRY
// Step 2: Put sensor in water   → note RAW value → set as SOIL_WET
const int SOIL_DRY = 3239;  // adjust after calibration
const int SOIL_WET = 1525;  // adjust after calibration

DHT dht(DHT_PIN, DHT_TYPE);
unsigned long lastSent = 0;

/* ════════════════════════════════════════════════════════ */
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== GreenLedger ESP32 Sensor Node v2.1 ===");
  Serial.print("Farm: ");   Serial.println(FARM_ID);
  Serial.print("Device: "); Serial.println(DEVICE_ID);
  Serial.println("Sensors: Soil Moisture + DHT11");
  Serial.println("==========================================\n");

  pinMode(LED_PIN, OUTPUT);
  analogReadResolution(12);
  dht.begin();
  delay(2000); // DHT11 needs 2 seconds to stabilise

  connectWiFi();
}

void loop() {
  // Reconnect WiFi if dropped
  if (WiFi.status() != WL_CONNECTED) connectWiFi();

  unsigned long now = millis();
  if (lastSent == 0 || now - lastSent >= SEND_INTERVAL) {

    float moisture, temp, humidity, soc, ph;

    if (!readSensors(moisture, temp, humidity, soc, ph)) {
      Serial.println("[ERROR] Sensor read failed — check wiring");
      blink(3, 300);
      delay(5000);
      return;
    }

    printReadings(moisture, temp, humidity, soc, ph);

    if (sendToAPI(moisture, temp, humidity, soc, ph)) {
      lastSent = now;
      blink(2, 150); // 2 blinks = success
    } else {
      Serial.println("[ERROR] API send failed — retrying in 30s");
      blink(5, 80);  // 5 rapid blinks = error
    }
  }
  delay(500);
}

/* ── Read sensors ── */
bool readSensors(float& moisture, float& temp, float& humidity,
                 float& soc, float& ph) {

  // Soil moisture — average 10 ADC readings to reduce noise
  long adc_sum = 0;
  for (int i = 0; i < 10; i++) {
    adc_sum += analogRead(SOIL_PIN);
    delay(10);
  }
  int adc_avg = adc_sum / 10;
  moisture = map(adc_avg, SOIL_DRY, SOIL_WET, 0, 100);
  moisture = constrain(moisture, 0.0f, 100.0f);

  Serial.print("[ADC] Raw: "); Serial.print(adc_avg);
  Serial.print(" → Moisture: "); Serial.print(moisture, 1); Serial.println("%");

  // DHT11 — retry up to 3 times
  for (int attempt = 0; attempt < 3; attempt++) {
    humidity = dht.readHumidity();
    temp     = dht.readTemperature();

    if (!isnan(humidity) && !isnan(temp)) {
      // SOC estimated from moisture only (proxy — no EC sensor)
      // Based on simplified Sudduth relationship using moisture as predictor
      soc = 0.18f + 1.24f * (moisture / 100.0f);
      soc = constrain(soc, 0.3f, 5.0f);

      // pH estimated from moisture
      ph = 7.2f - (moisture / 100.0f) * 0.7f;
      ph = constrain(ph, 5.0f, 8.5f);

      return true;
    }
    Serial.print("[DHT] Read failed, attempt ");
    Serial.println(attempt + 1);
    delay(2000);
  }

 // CORRECT
Serial.println("[DHT] All 3 attempts failed — check wiring on GPIO15");;
  return false;
}

/* ── Send to backend API ── */
bool sendToAPI(float moisture, float temp, float humidity,
               float soc, float ph) {

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Not connected — skipping send");
    return false;
  }

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.setTimeout(10000);

  StaticJsonDocument<256> doc;
  doc["farm_id"]       = FARM_ID;
  doc["device_id"]     = DEVICE_ID;
  doc["device_token"]  = DEVICE_TOKEN;
  doc["soil_moisture"] = round(moisture * 10) / 10.0f;
  doc["temperature"]   = round(temp     * 10) / 10.0f;
  doc["humidity"]      = round(humidity * 10) / 10.0f;
  doc["ec"]            = 0.0;   // no EC sensor in this prototype
  doc["soc_estimated"] = round(soc * 100) / 100.0f;
  doc["soil_ph"]       = round(ph  * 100) / 100.0f;

  String body;
  serializeJson(doc, body);
  Serial.print("[POST] "); Serial.println(body);

  int code = http.POST(body);
  String resp = http.getString();
  http.end();

  Serial.print("[HTTP] Response code: "); Serial.println(code);

  if (code == 201) {
    Serial.println("[OK] Reading accepted by GreenLedger API ✓");

    // Check if any alerts were triggered
    StaticJsonDocument<256> respDoc;
    deserializeJson(respDoc, resp);
    JsonArray alerts = respDoc["alerts"];
    if (alerts.size() > 0) {
      Serial.println("[ALERT] Server triggered alerts:");
      for (const char* alert : alerts) {
        Serial.print("  → "); Serial.println(alert);
      }
    }
    return true;
  }

  Serial.print("[ERR] Server response: "); Serial.println(resp);
  return false;
}

/* ── WiFi connection ── */
void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi connected!");
    Serial.print("  IP Address: ");
    Serial.println(WiFi.localIP());
    blink(3, 200);
  } else {
    Serial.println("\n✗ WiFi failed — will retry on next loop");
  }
}

/* ── LED blink helper ── */
void blink(int n, int ms) {
  for (int i = 0; i < n; i++) {
    digitalWrite(LED_PIN, HIGH); delay(ms);
    digitalWrite(LED_PIN, LOW);  delay(ms);
  }
}

/* ── Print readings to Serial Monitor ── */
void printReadings(float m, float t, float h, float soc, float ph) {
  Serial.println("─────────────────────────────");
  Serial.print("  Soil Moisture : "); Serial.print(m,   1); Serial.println(" %");
  Serial.print("  Temperature   : "); Serial.print(t,   1); Serial.println(" °C");
  Serial.print("  Humidity      : "); Serial.print(h,   1); Serial.println(" %");
  Serial.print("  Est. SOC      : "); Serial.print(soc, 2); Serial.println(" %");
  Serial.print("  Est. pH       : "); Serial.print(ph,  2);
  Serial.println("─────────────────────────────");
}
