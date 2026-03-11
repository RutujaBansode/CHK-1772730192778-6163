# ESP32 IoT Sensor Integration

This directory contains code for integrating ESP32 microcontrollers with your Climate Impact Platform's IoT sensor monitoring system.

## Files

- `esp32_sensor_monitor.ino` - Basic ESP32 sketch for sensor monitoring
- `esp32_sensor_monitor_oled.ino` - Advanced ESP32 sketch with OLED display
- `esp32_simulator.py` - Python simulator for testing without hardware

## Hardware Requirements

### Basic Setup
- ESP32 development board (ESP32-WROOM-32, ESP32-S3, etc.)
- DHT11 or DHT22 temperature/humidity sensor
- MQ-135 gas sensor (or similar air quality sensor)
- Jumper wires and breadboard

### Advanced Setup (with OLED)
- All basic components plus:
- 0.96" SSD1306 OLED display (I2C)
- Additional jumper wires

## Wiring Diagrams

### Basic Wiring
```
ESP32          DHT11         MQ-135
3.3V  -------- VCC  -------- VCC
GND   -------- GND  -------- GND
GPIO 4 -------- DATA
GPIO 34                       AO (Analog Out)
```

### OLED Display Wiring
```
ESP32          SSD1306 OLED
3.3V  -------- VCC
GND   -------- GND
GPIO 21 ------- SDA
GPIO 22 ------- SCL
```

## Arduino IDE Setup

1. **Install ESP32 Board Support**
   - Open Arduino IDE
   - Go to File > Preferences
   - Add this URL to Additional Boards Manager URLs:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Go to Tools > Board > Boards Manager
   - Search for "esp32" and install "esp32 by Espressif Systems"

2. **Install Required Libraries**
   - DHT sensor library: Sketch > Include Library > Manage Libraries > Search "DHT" > Install "DHT sensor library by Adafruit"
   - ArduinoJson: Search "ArduinoJson" > Install latest version
   - For OLED version: Install "Adafruit SSD1306" and "Adafruit GFX Library"

3. **Select Board and Port**
   - Tools > Board > ESP32 Dev Module (or your specific ESP32 board)
   - Tools > Port > Select your ESP32 COM port

## Configuration

### WiFi Setup
Edit these lines in the ESP32 sketch:
```cpp
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
```

### Server Configuration
Update the server URL:
```cpp
const char* serverUrl = "http://YOUR_SERVER_IP:5000/iot/predict_sensor";
```
Replace `YOUR_SERVER_IP` with your computer's IP address (run `ipconfig` on Windows or `ifconfig` on Linux/Mac).

## Sensor Calibration

### MQ-135 Gas Sensor
The MQ-135 sensor needs preheating (20-30 seconds) and calibration. The analog readings will vary based on:
- Supply voltage stability
- Environmental conditions
- Sensor age

For accurate air quality measurements, you may need to calibrate the sensor readings against known air quality standards.

### DHT Sensor
- DHT11: ±2°C temperature, ±5% humidity
- DHT22: ±0.5°C temperature, ±2-5% humidity

## Testing the Integration

### Method 1: Python Simulator
Run the simulator to test without hardware:
```bash
python esp32_simulator.py
```

### Method 2: Hardware Testing
1. Upload the sketch to your ESP32
2. Open Serial Monitor (115200 baud)
3. Monitor the output for connection status and data transmission
4. Check your Flask server logs for incoming requests

## Troubleshooting

### WiFi Connection Issues
- Check SSID and password
- Ensure ESP32 is within WiFi range
- Try different WiFi channels (2.4GHz vs 5GHz)

### Sensor Reading Problems
- Verify wiring connections
- Check sensor power supply (3.3V for ESP32)
- Test sensors individually with example sketches

### Server Connection Issues
- Verify server IP address and port
- Check firewall settings
- Ensure Flask app is running
- Test with Python simulator first

### OLED Display Issues
- Check I2C address (usually 0x3C or 0x3D)
- Verify SDA/SCL pin connections
- Check OLED power supply

## Data Format

The ESP32 sends JSON data to `/iot/predict_sensor`:

```json
{
  "temperature": 25.5,
  "humidity": 60.2,
  "gas_value": 150
}
```

Server response includes prediction:

```json
{
  "status": "success",
  "sensor_data": {
    "temperature": 25.5,
    "humidity": 60.2,
    "gas_value": 150,
    "last_updated": "2024-01-15T10:30:45.123456"
  },
  "prediction": {
    "aqi_value": 45.2,
    "category": "Good",
    "description": "Air quality is good with AQI 45.2"
  },
  "timestamp": "2024-01-15T10:30:45.123456"
}
```

## Power Management

For battery-powered applications:
- Use deep sleep mode between readings
- Reduce transmission frequency
- Disable OLED when not needed
- Use ESP32's power-saving features

## Security Considerations

- Use HTTPS for production deployments
- Implement authentication tokens
- Validate sensor data on server side
- Use secure WiFi networks
- Consider data encryption for sensitive readings

## Advanced Features

### Multiple Sensors
Add more sensors by extending the JSON payload:
```cpp
jsonDoc["pm25"] = pm25Value;
jsonDoc["co2"] = co2Value;
```

### Error Handling
Implement retry logic for failed transmissions:
```cpp
int retryCount = 0;
while (retryCount < 3 && httpResponseCode != 200) {
  delay(1000);
  httpResponseCode = http.POST(jsonString);
  retryCount++;
}
```

### Over-the-Air Updates
Use ArduinoOTA for firmware updates without USB connection.

## Support

If you encounter issues:
1. Check serial output for error messages
2. Verify all connections and power supplies
3. Test with the Python simulator first
4. Check Flask server logs for incoming requests
5. Ensure all required libraries are installed