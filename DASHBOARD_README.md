# Modern Climate Monitoring Dashboard

A responsive, real-time dashboard that fetches sensor data from your ESP32 IoT devices.

## Features

- **Real-time Updates**: Automatically refreshes sensor data every 3 seconds
- **Modern UI**: Clean, responsive design with gradient backgrounds and smooth animations
- **Color-coded Status**: Green (good), Yellow (moderate), Red (danger) indicators
- **Live Charts**: Chart.js visualization of sensor readings history
- **Mobile Responsive**: Works on desktop, tablet, and mobile devices
- **Connection Status**: Shows hardware connection status

## Files Created

- `dashboard.html` - Main dashboard HTML file
- `dashboard.css` - Modern responsive styling
- `dashboard.js` - JavaScript for API fetching and real-time updates

## How to Access

1. **Start your Flask server:**
   ```bash
   python app.py
   ```

2. **Open the dashboard in your browser:**
   ```
   http://localhost:5000/dashboard
   ```

## API Integration

The dashboard fetches data from your existing Flask API endpoint:
- **URL**: `http://localhost:5000/iot/api/sensor-data`
- **Method**: GET
- **Response Format**:
  ```json
  {
    "temperature": 22.4,
    "humidity": 38.7,
    "gas_value": 138,
    "last_updated": "2026-03-11T05:23:31.691543"
  }
  ```

## Sensor Status Indicators

### Temperature
- 🟢 **Good**: 15-25°C (Comfortable)
- 🟡 **Moderate**: <15°C or 25-30°C
- 🔴 **Danger**: >30°C (Hot)

### Humidity
- 🟢 **Good**: 30-60% (Comfortable)
- 🟡 **Moderate**: >60% (Humid)
- 🔴 **Danger**: <30% (Dry)

### Air Quality (MQ-135)
- 🟢 **Good**: <100 ppm
- 🟡 **Moderate**: 100-200 ppm
- 🔴 **Danger**: >200 ppm

## Chart Features

- **Dual Y-Axes**: Temperature/Humidity on left, Air Quality on right
- **Real-time Updates**: New data points added every 3 seconds
- **History**: Shows last 20 readings
- **Interactive**: Hover for detailed values

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Responsive design

## Troubleshooting

### Dashboard shows "Waiting for sensor data..."
- ESP32 not connected or not sending data
- Check serial monitor for ESP32 connection issues
- Verify WiFi network connectivity

### Charts not updating
- Check browser console for JavaScript errors
- Ensure Chart.js library loads properly
- Verify API endpoint is accessible

### Mobile display issues
- Clear browser cache
- Check viewport meta tag is present
- Test on different devices

## Customization

### Change Update Frequency
Edit `dashboard.js` line 6:
```javascript
this.updateInterval = 3000; // Change to desired milliseconds
```

### Modify Color Schemes
Edit CSS variables in `dashboard.css`:
```css
:root {
    --primary-color: #667eea;
    --success-color: #28a745;
    --warning-color: #ffc107;
    --danger-color: #dc3545;
}
```

### Add More Sensors
1. Add new sensor card in `dashboard.html`
2. Add data fetching logic in `dashboard.js`
3. Update chart datasets in `setupChart()` method

## Integration with ESP32

The dashboard works with your existing ESP32 setup:
- ESP32 sends data to `/iot/predict_sensor` (POST)
- Dashboard reads data from `/iot/api/sensor-data` (GET)
- No backend modifications needed

## Performance Notes

- API calls every 3 seconds (configurable)
- Chart maintains last 20 data points
- Lightweight CSS animations
- No external dependencies except Chart.js and Font Awesome