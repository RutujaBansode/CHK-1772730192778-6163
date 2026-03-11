from flask import Flask, render_template, request, jsonify, render_template_string, send_from_directory
import json
import pickle
import pandas as pd
import sqlite3
import logging
import os
import sys
import requests
import random
from datetime import datetime, timedelta

# Initialize Flask app
app = Flask(__name__)
app.secret_key = 'your_secret_key_here'  # Change this to a secure random key in production

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import climate model functionality (with error handling for Python 3.13 compatibility)
try:
    from climate_model import train_impact_model, predict_scenario
    CLIMATE_MODEL_AVAILABLE = True
    logger.info("Climate model imported successfully")
except ImportError as e:
    logger.warning(f"Climate model import failed (likely due to scikit-learn/Python 3.13 compatibility): {e}")
    logger.warning("Climate analysis features will be disabled")
    CLIMATE_MODEL_AVAILABLE = False
    # Define dummy functions for when climate model is not available
    def train_impact_model():
        return {"error": "Climate model not available"}
    def predict_scenario(data):
        return {"label": "Unknown", "severity": "unknown", "error": "Climate model not available"}

# ============================================================================
# WEATHER API CONFIGURATION (Climate Analysis)
# ============================================================================
OPENWEATHER_API_KEY = "openWeather API key"
OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5"
API_TIMEOUT = 10

# Simple in-memory cache for weather data
weather_cache = {}

def get_cached_weather(city):
    """Get weather from cache if available and not expired."""
    if city in weather_cache:
        cached_data, timestamp = weather_cache[city]
        if datetime.now() - timestamp < timedelta(minutes=10):
            print(f"✓ Returning cached weather for {city}")
            return cached_data
        else:
            del weather_cache[city]
    return None

def cache_weather(city, data):
    """Store weather data in cache."""
    weather_cache[city] = (data, datetime.now())

def get_air_quality_label(aqi_data):
    """Convert AQI index to human-readable label."""
    if not aqi_data or 'list' not in aqi_data or len(aqi_data['list']) == 0:
        return 'Moderate'

    aqi = aqi_data['list'][0]['main']['aqi']
    labels = {
        1: 'Good',
        2: 'Moderate',
        3: 'Unhealthy for Sensitive Groups',
        4: 'Unhealthy',
        5: 'Very Unhealthy'
    }
    return labels.get(aqi, 'Moderate')

def generate_historical_temps(current_temp):
    """Generate realistic historical temperature data."""
    # Create seasonal variation around current temperature
    seasonal_temps = []
    for month in range(1, 13):
        # Seasonal offset (lower in winter, higher in summer)
        seasonal_offset = 8 * ((month - 7) / 6)
        temp = current_temp + seasonal_offset + random.uniform(-2, 2)
        seasonal_temps.append(round(temp, 1))
    return seasonal_temps

def get_mock_weather(city):
    """
    Fallback: Generate mock weather data.
    Used when API is unavailable or not configured.
    """
    print(f"📋 Using mock data for {city}")

    base_temp = 15.0 + (hash(city) % 15)

    present = {
        'temperature': round(base_temp + random.uniform(-2, 2), 1),
        'humidity': random.randint(40, 85),
        'wind_speed': round(random.uniform(5, 25), 1),
        'pressure': random.randint(1000, 1030),
        'air_quality': random.choice(['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy']),
        'condition': random.choice(['Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy', 'Clear']),
        'description': 'Mock data',
        'feels_like': round(base_temp + random.uniform(-1, 1), 1)
    }

    future_temps = [round(present['temperature'] + random.uniform(-3, 3) + i*0.2, 1) for i in range(7)]
    future_rain_prob = [random.randint(0, 100) for _ in range(7)]
    future_conditions = [random.choice(['Sunny', 'Cloudy', 'Rainy', 'Stormy']) for _ in range(7)]

    past_temps = [round(base_temp + random.uniform(-5, 5) + (i % 6)*0.5, 1) for i in range(12)]
    past_rainfall = [round(random.uniform(20, 150), 1) for _ in range(12)]

    return {
        'success': True,
        'city': city,
        'present': present,
        'future': {
            'labels': ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
            'temperatures': future_temps,
            'rain_probability': future_rain_prob,
            'conditions': future_conditions
        },
        'past': {
            'labels': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            'temperatures': past_temps,
            'rainfall': past_rainfall
        },
        'source': 'Mock Data (API not configured)'
    }

