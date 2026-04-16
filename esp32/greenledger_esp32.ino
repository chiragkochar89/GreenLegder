/*
 * GreenLedger — ESP32 Sensor Node v2.0
 * =====================================
 * Sensors  : Soil Moisture (GPIO34) + DHT11 (GPIO4) + EC sensor (GPIO35)
 * Sends    : JSON POST to Flask API every 30s (demo) or 10min (field)
 * Security : Device token in every request header
 *
 * Wiring:
 *   Soil Moisture AOUT  →  GPIO34
 *   DHT11 DATA          →  GPIO4
 *   EC Sensor AOUT      →  GPIO35
 *   All VCC             →  3.3V  (moisture + DHT11)
 *   EC VCC              →  VIN (5V)
 *   All GND             →  GND
 *
 * Libraries (Arduino Library Manager):
 *   ArduinoJson v6   by Benoit Blanchon
 *   DHT sensor       by Adafruit
 *   Adafruit Unified Sensor
 *
 * Board: ESP32 Dev Module
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <math.h>

/* ════ CHANGE THESE ══════════════════════════════════════ */
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Local development (laptop IP):
const char* API_URL = "http://192.168.1.8:5000/api/sensors/data";

// Production (uncomment before demo on Railway):
// const char* API_URL = "https://greenledger.up.railway.app/api/sensors/data";

const char* FARM_ID      = "F-01";
const char* DEVICE_ID    = "GL-F01";
const char* DEVICE_TOKEN = "gl-f01-a3f9c2e1"; // from seed_db.py

// Demo mode: send every 30 seconds so changes are visible
// Field mode: send every 600000 ms (10 minutes)
const unsigned long SEND_INTERVAL = 30000UL;
/* ════════════════════════════════════════════════════════ */

/* ── Pin definitions ── */
#define SOIL_PIN    34    // Analog — soil moisture
#define EC_PIN      35    // Analog — EC sensor
#define DHT_PIN     4     // Digital — DHT11
#define DHT_TYPE    DHT11
#define LED_PIN     2     // Built-in LED

/* ── Soil moisture calibration ── */
// Put sensor in dry air → note ADC reading → set as DRY
// Put sensor in water   → note ADC reading → set as WET
const int SOIL_DRY = 3200;
const int SOIL_WET = 1200;

/* ── EC calibration ── */
// EC sensor gives ADC 0-4095 → convert to mS/cm
const float EC_CAL_FACTOR = 0.0015;  // adjust for your sensor

DHT dht(DHT_PIN, DHT_TYPE);
unsigned long lastSent = 0;

/* ════════════════════════════════════════════════════════ */
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== GreenLedger ESP32 Sensor Node ===");
  Serial.print("Farm: "); Serial.println(FARM_ID);
  Serial.print("Device: "); Serial.println(DEVICE_ID);

  pinMode(LED_PIN, OUTPUT);
  dht.begin();
  analogReadResolution(12); // ESP32 12-bit ADC (0-4095)

  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();

  unsigned long now = millis();
  if (lastSent == 0 || now - lastSent >= SEND_INTERVAL) {

    float moisture, temp, humidity, ec, soc, ph;

    if (!readSensors(moisture, temp, humidity, ec, soc, ph)) {
      Serial.println("[ERROR] Sensor read failed — check wiring");
      blink(3, 300);
      delay(5000);
      return;
    }

    printReadings(moisture, temp, humidity, ec, soc, ph);

    if (sendToAPI(moisture, temp, humidity, ec, soc, ph)) {
      lastSent = now;
      blink(2, 150);  // 2 blinks = success
    } else {
      Serial.println("[ERROR] API send failed — retrying in 30s");
      blink(5, 80);   // 5 rapid blinks = error
      delay(30000);
    }
  }
  delay(500);
}

