#!/usr/bin/env python3
"""
ESP32 IoT Sensor Simulator
Simulates ESP32 sensor readings and sends them to the Flask server
for testing the IoT integration without actual hardware.
"""

import requests
import json
import time
import random
import sys
from datetime import datetime

# Configuration
SERVER_URL = "http://localhost:5000/iot/predict_sensor"
SEND_INTERVAL = 5  # seconds between readings

class SensorSimulator:
    def __init__(self):
        self.temperature = 25.0
        self.humidity = 60.0
        self.gas_value = 150

    def read_sensors(self):
        """Simulate sensor readings with some realistic variation"""
        # Temperature: 20-35°C with gradual changes
        temp_change = random.uniform(-0.5, 0.5)
        self.temperature = max(20, min(35, self.temperature + temp_change))

        # Humidity: 30-80% with gradual changes
        hum_change = random.uniform(-2, 2)
        self.humidity = max(30, min(80, self.humidity + hum_change))

        # Gas value: 100-300 with some variation
        gas_change = random.randint(-10, 10)
        self.gas_value = max(100, min(300, self.gas_value + gas_change))

        return {
            'temperature': round(self.temperature, 1),
            'humidity': round(self.humidity, 1),
            'gas_value': self.gas_value
        }

    def send_data(self, sensor_data):
        """Send sensor data to Flask server"""
        try:
            headers = {'Content-Type': 'application/json'}
            response = requests.post(SERVER_URL, json=sensor_data, headers=headers, timeout=10)

            print(f"[{datetime.now().strftime('%H:%M:%S')}] Sent data: {sensor_data}")
            print(f"Status Code: {response.status_code}")

            if response.status_code == 200:
                response_data = response.json()
                print("Response:", json.dumps(response_data, indent=2))

                # Extract prediction if available
                if 'prediction' in response_data and 'category' in response_data['prediction']:
                    prediction = response_data['prediction']
                    print(f"Air Quality: {prediction['category']} (AQI: {prediction['aqi_value']})")
            else:
                print(f"Error: {response.text}")

        except requests.exceptions.RequestException as e:
            print(f"Connection error: {e}")
        except json.JSONDecodeError as e:
            print(f"JSON parsing error: {e}")

def main():
    print("ESP32 IoT Sensor Simulator")
    print("=" * 40)
    print(f"Server URL: {SERVER_URL}")
    print(f"Send interval: {SEND_INTERVAL} seconds")
    print("Press Ctrl+C to stop")
    print()

    simulator = SensorSimulator()

    try:
        while True:
            # Read simulated sensor data
            sensor_data = simulator.read_sensors()

            # Send to server
            simulator.send_data(sensor_data)

            print("-" * 40)

            # Wait before next reading
            time.sleep(SEND_INTERVAL)

    except KeyboardInterrupt:
        print("\nSimulator stopped by user")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()