def get_weather(city):
    """
    Main function to fetch weather data.
    Tries cache first, then fetches from API.
    Falls back to mock data if API fails.
    """
    # Try cache
    cached = get_cached_weather(city)
    if cached:
        return cached

    try:
        print(f"📡 Fetching weather from OpenWeatherMap for {city}...")

        # Get current weather
        current_url = f"{OPENWEATHER_BASE_URL}/weather"
        current_params = {
            'q': city,
            'appid': OPENWEATHER_API_KEY,
            'units': 'metric'
        }

        current_response = requests.get(current_url, params=current_params, timeout=API_TIMEOUT)
        current_response.raise_for_status()
        current_data = current_response.json()

        # Get 5-day forecast
        forecast_url = f"{OPENWEATHER_BASE_URL}/forecast"
        forecast_params = {
            'q': city,
            'appid': OPENWEATHER_API_KEY,
            'units': 'metric'
        }

        forecast_response = requests.get(forecast_url, params=forecast_params, timeout=API_TIMEOUT)
        forecast_response.raise_for_status()
        forecast_data = forecast_response.json()

        # Get air quality
        try:
            coord = current_data['coord']
            aqi_url = f"{OPENWEATHER_BASE_URL}/air_pollution"
            aqi_params = {
                'lat': coord['lat'],
                'lon': coord['lon'],
                'appid': OPENWEATHER_API_KEY
            }
            aqi_response = requests.get(aqi_url, params=aqi_params, timeout=API_TIMEOUT)
            aqi_data = aqi_response.json() if aqi_response.ok else None
        except Exception as e:
            print(f"⚠ AQI fetch failed: {e}")
            aqi_data = None

        # Parse current weather
        present = {
            'temperature': round(current_data['main']['temp'], 1),
            'humidity': current_data['main']['humidity'],
            'wind_speed': round(current_data['wind']['speed'], 1),
            'pressure': current_data['main'].get('pressure', 0),
            'air_quality': get_air_quality_label(aqi_data),
            'condition': current_data['weather'][0]['main'],
            'description': current_data['weather'][0]['description'],
            'feels_like': round(current_data['main'].get('feels_like', current_data['main']['temp']), 1)
        }

        # Parse forecast (next 5 days)
        future_data = {'temperatures': [], 'rain_probability': [], 'conditions': [], 'labels': []}

        # Get one forecast per day (every 24 hours, usually 8 forecasts per day)
        seen_days = set()
        day_count = 0

        for forecast in forecast_data['list'][:40]:  # First 5 days
            dt = datetime.fromtimestamp(forecast['dt'])
            day_str = dt.strftime('%b %d')

            if day_str not in seen_days and day_count < 7:
                seen_days.add(day_str)
                future_data['labels'].append(f"Day {day_count + 1}")
                future_data['temperatures'].append(round(forecast['main']['temp'], 1))
                future_data['rain_probability'].append(int(forecast.get('pop', 0) * 100))
                future_data['conditions'].append(forecast['weather'][0]['main'])
                day_count += 1

        # Generate historical data (simulated based on current conditions)
        past_data = {
            'labels': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            'temperatures': generate_historical_temps(present['temperature']),
            'rainfall': [round(random.uniform(20, 150), 1) for _ in range(12)]
        }

        result = {
            'success': True,
            'city': city,
            'present': present,
            'future': future_data,
            'past': past_data,
            'source': 'OpenWeatherMap'
        }

        print(f"✓ Weather data retrieved for {city}")
        print(f"✓ Present weather: {present}")
        # Cache the result
        cache_weather(city, result)
        return result

    except Exception as e:
        print(f"❌ API Error: {str(e)}")
        print(f"Type: {type(e).__name__}")
        print(f"⚠ Falling back to mock data for {city}...")
        # Fall back to mock data
        return get_mock_weather(city)

