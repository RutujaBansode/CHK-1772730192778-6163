// Climate Monitoring Dashboard JavaScript
// Fetches real-time sensor data from Flask backend API

class ClimateDashboard {
    constructor() {
        this.apiUrl = 'http://localhost:5000/iot/api/sensor-data';
        this.updateInterval = 3000; // 3 seconds
        this.maxDataPoints = 20; // Keep last 20 readings for chart

        // Data storage for charts
        this.temperatureHistory = [];
        this.humidityHistory = [];
        this.airQualityHistory = [];
        this.timeLabels = [];

        this.init();
    }

    init() {
        this.setupChart();
        this.startDataFetching();
        console.log('Climate Dashboard initialized');
    }

    async fetchSensorData() {
        try {
            // Add cache-busting parameter to prevent browser caching
            const cacheBustUrl = `${this.apiUrl}?t=${Date.now()}`;

            console.log('Fetching data from:', cacheBustUrl);

            const response = await fetch(cacheBustUrl, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log(`[${new Date().toLocaleTimeString()}] Fetched data:`, data);
            return data;
        } catch (error) {
            console.error('Error fetching sensor data:', error);
            this.updateConnectionStatus(false);
            return null;
        }
    }

    updateSensorDisplay(data) {
        if (!data) {
            this.showWaitingState();
            return;
        }

        console.log(`[${new Date().toLocaleTimeString()}] Updating sensor display with data:`, data);

        // Update temperature
        if (data.temperature !== null && data.temperature !== undefined) {
            const tempValue = data.temperature.toFixed(1);
            const tempElement = document.getElementById('temperature-value');
            tempElement.textContent = tempValue;
            // Force DOM update
            tempElement.style.display = 'inline';
            tempElement.offsetHeight; // Trigger reflow
            this.updateTemperatureStatus(data.temperature);
            this.addToHistory('temperature', data.temperature);
            console.log(`[${new Date().toLocaleTimeString()}] Temperature updated to:`, tempValue);
        }

        // Update humidity
        if (data.humidity !== null && data.humidity !== undefined) {
            const humidityValue = data.humidity.toFixed(1);
            const humidityElement = document.getElementById('humidity-value');
            humidityElement.textContent = humidityValue;
            // Force DOM update
            humidityElement.style.display = 'inline';
            humidityElement.offsetHeight; // Trigger reflow
            this.updateHumidityStatus(data.humidity);
            this.addToHistory('humidity', data.humidity);
            console.log(`[${new Date().toLocaleTimeString()}] Humidity updated to:`, humidityValue);
        }

        // Update air quality
        if (data.gas_value !== null && data.gas_value !== undefined) {
            const airQualityElement = document.getElementById('air-quality-value');
            airQualityElement.textContent = data.gas_value;
            // Force DOM update
            airQualityElement.style.display = 'inline';
            airQualityElement.offsetHeight; // Trigger reflow
            this.updateAirQualityStatus(data.gas_value);
            this.addToHistory('airQuality', data.gas_value);
            console.log(`[${new Date().toLocaleTimeString()}] Air quality updated to:`, data.gas_value);
        }

        // Update last update time
        if (data.last_updated) {
            const updateTime = new Date(data.last_updated).toLocaleTimeString();
            document.getElementById('last-update-time').textContent = updateTime;
        } else {
            document.getElementById('last-update-time').textContent = new Date().toLocaleTimeString();
        }

        this.updateConnectionStatus(true);
        this.updateChart();
    }

    updateTemperatureStatus(temperature) {
        const statusElement = document.getElementById('temperature-status');
        let statusText, statusClass;

        if (temperature < 15) {
            statusText = 'Cold';
            statusClass = 'status-moderate';
        } else if (temperature >= 15 && temperature <= 25) {
            statusText = 'Comfortable';
            statusClass = 'status-good';
        } else if (temperature > 25 && temperature <= 30) {
            statusText = 'Warm';
            statusClass = 'status-moderate';
        } else {
            statusText = 'Hot';
            statusClass = 'status-danger';
        }

        statusElement.textContent = statusText;
        statusElement.className = `sensor-status ${statusClass}`;
    }

    updateHumidityStatus(humidity) {
        const statusElement = document.getElementById('humidity-status');
        let statusText, statusClass;

        if (humidity < 30) {
            statusText = 'Dry';
            statusClass = 'status-danger';
        } else if (humidity >= 30 && humidity <= 60) {
            statusText = 'Comfortable';
            statusClass = 'status-good';
        } else {
            statusText = 'Humid';
            statusClass = 'status-moderate';
        }

        statusElement.textContent = statusText;
        statusElement.className = `sensor-status ${statusClass}`;
    }

    updateAirQualityStatus(gasValue) {
        const statusElement = document.getElementById('air-quality-status');
        let statusText, statusClass;

        // MQ-135 gas sensor thresholds (approximate)
        if (gasValue < 100) {
            statusText = 'Good';
            statusClass = 'status-good';
        } else if (gasValue >= 100 && gasValue <= 200) {
            statusText = 'Moderate';
            statusClass = 'status-moderate';
        } else if (gasValue > 200 && gasValue <= 400) {
            statusText = 'Poor';
            statusClass = 'status-danger';
        } else {
            statusText = 'Very Poor';
            statusClass = 'status-danger';
        }

        statusElement.textContent = statusText;
        statusElement.className = `sensor-status ${statusClass}`;
    }

    showWaitingState() {
        const elements = ['temperature-value', 'humidity-value', 'air-quality-value'];
        elements.forEach(id => {
            document.getElementById(id).textContent = '--';
        });

        const statusElements = ['temperature-status', 'humidity-status', 'air-quality-status'];
        statusElements.forEach(id => {
            const element = document.getElementById(id);
            element.textContent = 'Waiting for data...';
            element.className = 'sensor-status status-loading';
        });

        document.getElementById('last-update-time').textContent = 'Never';
        this.updateConnectionStatus(false);
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connection-status');
        if (connected) {
            statusElement.innerHTML = '<i class="fas fa-circle"></i> Hardware Status: Connected';
            statusElement.className = 'status-connected';
        } else {
            statusElement.innerHTML = '<i class="fas fa-circle"></i> Hardware Status: Waiting for Data';
            statusElement.className = 'status-connected status-waiting';
        }
    }

    addToHistory(type, value) {
        const now = new Date();
        const timeString = now.toLocaleTimeString();

        // Add new data point
        switch(type) {
            case 'temperature':
                this.temperatureHistory.push(value);
                break;
            case 'humidity':
                this.humidityHistory.push(value);
                break;
            case 'airQuality':
                this.airQualityHistory.push(value);
                break;
        }

        this.timeLabels.push(timeString);

        // Keep only last N data points
        if (this.temperatureHistory.length > this.maxDataPoints) {
            this.temperatureHistory.shift();
            this.humidityHistory.shift();
            this.airQualityHistory.shift();
            this.timeLabels.shift();
        }
    }

    setupChart() {
        const ctx = document.getElementById('sensorChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.timeLabels,
                datasets: [{
                    label: 'Temperature (°C)',
                    data: this.temperatureHistory,
                    borderColor: '#ff6b6b',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y'
                }, {
                    label: 'Humidity (%)',
                    data: this.humidityHistory,
                    borderColor: '#4ecdc4',
                    backgroundColor: 'rgba(78, 205, 196, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y'
                }, {
                    label: 'Air Quality (ppm)',
                    data: this.airQualityHistory,
                    borderColor: '#52c234',
                    backgroundColor: 'rgba(82, 194, 52, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Real-time Sensor Readings'
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Temperature (°C) / Humidity (%)'
                        },
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Air Quality (ppm)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                }
            }
        });
    }

    updateChart() {
        this.chart.data.labels = this.timeLabels;
        this.chart.data.datasets[0].data = this.temperatureHistory;
        this.chart.data.datasets[1].data = this.humidityHistory;
        this.chart.data.datasets[2].data = this.airQualityHistory;
        this.chart.update();
    }

    startDataFetching() {
        // Initial fetch
        this.fetchSensorData().then(data => {
            this.updateSensorDisplay(data);
        });

        // Set up interval for continuous updates
        setInterval(async () => {
            const data = await this.fetchSensorData();
            this.updateSensorDisplay(data);
        }, this.updateInterval);
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new ClimateDashboard();
});