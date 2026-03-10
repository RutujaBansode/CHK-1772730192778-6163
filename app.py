from flask import Flask, render_template, request, jsonify
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from climate_model import train_impact_model, predict_scenario

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/train', methods=['POST'])
def train():
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

import random

@app.route('/api/analyze_city', methods=['POST'])
def analyze_city():
    try:
        data = request.json
        city = data.get('city', '').strip()
        # Optional realtime inputs from frontend
        latitude = data.get('latitude', None)
        longitude = data.get('longitude', None)
        client_dt = data.get('datetime', None)
        
        if not city or len(city) < 2:
            return jsonify({
                'success': False,
                'error': 'Invalid city name provided.'
            }), 400
            
        # Mocking logic based on city hash for consistent but varied results
        # Use location (if provided) to slightly vary base temperature to be more realistic
        base_temp = 15.0 + (hash(city) % 15)
        try:
            if latitude is not None and longitude is not None:
                # simple lat-based adjustment: warmer nearer equator
                lat = float(latitude)
                base_temp += max(-6, min(6, (30 - abs(lat)) * 0.05))
        except Exception:
            pass
        
        # 1. Past Climate (Last 12 Months)
        past_temps = [round(base_temp + random.uniform(-5, 5) + (i % 6)*0.5, 1) for i in range(12)]
        past_rainfall = [round(random.uniform(20, 150), 1) for _ in range(12)]
        
        # 2. Present Climate (Current Conditions)
        present = {
            'temperature': round(base_temp + random.uniform(-2, 2), 1),
            'humidity': random.randint(40, 85),
            'wind_speed': round(random.uniform(5, 25), 1),
            'air_quality': random.choice(['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy']),
            'condition': random.choice(['Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy', 'Clear'])
        }
        
        # 3. Future Climate (Next 5 Years) - produce yearly projections
        import datetime as _dt
        try:
            if client_dt:
                now = _dt.datetime.fromisoformat(client_dt.replace('Z', '+00:00'))
            else:
                now = _dt.datetime.utcnow()
        except Exception:
            now = _dt.datetime.utcnow()

        future_temps = []
        future_rain_prob = []
        future_conditions = []
        future_labels = []
        # Create five-year projection
        for y in range(1, 6):
            year_label = str(now.year + y)
            # Temperature trend: small increasing trend per year
            temp = round(present['temperature'] + random.uniform(-0.6, 1.2) + y * 0.25, 1)
            rain = min(100, max(0, int(random.gauss(30 + y*2, 18))))
            cond = random.choice(['Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy', 'Stormy'])

            future_labels.append(year_label)
            future_temps.append(temp)
            future_rain_prob.append(rain)
            future_conditions.append(cond)
        
        return jsonify({
            'success': True,
            'city': city,
            'past': {
                'labels': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                'temperatures': past_temps,
                'rainfall': past_rainfall
            },
            'present': present,
            'future': {
                'labels': future_labels,
                'temperatures': future_temps,
                'rain_probability': future_rain_prob,
                'conditions': future_conditions
            },
            'meta': {
                'queried_at': now.isoformat(),
                'latitude': latitude,
                'longitude': longitude
            }
        })
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    # Add a custom banner/logger
    print("\n" + "="*50)
    print(" CLIMATE IMPACT PLATFORM AI STARTED")
    print("="*50 + "\n")
    app.run(debug=True, port=5000, use_reloader=False)