# ============================================================================
# IOT SENSOR FUNCTIONALITY
# ============================================================================

# Global dictionary to store latest IoT sensor data
sensor_data = {
    'temperature': None,
    'humidity': None,
    'gas_value': None,
    'last_updated': None
}

# Load the IoT ML model (assuming it's saved as 'iot_model.pkl' in the same directory)
IOT_MODEL_PATH = 'iot_model.pkl'
iot_model = None
try:
    with open(IOT_MODEL_PATH, 'rb') as f:
        iot_model = pickle.load(f)
    logger.info("IoT ML model loaded successfully")
except FileNotFoundError:
    logger.warning(f"IoT model file '{IOT_MODEL_PATH}' not found. IoT predictions will not work until model is provided.")
except Exception as e:
    logger.error(f"Error loading IoT model: {e}")

# IoT Database setup (optional SQLite for storing sensor readings)
IOT_DB_PATH = 'iot_sensor_data.db'

def init_iot_db():
    """Initialize the IoT SQLite database."""
    conn = sqlite3.connect(IOT_DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS readings
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  temperature REAL,
                  humidity REAL,
                  gas_value REAL,
                  prediction REAL,
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    conn.commit()
    conn.close()

init_iot_db()

def save_iot_to_db(temperature, humidity, gas_value, prediction):
    """Save IoT sensor reading and prediction to database."""
    conn = sqlite3.connect(IOT_DB_PATH)
    c = conn.cursor()
    c.execute("INSERT INTO readings (temperature, humidity, gas_value, prediction) VALUES (?, ?, ?, ?)",
              (temperature, humidity, gas_value, prediction))
    conn.commit()
    conn.close()

def map_to_aqi_category(raw_prediction):
    """
    Map raw IoT model prediction to AQI category and normalize within reasonable bounds.
    This is a utility function that can be adapted based on your IoT model's output range.
    Assuming raw_prediction is a continuous value, we normalize it and map to categories.
    """
    # Normalize prediction to 0-500 range (typical AQI range)
    # Adjust these bounds based on your IoT model's expected output
    min_pred = 0  # Minimum expected prediction
    max_pred = 100  # Maximum expected prediction
    normalized = max(0, min(500, (raw_prediction - min_pred) / (max_pred - min_pred) * 500))

    # Map to AQI categories
    if normalized <= 50:
        category = "Good"
    elif normalized <= 100:
        category = "Moderate"
    elif normalized <= 150:
        category = "Unhealthy for Sensitive Groups"
    elif normalized <= 200:
        category = "Unhealthy"
    elif normalized <= 300:
        category = "Very Unhealthy"
    else:
        category = "Hazardous"

    return {
        'aqi_value': round(normalized, 2),
        'category': category,
        'description': f"Air quality is {category.lower()} with AQI {round(normalized, 2)}"
    }

# ============================================================================
# CLIMATE ANALYSIS ROUTES
# ============================================================================

@app.route('/')
def index():
    """Main climate analysis dashboard."""
    return render_template('index.html')

@app.route('/api/train', methods=['POST'])
def train():
    """Train the climate impact model."""
    if not CLIMATE_MODEL_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Climate model not available (scikit-learn compatibility issue with Python 3.13)'
        }), 503

    try:
        metrics = train_impact_model()
        return jsonify({
            'success': True,
            'metrics': metrics
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/predict', methods=['POST'])
def predict():
    """Predict climate impact scenario."""
    if not CLIMATE_MODEL_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Climate model not available (scikit-learn compatibility issue with Python 3.13)'
        }), 503

    try:
        data = request.json
        # The frontend provides: temperature, humidity, pollution, pressure
        prediction_result = predict_scenario(data)

        return jsonify({
            'success': True,
            'prediction': prediction_result
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/analyze_city', methods=['POST'])
def analyze_city():
    """Analyze weather data for a city."""
    try:
        data = request.json
        city = data.get('city', '').strip()

        if not city or len(city) < 2:
            return jsonify({
                'success': False,
                'error': 'Invalid city name provided.'
            }), 400

        # ===== REAL-TIME WEATHER DATA =====
        # Fetch real-time weather from API (or mock if API unavailable)
        weather_data = get_weather(city)

        if weather_data.get('success'):
            return jsonify(weather_data)
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to fetch weather data'
            }), 500

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ Error in analyze_city: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ============================================================================
# HARDWARE MONITORING ROUTES (Legacy)
# ============================================================================

