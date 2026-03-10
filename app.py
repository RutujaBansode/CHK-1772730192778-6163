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
        city = data.get('city', 'Unknown City')
        
        # Mocking logic based on city hash for consistent but varied results
        base_temp = 15.0 + (hash(city) % 15)
        
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
        
        # 3. Future Climate (Next 7 Days)
        future_temps = [round(present['temperature'] + random.uniform(-3, 3) + i*0.2, 1) for i in range(7)]
        future_rain_prob = [random.randint(0, 100) for _ in range(7)]
        future_conditions = [random.choice(['Sunny', 'Cloudy', 'Rainy', 'Stormy']) for _ in range(7)]
        
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
                'labels': ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
                'temperatures': future_temps,
                'rain_probability': future_rain_prob,
                'conditions': future_conditions
            }
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