/* ── Read all sensors ── */
bool readSensors(float& moisture, float& temp, float& humidity,
                 float& ec, float& soc, float& ph) {

  // Soil moisture (average 5 ADC readings)
  long adc_sum = 0;
  for (int i = 0; i < 5; i++) {
    adc_sum += analogRead(SOIL_PIN);
    delay(10);
  }
  int adc_avg  = adc_sum / 5;
  moisture = map(adc_avg, SOIL_DRY, SOIL_WET, 0, 100);
  moisture = constrain(moisture, 0.0f, 100.0f);

  // EC sensor
  long ec_sum = 0;
  for (int i = 0; i < 5; i++) {
    ec_sum += analogRead(EC_PIN);
    delay(10);
  }
  int ec_raw = ec_sum / 5;
  float ec_voltage = (ec_raw / 4095.0f) * 3.3f;
  ec = ec_voltage * EC_CAL_FACTOR * 1000.0f; // convert to mS/cm
  ec = constrain(ec, 0.01f, 5.0f);

  // DHT11 (retry up to 3 times)
  for (int attempt = 0; attempt < 3; attempt++) {
    humidity = dht.readHumidity();
    temp     = dht.readTemperature();
    if (!isnan(humidity) && !isnan(temp)) {
      // Estimate SOC from EC + moisture (Sudduth et al., 2003)
      soc = 0.347f * log(ec + 0.01f) + 1.24f * (moisture / 100.0f) + 0.18f;
      soc = constrain(soc, 0.5f, 5.0f);
      // Estimate pH from moisture
      ph  = 7.2f - (moisture / 100.0f) * 0.7f;
      ph  = constrain(ph, 5.0f, 8.0f);
      return true;
    }
    delay(2000);
  }
  return false;
}

/* ── HTTP POST to API ── */
bool sendToAPI(float moisture, float temp, float humidity,
               float ec, float soc, float ph) {

  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.setTimeout(10000);

  StaticJsonDocument<256> doc;
  doc["farm_id"]        = FARM_ID;
  doc["device_id"]      = DEVICE_ID;
  doc["device_token"]   = DEVICE_TOKEN;
  doc["soil_moisture"]  = round(moisture * 10) / 10.0f;
  doc["temperature"]    = round(temp     * 10) / 10.0f;
  doc["humidity"]       = round(humidity * 10) / 10.0f;
  doc["ec"]             = round(ec       * 100) / 100.0f;
  doc["soc_estimated"]  = round(soc      * 100) / 100.0f;
  doc["soil_ph"]        = round(ph       * 100) / 100.0f;

  String body;
  serializeJson(doc, body);
  Serial.print("[POST] "); Serial.println(body);

  int code = http.POST(body);
  String resp = http.getString();
  http.end();

  Serial.print("[HTTP] "); Serial.println(code);
  if (code == 201) {
    Serial.println("[OK] Data accepted by API");
    return true;
  }
  Serial.print("[ERR] Response: "); Serial.println(resp);
  return false;
}

/* ── WiFi ── */
void connectWiFi() {
  Serial.print("Connecting to "); Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500); Serial.print("."); attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("IP: "); Serial.println(WiFi.localIP());
    blink(3, 200);
  } else {
    Serial.println("\nWiFi FAILED — will retry");
  }
}

void blink(int n, int ms) {
  for (int i = 0; i < n; i++) {
    digitalWrite(LED_PIN, HIGH); delay(ms);
    digitalWrite(LED_PIN, LOW);  delay(ms);
  }
}

void printReadings(float m, float t, float h, float ec, float soc, float ph) {
  Serial.println("--- Sensor Reading ---");
  Serial.print("  Moisture    : "); Serial.print(m, 1); Serial.println(" %");
  Serial.print("  Temperature : "); Serial.print(t, 1); Serial.println(" °C");
  Serial.print("  Humidity    : "); Serial.print(h, 1); Serial.println(" %");
  Serial.print("  EC          : "); Serial.print(ec, 3); Serial.println(" mS/cm");
  Serial.print("  Est. SOC    : "); Serial.print(soc, 2); Serial.println(" %");
  Serial.print("  Est. pH     : "); Serial.println(ph, 2);
  Serial.println("---------------------");
}
