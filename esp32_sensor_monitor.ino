#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// Pin definitions
#define DHTPIN 4          // DHT11/DHT22 data pin
#define DHTTYPE DHT11     // DHT11 or DHT22
#define MQ135_PIN 34      // MQ-135 analog pin for gas sensor

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Server configuration
const char* serverUrl = "http://YOUR_SERVER_IP:5000/iot/predict_sensor";

// Sensor objects
DHT dht(DHTPIN, DHTTYPE);

// Timing variables
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 30000; // Send data every 30 seconds

void setup() {
  Serial.begin(115200);
  Serial.println("ESP32 IoT Sensor Monitor Starting...");

  // Initialize DHT sensor
  dht.begin();
  Serial.println("DHT sensor initialized");

  // Initialize gas sensor pin
  pinMode(MQ135_PIN, INPUT);
  Serial.println("MQ-135 gas sensor initialized");

  // Connect to WiFi
  connectToWiFi();

  Serial.println("Setup complete!");
}

void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, reconnecting...");
    connectToWiFi();
  }

  // Send sensor data at regular intervals
  if (millis() - lastSendTime >= sendInterval) {
    sendSensorData();
    lastSendTime = millis();
  }

  // Small delay to prevent overwhelming the serial output
  delay(1000);
}

void connectToWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFailed to connect to WiFi");
  }
}

void sendSensorData() {
  // Read sensor values
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  int gasValue = analogRead(MQ135_PIN);

  // Check if readings are valid
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Failed to read from DHT sensor!");
    return;
  }

  // Create JSON payload
  StaticJsonDocument<200> jsonDoc;
  jsonDoc["temperature"] = temperature;
  jsonDoc["humidity"] = humidity;
  jsonDoc["gas_value"] = gasValue;

  String jsonString;
  serializeJson(jsonDoc, jsonString);

  // Send HTTP POST request
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    Serial.println("Sending sensor data...");
    Serial.print("Temperature: ");
    Serial.print(temperature);
    Serial.print("°C, Humidity: ");
    Serial.print(humidity);
    Serial.print("%, Gas Value: ");
    Serial.println(gasValue);

    int httpResponseCode = http.POST(jsonString);

    if (httpResponseCode > 0) {
      Serial.print("HTTP Response code: ");
      Serial.println(httpResponseCode);

      String response = http.getString();
      Serial.println("Response:");
      Serial.println(response);

      // Parse response to check for prediction
      StaticJsonDocument<1024> responseDoc;
      DeserializationError error = deserializeJson(responseDoc, response);

      if (!error) {
        if (responseDoc.containsKey("prediction")) {
          JsonObject prediction = responseDoc["prediction"];
          if (prediction.containsKey("category")) {
            String category = prediction["category"];
            float aqi = prediction["aqi_value"];
            Serial.print("Air Quality: ");
            Serial.print(category);
            Serial.print(" (AQI: ");
            Serial.print(aqi);
            Serial.println(")");
          }
        }
      }
    } else {
      Serial.print("Error sending POST request: ");
      Serial.println(httpResponseCode);
    }

    http.end();
  } else {
    Serial.println("WiFi not connected, cannot send data");
  }
}