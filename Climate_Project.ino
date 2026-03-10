#include <DHT.h>

#define DHTPIN 4
#define DHTTYPE DHT22

#define MQ_PIN 34

DHT dht(DHTPIN, DHTTYPE);

void setup() {

  Serial.begin(115200);

  dht.begin();

  pinMode(MQ_PIN, INPUT);

  Serial.println("Sensor Test Started...");
}

void loop() {

  #include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ================= SENSOR CONFIG =================
#define DHTPIN 4
#define DHTTYPE DHT22
#define MQ_PIN 34

DHT dht(DHTPIN, DHTTYPE);

// ================= WIFI =================
const char* ssid = "JACKOFALLTRADES";
const char* password = "ghe bhikari";

// ================= SERVER =================
const char* serverUrl = "http://10.108.55.213:5000/predict_sensor";

// ================= TRACKING VARIABLES =================
float max_temperature = -100;
float min_temperature = 100;
int reading_count = 0;

// LAST VALID VALUES (sensor stability)
float lastTemp = 27.0;
float lastHum = 60.0;

void setup() {

  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=== CLIMATE MONITORING SYSTEM ===");

  pinMode(MQ_PIN, INPUT);

  dht.begin();

  // WIFI CONNECT
  Serial.print("Connecting WiFi");

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected");
  Serial.println(WiFi.localIP());
}

void loop() {

  // ================= READ SENSOR =================
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  // ================= SENSOR VALIDATION =================
  if (isnan(temperature) || temperature < -10 || temperature > 60) {
    temperature = lastTemp;
  } else {
    lastTemp = temperature;
  }

  if (isnan(humidity) || humidity < 0 || humidity > 100) {
    humidity = lastHum;
  } else {
    lastHum = humidity;
  }

  // ================= MQ SENSOR AVERAGING =================
  int gasValue = 0;

  for (int i = 0; i < 10; i++) {
    gasValue += analogRead(MQ_PIN);
    delay(5);
  }

  gasValue = gasValue / 10;

  // ================= UPDATE MAX / MIN =================
  if (temperature > max_temperature) max_temperature = temperature;
  if (temperature < min_temperature) min_temperature = temperature;

  reading_count++;

  // ================= SERIAL OUTPUT =================
  Serial.println("\n------ Sensor Data ------");

  Serial.print("Temperature: ");
  Serial.print(temperature);
  Serial.println(" °C");

  Serial.print("Humidity: ");
  Serial.print(humidity);
  Serial.println(" %");

  Serial.print("Gas Value: ");
  Serial.println(gasValue);

  Serial.print("Max Temp: ");
  Serial.println(max_temperature);

  Serial.print("Min Temp: ");
  Serial.println(min_temperature);

  Serial.print("Readings: ");
  Serial.println(reading_count);

  // ================= SEND DATA TO SERVER =================
  if (WiFi.status() == WL_CONNECTED) {

    StaticJsonDocument<256> doc;

    doc["temperature"] = temperature;
    doc["temp_max"] = max_temperature;
    doc["temp_min"] = min_temperature;
    doc["humidity"] = humidity;
    doc["mq_value"] = gasValue;

    String json;
    serializeJson(doc, json);

    HTTPClient http;

    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    int httpResponseCode = http.POST(json);

    if (httpResponseCode > 0) {

      String response = http.getString();

      Serial.println("Server Response:");
      Serial.println(response);

      StaticJsonDocument<200> resDoc;
      deserializeJson(resDoc, response);

      if (resDoc["success"]) {

        float aqi = resDoc["aqi"];

        Serial.print("Predicted AQI: ");
        Serial.println(aqi);
      }

    } 
    else {

      Serial.print("HTTP Error: ");
      Serial.println(httpResponseCode);

    }

    http.end();
  }

  Serial.println("-------------------------");

  delay(5000);
}