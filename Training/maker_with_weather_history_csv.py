import pandas as pd
import numpy as np

def parse_climate_dataframe():
    """
    Generates realistic historical climate and pollution data to train the model.
    Matches the fields from the Custom Climate Prediction UI.
    """
    np.random.seed(42)
    n = 1000
    
    # Generate continuous variables
    # Precip Type: 0: Snow, 1: Rain, 2: Sleet, 3: Hail, 4: Freezing Rain, 5: Summer
    precip_type = np.random.choice([0, 1, 2, 3, 4, 5], n)
    temp = np.random.normal(15, 10, n)
    # Apparent temp slightly perturbed from temp
    app_temp = temp + np.random.normal(0, 2, n)
    humidity = np.random.uniform(0.3, 0.9, n)
    wind_speed = np.random.exponential(15, n).clip(0, 100)
    wind_bearing = np.random.randint(0, 360, n)
    visibility = np.random.uniform(5, 16, n)
    pressure = np.random.normal(1015, 10, n)
    
    data = {
        'precip_type': precip_type,
        'temperature': temp,
        'app_temp': app_temp,
        'humidity': humidity,
        'wind_speed': wind_speed,
        'wind_bearing': wind_bearing,
        'visibility': visibility,
        'pressure': pressure
    }
    
    df = pd.DataFrame(data)
    
    # Determine Threat Level logically based on inputs
    # High Threat if Temp > 35 AND Wind Speed > 40
    # Medium Threat if Temp > 30 OR Wind Speed > 25
    # Low Threat otherwise
    
    conditions = [
        (df['temperature'] > 35) & (df['wind_speed'] > 40),
        (df['temperature'] > 30) | (df['wind_speed'] > 25)
    ]
    
    choices = [2, 1] # 2: High, 1: Medium, 0: Low (default)
    df['Threat_Level'] = np.select(conditions, choices, default=0)
    
    labels = {
        "2": {
            "label": "CRITICAL: Extreme Weather Condition",
            "severity": "high"
        },
        "1": {
            "label": "WARNING: Severe Environmental Stress",
            "severity": "medium"
        },
        "0": {
            "label": "NORMAL: Stable Climate Predicted",
            "severity": "low"
        }
    }
    
    return df, labels