# Global variable to store latest hardware sensor data (for backward compatibility)
latest_sensor_data = {
    'temperature': 30.0,
    'humidity': 60.0,
    'air_quality': 150.0,
    'timestamp': None
}

@app.route('/hardware')
def hardware_monitor():
    """Serve the hardware monitoring page."""
    return render_template('hardware.html')

@app.route('/api/hardware-data', methods=['GET', 'POST'])
def hardware_data():
    """
    API endpoint for hardware sensor data (legacy endpoint).
    This maintains backward compatibility with existing hardware integrations.
    """
    try:
        if request.method == 'POST':
            # Receive data from hardware
            data = request.json
            if not data:
                return jsonify({'success': False, 'error': 'No data provided'}), 400

            # Update global sensor data
            if 'temperature' in data:
                latest_sensor_data['temperature'] = float(data['temperature'])
            if 'humidity' in data:
                latest_sensor_data['humidity'] = float(data['humidity'])
            if 'air_quality' in data:
                latest_sensor_data['air_quality'] = float(data['air_quality'])

            latest_sensor_data['timestamp'] = datetime.now()

            print(f"📡 Received hardware sensor data: {latest_sensor_data}")

            return jsonify({
                'success': True,
                'message': 'Hardware sensor data received',
                'data': latest_sensor_data
            })

        else:  # GET request
            # Return latest sensor data
            if latest_sensor_data['timestamp']:
                return jsonify({
                    'success': True,
                    'sensors': {
                        'temperature': latest_sensor_data['temperature'],
                        'humidity': latest_sensor_data['humidity'],
                        'air_quality': latest_sensor_data['air_quality']
                    },
                    'timestamp': latest_sensor_data['timestamp'].isoformat(),
                    'message': 'Latest hardware sensor data retrieved'
                })
            else:
                # Return default/mock data if no real data received yet
                return jsonify({
                    'success': True,
                    'sensors': {
                        'temperature': 25.0,
                        'humidity': 60.0,
                        'air_quality': 150.0
                    },
                    'timestamp': datetime.now().isoformat(),
                    'message': 'Using default hardware sensor data (no ESP32 data received yet)'
                })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/iot/api/sensor-data', methods=['GET'])
def get_iot_sensor_data():
    """IoT API endpoint to get current sensor data as JSON."""
    return jsonify(sensor_data)

# ============================================================================
# IOT SENSOR ROUTES (New)
# ============================================================================

