import requests

for path in ['/iot/predict_sensor','/iot/api/sensor-data']:
    try:
        r = requests.get('http://localhost:5000' + path)
        print(path, r.status_code, r.text[:200])
    except Exception as e:
        print('error', path, e)
