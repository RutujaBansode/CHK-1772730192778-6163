#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_GFX.h>

// Pin definitions
#define DHTPIN 4
#define DHTTYPE DHT11
#define MQ135_PIN 34
#define LED_PIN 2           // Built-in LED for status indication
#define OLED_RESET -1       // OLED reset pin
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

// WiFi credentials - Update these with your network details
const char* ssid = "JACKOFALLTRADES";
const char* password = "ghe bhikari";

// Server configuration
const char* serverUrl = "http://10.180.55.213:5000/iot/predict_sensor";

// Sensor objects
DHT dht(DHTPIN, DHTTYPE);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Timing and status variables
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 30000; // 30 seconds
unsigned long lastDisplayUpdate = 0;
const unsigned long displayUpdateInterval = 2000; // 2 seconds

// Sensor data structure
struct SensorData {
  float temperature;
  float humidity;
  int gasValue;
  String airQuality;
  float aqiValue;
  bool dataValid;
};

SensorData currentData = {0, 0, 0, "Unknown", 0, false};

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);

  // Initialize OLED display
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 allocation failed"));
    for(;;);
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(WHITE);
  display.setCursor(0,0);
  display.println("ESP32 IoT Monitor");
  display.println("Initializing...");
  display.display();

  // Initialize DHT sensor
  dht.begin();

  // Initialize gas sensor pin
  pinMode(MQ135_PIN, INPUT);

  // Connect to WiFi
  connectToWiFi();

  display.clearDisplay();
  display.setCursor(0,0);
  display.println("Ready!");
  display.display();

  Serial.println("ESP32 IoT Sensor Monitor with OLED Ready!");
}

void loop() {
  // Update display periodically
  if (millis() - lastDisplayUpdate >= displayUpdateInterval) {
    updateDisplay();
    lastDisplayUpdate = millis();
  }

  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    digitalWrite(LED_PIN, HIGH); // LED on when disconnected
    connectToWiFi();
  } else {
    digitalWrite(LED_PIN, LOW); // LED off when connected
  }

  // Send sensor data at regular intervals
  if (millis() - lastSendTime >= sendInterval) {
    readSensors();
    if (currentData.dataValid) {
      sendSensorData();
    }
    lastSendTime = millis();
  }

  delay(100);
}

void connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  display.clearDisplay();
  display.setCursor(0,0);
  display.println("Connecting to WiFi...");
  display.display();

  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;

    // Show connection progress on OLED
    display.setCursor(0,20);
    display.printf("Attempt: %d/20", attempts);
    display.display();
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());

    display.clearDisplay();
    display.setCursor(0,0);
    display.println("WiFi Connected!");
    display.setCursor(0,15);
    display.println(WiFi.localIP());
    display.display();
    delay(2000);
  } else {
    Serial.println("\nWiFi connection failed");
    display.clearDisplay();
    display.setCursor(0,0);
    display.println("WiFi Failed!");
    display.setCursor(0,15);
    display.println("Check credentials");
    display.display();
  }
}

void readSensors() {
  // Read temperature and humidity
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();

  // Read gas sensor
  int gas = analogRead(MQ135_PIN);

  // Validate readings
  if (isnan(temp) || isnan(hum)) {
    Serial.println("DHT sensor read failed!");
    currentData.dataValid = false;
    return;
  }

  currentData.temperature = temp;
  currentData.humidity = hum;
  currentData.gasValue = gas;
  currentData.dataValid = true;

  Serial.printf("Sensors - Temp: %.1f°C, Hum: %.1f%%, Gas: %d\n",
                temp, hum, gas);
}

void sendSensorData() {
  if (!currentData.dataValid) return;

  // Create JSON payload
  StaticJsonDocument<200> jsonDoc;
  jsonDoc["temperature"] = currentData.temperature;
  jsonDoc["humidity"] = currentData.humidity;
  jsonDoc["gas_value"] = currentData.gasValue;

  String jsonString;
  serializeJson(jsonDoc, jsonString);

  // Send HTTP POST request
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    // First test basic connectivity
    Serial.println("Testing server connectivity...");
    http.begin("http://10.180.55.213:5000/iot/api/sensor-data"); // Test GET endpoint first
    int testResponse = http.GET();
    Serial.printf("Test GET response: %d\n", testResponse);
    http.end();

    // Now try POST
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(15000); // 15 second timeout

    Serial.println("Sending data to server...");
    digitalWrite(LED_PIN, HIGH); // LED on during transmission

    int httpResponseCode = http.POST(jsonString);
    Serial.printf("POST Response: %d\n", httpResponseCode);

    if (httpResponseCode > 0) {
      Serial.printf("HTTP Response: %d\n", httpResponseCode);

      String response = http.getString();

      // Parse response
      StaticJsonDocument<1024> responseDoc;
      DeserializationError error = deserializeJson(responseDoc, response);

      if (!error) {
        if (responseDoc.containsKey("prediction")) {
          JsonObject prediction = responseDoc["prediction"];
          if (prediction.containsKey("category")) {
            currentData.airQuality = prediction["category"].as<String>();
            currentData.aqiValue = prediction["aqi_value"];

            Serial.printf("Air Quality: %s (AQI: %.1f)\n",
                         currentData.airQuality.c_str(), currentData.aqiValue);
          }
        }
      } else {
        Serial.println("Failed to parse response");
      }
    } else {
      Serial.printf("HTTP Error: %d\n", httpResponseCode);
    }

    http.end();
    digitalWrite(LED_PIN, LOW); // LED off after transmission
  } else {
    Serial.println("WiFi not connected");
  }
}

void updateDisplay() {
  display.clearDisplay();

  // Header
  display.setTextSize(1);
  display.setCursor(0,0);
  display.println("ESP32 IoT Monitor");

  if (currentData.dataValid) {
    // Sensor readings
    display.setCursor(0,12);
    display.printf("Temp: %.1f C", currentData.temperature);

    display.setCursor(0,22);
    display.printf("Hum:  %.1f %%", currentData.humidity);

    display.setCursor(0,32);
    display.printf("Gas:  %d", currentData.gasValue);

    // Air quality if available
    if (currentData.airQuality != "Unknown") {
      display.setCursor(0,42);
      display.printf("AQI: %.0f", currentData.aqiValue);

      display.setCursor(0,52);
      display.printf("%s", currentData.airQuality.substring(0, 10).c_str());
    }
  } else {
    display.setCursor(0,20);
    display.println("Sensor Error!");
  }

  // WiFi status indicator
  display.setCursor(100,0);
  if (WiFi.status() == WL_CONNECTED) {
    display.println("W");
  } else {
    display.println("X");
  }

  display.display();
}