@app.route('/iot/predict_sensor', methods=['GET', 'POST'])
def iot_predict_sensor():
    """IoT sensor prediction endpoint."""
    if request.method == 'POST':
        try:
            # Parse JSON data from IoT hardware
            data = request.get_json()
            if not data:
                return jsonify({'error': 'No JSON data provided'}), 400

            # Extract sensor values (adapt field names as needed)
            temperature = data.get('temperature')
            humidity = data.get('humidity')
            gas_value = data.get('gas_value')

            if temperature is None or humidity is None or gas_value is None:
                return jsonify({'error': 'Missing required sensor data: temperature, humidity, gas_value'}), 400

            # Update global IoT sensor_data
            sensor_data['temperature'] = temperature
            sensor_data['humidity'] = humidity
            sensor_data['gas_value'] = gas_value
            sensor_data['last_updated'] = datetime.now().isoformat()

            logger.info(f"Received IoT sensor data: {sensor_data}")

            # Prepare data for IoT ML model (create pandas DataFrame with features)
            # Adapt this based on your IoT model's expected input features
            features = pd.DataFrame({
                'temperature': [temperature],
                'humidity': [humidity],
                'gas_value': [gas_value]
                # Add more features as needed for your IoT model
            })

            # Make prediction if IoT model is loaded
            prediction_result = None
            if iot_model:
                try:
                    raw_prediction = iot_model.predict(features)[0]
                    prediction_result = map_to_aqi_category(raw_prediction)
                    logger.info(f"IoT Prediction: {prediction_result}")
                except Exception as e:
                    logger.error(f"IoT Prediction error: {e}")
                    prediction_result = {'error': 'IoT prediction failed'}
            else:
                prediction_result = {'error': 'IoT model not loaded'}

            # Save to IoT database (optional)
            if prediction_result and 'aqi_value' in prediction_result:
                save_iot_to_db(temperature, humidity, gas_value, prediction_result['aqi_value'])

            # Return JSON response
            response = {
                'status': 'success',
                'sensor_data': sensor_data,
                'prediction': prediction_result,
                'timestamp': sensor_data['last_updated']
            }
            return jsonify(response)

        except Exception as e:
            logger.error(f"Error processing IoT POST request: {e}")
            return jsonify({'error': str(e)}), 500

    else:  # GET request
        # Render a simple IoT monitoring template
        # Since this is a single file, we'll use render_template_string
        html_template = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>IoT Sensor Monitoring Dashboard</title>
            <meta http-equiv="refresh" content="30">  <!-- Auto-refresh every 30 seconds -->
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
                .sensor-data { background: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .data-item { margin: 10px 0; padding: 8px; border-left: 4px solid #007bff; }
                .nav-links { margin-bottom: 20px; }
                .nav-links a { margin-right: 15px; color: #007bff; text-decoration: none; }
            </style>
        </head>
        <body>
            <div class="nav-links">
                <a href="/">← Back to Climate Dashboard</a>
                <a href="/hardware">Hardware Monitor</a>
            </div>
            <h1>IoT Sensor Monitoring Dashboard</h1>
            <div class="sensor-data">
                <h2>Latest IoT Sensor Readings</h2>
                <div class="data-item"><strong>Temperature:</strong> {{ sensor_data.temperature or 'N/A' }} °C</div>
                <div class="data-item"><strong>Humidity:</strong> {{ sensor_data.humidity or 'N/A' }} %</div>
                <div class="data-item"><strong>Gas Value:</strong> {{ sensor_data.gas_value or 'N/A' }}</div>
                <div class="data-item"><strong>Last Updated:</strong> {{ sensor_data.last_updated or 'Never' }}</div>
            </div>
            <p><a href="/iot/api/sensor-data">View JSON API</a></p>
        </body>
        </html>
        """
        return render_template_string(html_template, sensor_data=sensor_data)

@app.route('/dashboard')
def modern_dashboard():
    """Serve the modern responsive dashboard."""
    return send_from_directory('.', 'dashboard.html')

@app.route('/debug')
def debug_test():
    """Serve the debug test page."""
    return send_from_directory('.', 'debug_test.html')

if __name__ == '__main__':
    # Add a custom banner/logger
    print("\n" + "="*60)
    print(" 🌍 CLIMATE IMPACT PLATFORM AI + IoT SENSOR MONITORING")
    print("="*60 + "\n")
    print("Available endpoints:")
    print("  Climate Analysis: http://localhost:5000/")
    print("  IoT Sensors: http://localhost:5000/iot/predict_sensor")
    print("  Hardware Monitor: http://localhost:5000/hardware")
    print("  Modern Dashboard: http://localhost:5000/dashboard")
    print("\n" + "="*60 + "\n")
    app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=False)
