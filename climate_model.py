import os
import sys
import pickle
import json
import pandas as pd
import numpy as np

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, f1_score
from sklearn.utils.validation import check_is_fitted

import Training.maker_with_weather_history_csv as maker

base_dir = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(base_dir, 'Training', 'local_data')
model_folder = os.path.join(path, 'model')
model_path = os.path.join(model_folder, 'impact_model.pkl')
labels_path = os.path.join(path, 'impact_labels.json')

os.makedirs(model_folder, exist_ok=True)

clf = RandomForestClassifier(n_estimators=100)

def train_impact_model():
    """Trains the global warming threat prediction model"""
    df, labels = maker.parse_climate_dataframe()
    
    with open(labels_path, "w") as file:
        json.dump(labels, file, indent=4)
        
    X = df.drop('Threat_Level', axis=1)
    y = df['Threat_Level']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
        
    clf.fit(X_train, y_train)
    pickle.dump(clf, open(model_path, 'wb'))
    
    y_pred = clf.predict(X_test)
    
    metrics = {
        'accuracy': accuracy_score(y_test, y_pred) * 100,
        'precision': precision_score(y_test, y_pred, average='macro', zero_division=0) * 100,
        'f1_score': f1_score(y_test, y_pred, average='macro', zero_division=0) * 100
    }
    return metrics

def predict_scenario(data_dict):
    """
    Predicts threat scenario
    """
    try:
        with open(labels_path, "r") as file:
            labels = json.load(file)
    except FileNotFoundError:
        raise Exception("Model not trained yet.")
        
    try:
        check_is_fitted(clf)
        model = clf
    except:
        if not os.path.exists(model_path):
            raise Exception("Model file missing.")
        model = pickle.load(open(model_path, 'rb'))

    # Map Precip Type string to integer
    precip_map = {
        'snow': 0, 'rain': 1, 'sleet': 2, 'hail': 3, 'freezing rain': 4, 'summer': 5
    }
    precip_val = precip_map.get(str(data_dict.get('precip_type', 'Snow')).lower(), 0)

    df = pd.DataFrame([{
        'precip_type': precip_val,
        'temperature': float(data_dict.get('temperature', 13.84)),
        'app_temp': float(data_dict.get('app_temp', 13.84)),
        'humidity': float(data_dict.get('humidity', 0.84)),
        'wind_speed': float(data_dict.get('wind_speed', 0.0)),
        'wind_bearing': float(data_dict.get('wind_bearing', 0.0)),
        'visibility': float(data_dict.get('visibility', 15.82)),
        'pressure': float(data_dict.get('pressure', 1014.5))
    }])
    
    prediction = model.predict(df)[0]
    
    return labels.get(str(prediction), {
        "label": "Unknown",
        "severity": "low"
    })
