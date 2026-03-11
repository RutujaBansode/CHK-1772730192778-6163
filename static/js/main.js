// Climate Dashboard JavaScript
console.log('main.js loaded successfully');

document.addEventListener('DOMContentLoaded', () => {
    console.log('Climate Dashboard initialized.');
    console.log('DOM fully loaded, initializing components...');

    // --- State & Global Config ---
    let compareTrendChart = null;
    let simTempChart = null;
    let map = null; // Leaflet map instance for risk map

    // Charts Global Default
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Inter', sans-serif";

    // --- DOM Elements ---
    const cityAnalyzeForm = document.getElementById('cityAnalyzeForm');
    const cityInput = document.getElementById('analyze_city_input');
    const analyzeCityBtn = document.getElementById('analyzeCityBtn');
    const cityAnalysisResults = document.getElementById('cityAnalysisResults');
    const cityLoadingSpinner = document.getElementById('cityLoadingSpinner');
    const cityErrorMsg = document.getElementById('cityErrorMsg');
    const emptyState = document.getElementById('emptyState');

    // Simulator Elements
    const simYear = document.getElementById('simYear');
    const simCO2 = document.getElementById('simCO2');
    const simPollution = document.getElementById('simPollution');
    const yearLabel = document.getElementById('yearLabel');
    const co2Label = document.getElementById('co2Label');
    const pollutionLabel = document.getElementById('pollutionLabel');
    const simBtn = document.getElementById('simBtn');

    // --- 1. City Analysis & Prediction Core ---

    if (cityAnalyzeForm) {
        cityAnalyzeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const city = cityInput.value.trim();
            if(!city) return;

            // UI Feedback
            analyzeCityBtn.disabled = true;
            analyzeCityBtn.textContent = 'Analyzing...';
            cityAnalysisResults.classList.add('hidden');
            cityErrorMsg.classList.add('hidden');
            if(emptyState) emptyState.classList.add('hidden');
            cityLoadingSpinner.classList.remove('hidden');
            
            try {
                const res = await fetch('/api/analyze_city', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ city })
                });
                const data = await res.json();
                
                if(data.success) {
                    renderDashboard(data);
                    cityAnalysisResults.classList.remove('hidden');
                    cityAnalysisResults.classList.add('animate-up');
                } else {
                    throw new Error(data.error || 'City analysis failed.');
                }
            } catch(error) {
                console.error(error);
                cityErrorMsg.textContent = error.message;
                cityErrorMsg.classList.remove('hidden');
            } finally {
                cityLoadingSpinner.classList.add('hidden');
                analyzeCityBtn.disabled = false;
                analyzeCityBtn.textContent = 'Run Climate Prediction';
            }
        });
    }

    function renderDashboard(data) {
        // A. Summary Text
        const summaryText = document.getElementById('cityTrendSummaryText');
        if (summaryText) {
            summaryText.innerHTML = `Detailed climate analysis for <strong>${data.city}</strong>.
                Past year showed a median temperature of <strong>${(data.past.temperatures.reduce((a,b)=>a+b,0)/12).toFixed(1)}°C</strong>
                with seasonal rainfall variations. Future prediction suggests a stable trend with minor fluctuations.`;
        }

        // B. City Name Display
        const cityNameEl = document.getElementById('displayCityName');
        if (cityNameEl) {
            cityNameEl.textContent = `🌍 ${data.city}`;
        }

        // C. Present Weather Cards
        const ids = {
            'curTemp': `${data.present.temperature}°C`,
            'curHum': `${data.present.humidity}%`,
            'curWind': `${data.present.wind_speed} km/h`,
            'curPressure': `${data.present.pressure} hPa`,
            'curAQI': data.present.air_quality,
            'curCond': data.present.condition
        }
        for (const [id, val] of Object.entries(ids)) {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        }

        // D. Update Weather Icon
        const condIconEl = document.getElementById('curCondIcon');
        if (condIconEl) {
            const condition = data.present.condition.toLowerCase();
            let icon = '☁️'; // default

            if (condition.includes('clear') || condition.includes('sunny')) icon = '☀️';
            else if (condition.includes('rain')) icon = '🌧️';
            else if (condition.includes('cloud')) icon = '☁️';
            else if (condition.includes('storm') || condition.includes('thunder')) icon = '⛈️';
            else if (condition.includes('snow')) icon = '❄️';
            else if (condition.includes('mist') || condition.includes('fog')) icon = '🌫️';

            condIconEl.textContent = icon;
        }

        // E. Future 7-Day Forecast (Dynamic Rendering)
        const forecastContainer = document.getElementById('forecastCards');
        if (forecastContainer) {
            forecastContainer.innerHTML = ''; // Clear
            // ensure exactly 7 entries, fallback to generic days if input length mismatches
            const labels = (data.future.labels && data.future.labels.length === 7)
                ? data.future.labels
                : ['Day 1','Day 2','Day 3','Day 4','Day 5','Day 6','Day 7'];
            for (let i = 0; i < 7; i++) {
                const dayLabel = labels[i] || `Day ${i+1}`;
                const temp = (data.future.temperatures && data.future.temperatures[i] != null)
                    ? data.future.temperatures[i]
                    : '--';
                const cond = (data.future.conditions && data.future.conditions[i]) || 'Unknown';
                const rain = (data.future.rain_probability && data.future.rain_probability[i] != null)
                    ? data.future.rain_probability[i]
                    : 0;

                const icon = cond === 'Sunny' ? '☀️' : cond === 'Rainy' ? '🌧️' : cond === 'Stormy' ? '🌩️' : '☁️';
                const riskClass = rain > 60 ? 'risk-high' : rain > 30 ? 'risk-med' : 'risk-low';
                const riskLabel = rain > 60 ? 'High' : rain > 30 ? 'Med' : 'Low';

                const card = document.createElement('div');
                card.className = 'forecast-day-card';
                card.innerHTML = `
                    <div class="fd-day">${dayLabel}</div>
                    <div class="fd-icon">${icon}</div>
                    <div class="fd-temp">${temp}°C</div>
                    <div class="fd-rain">💧 ${rain}%</div>
                    <div class="fd-risk ${riskClass}">${riskLabel} Risk</div>
                `;
                forecastContainer.appendChild(card);
            }
        }

        // D. Compare Trend Chart
        const ctxCompare = document.getElementById('compareTrendChart');
        if(ctxCompare) {
            if(compareTrendChart) compareTrendChart.destroy();
            
            // Combine slices for comparison
            const pastLast7 = data.past.temperatures.slice(-7);
            const future7 = data.future.temperatures;

            compareTrendChart = new Chart(ctxCompare.getContext('2d'), {
                type: 'line',
                data: {
                    labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
                    datasets: [
                        {
                            label: 'Past 7 Days Avg',
                            data: pastLast7,
                            borderColor: 'rgba(148, 163, 184, 0.5)',
                            borderDash: [5, 5],
                            tension: 0.4
                        },
                        {
                            label: 'Predicted Future',
                            data: future7,
                            borderColor: '#4ade80',
                            borderWidth: 3,
                            pointBackgroundColor: '#4ade80',
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: {
                        y: { grid: { color: 'rgba(255,255,255,0.05)' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }
    }

    // --- 2. Future Climate Simulator Logic ---

    const levels = { 1: 'Low', 2: 'Medium', 3: 'High' };
    const polLevels = { 1: 'Low', 2: 'Moderate', 3: 'Severe' };

    if (simYear) simYear.addEventListener('input', (e) => { if(yearLabel) yearLabel.textContent = e.target.value; });
    if (simCO2) simCO2.addEventListener('input', (e) => { if(co2Label) co2Label.textContent = levels[e.target.value]; });
    if (simPollution) simPollution.addEventListener('input', (e) => { if(pollutionLabel) pollutionLabel.textContent = polLevels[e.target.value]; });

    function renderSimChart(baseTemp, finalTemp, year) {
        const simTempCtx = document.getElementById('simTempChart');
        if (!simTempCtx) return;
        if (simTempChart) simTempChart.destroy();
        
        const ctx = simTempCtx.getContext('2d');
        let gradient = ctx.createLinearGradient(0, 0, 100, 0);
        gradient.addColorStop(0, '#3b82f6');
        gradient.addColorStop(1, '#ef4444');

        simTempChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['2026', year],
                datasets: [{ data: [baseTemp, finalTemp], borderColor: gradient, borderWidth: 3, tension: 0.4, pointRadius: 5 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { display: false }, y: { display: false } }
            }
        });
    }

    if (simBtn) {
        simBtn.addEventListener('click', () => {
            const simEmptyState = document.getElementById('simEmptyState');
            const resultContent = document.getElementById('simResultContent');
            if (simEmptyState) simEmptyState.classList.add('hidden');
            if (resultContent) {
                resultContent.classList.remove('hidden');
                resultContent.classList.add('animate-up');
            }

            const year = parseInt(simYear.value);
            const co2 = parseInt(simCO2.value);
            const pol = parseInt(simPollution.value);
            
            let tempInc = (year - 2026) * 0.08 * ((co2 * 0.4) + (pol * 0.15));
            const rawTempInc = tempInc.toFixed(1);
            const seaLevelRise = Math.round(tempInc * 18);

            const resTemp = document.getElementById('simResTemp');
            const resWater = document.getElementById('simResWater');
            const waterDesc = document.getElementById('simWaterDesc');
            const seaEl = document.getElementById('simResSea');
            const simSeaBar = document.getElementById('simSeaBar');
            const resSum = document.getElementById('simResSummary');

            if (resTemp) resTemp.textContent = `+${rawTempInc}°C`;
            if (resWater && waterDesc) {
                if(tempInc > 1.5) { resWater.textContent = 'High'; resWater.className = 'sim-badge badge-danger'; waterDesc.textContent = 'Severe drought risk.'; }
                else if(tempInc > 0.8) { resWater.textContent = 'Medium'; resWater.className = 'sim-badge badge-warning'; waterDesc.textContent = 'Moderate water stress.'; }
                else { resWater.textContent = 'Low'; resWater.className = 'sim-badge badge-safe'; waterDesc.textContent = 'Stable supplies.'; }
            }
            if (seaEl) seaEl.textContent = `+${seaLevelRise} cm`;
            if (simSeaBar) simSeaBar.style.width = `${Math.min(100, seaLevelRise)}%`;
            if (resSum) resSum.textContent = `By ${year}, predicted CO2 levels (${levels[co2]}) and pollution will lead to a ${rawTempInc}°C temperature increase globally.`;

            renderSimChart(15.0, 15.0 + parseFloat(rawTempInc), year);
        });
    }

    // --- 3. Interactive Help & Tooltips ---
    const helpBtn = document.getElementById('helpBtn');
    const helpPanel = document.getElementById('helpPanel');
    const helpCloseBtn = document.getElementById('helpCloseBtn');
    
    if (helpBtn && helpPanel) {
        helpBtn.addEventListener('click', () => {
            helpPanel.classList.toggle('hidden');
        });
    }
    
    if (helpCloseBtn && helpPanel) {
        helpCloseBtn.addEventListener('click', () => {
            helpPanel.classList.add('hidden');
        });
    }
    
    // Close help panel when clicking outside
    document.addEventListener('click', (e) => {
        if (helpPanel && helpBtn && !helpPanel.contains(e.target) && !helpBtn.contains(e.target)) {
            helpPanel.classList.add('hidden');
        }
    });

    // --- 4. Navbar interactivity & section navigation ---
    const navLinks = document.querySelectorAll('.nav-links a');
    const hardwareMonitorBtn = document.getElementById('hardwareMonitorBtn');

    // Special handling for Hardware Monitor button
    if (hardwareMonitorBtn) {
        hardwareMonitorBtn.addEventListener('click', (e) => {
            e.preventDefault();

            // Open hardware monitor in a new popup window
            const popupWidth = 1200;
            const popupHeight = 800;
            const left = (window.innerWidth - popupWidth) / 2;
            const top = (window.innerHeight - popupHeight) / 2;

            const popup = window.open(
                '/hardware',
                'HardwareMonitor',
                `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`
            );

            if (popup) {
                popup.focus();
            } else {
                alert('Please allow popups for this site to use Hardware Monitor.');
            }
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // Skip hardware monitor button (handled separately)
            if (link.id === 'hardwareMonitorBtn') return;

            e.preventDefault();
            navLinks.forEach(a => a.classList.remove('active'));
            link.classList.add('active');

            const targetId = link.getAttribute('href').slice(1);
            const targetEl = document.getElementById(targetId);
            if (!targetEl) return;

            // if the manual link, toggle visibility
            if (targetId === 'userManual') {
                targetEl.classList.toggle('hidden');
                if (!targetEl.classList.contains('hidden')) {
                    targetEl.scrollIntoView({ behavior: 'smooth' });
                }
            } else {
                // hide manual if open
                const manual = document.getElementById('userManual');
                if (manual && !manual.classList.contains('hidden')) {
                    manual.classList.add('hidden');
                }
                targetEl.scrollIntoView({ behavior: 'smooth' });
                // if showing historical section, invalidate map size so tiles render correctly
                if (targetId === 'historicalSection' && map) {
                    setTimeout(() => map.invalidateSize(), 200);
                }
            }
        });
    });

    // Initialize sparkles and date/time updates
    initSparkles();
    startDateTimeUpdates();
});

    // Initialize Map with custom style
    const mapContainer = document.getElementById('riskMap');
    if (mapContainer) {
        map = L.map('riskMap').setView([20, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        const riskZones = [
            { coords: [40.7128, -74.0060], radius: 400000, color: '#ef4444', name: 'New York 🌊', risk: 'Critical Risk: Flooding', level: 'Critical' },
            { coords: [51.5074, -0.1278], radius: 300000, color: '#f59e0b', name: 'London 🌡️', risk: 'High Risk: Heatwaves', level: 'High' },
            { coords: [35.6762, 139.6503], radius: 450000, color: '#ef4444', name: 'Tokyo 🌪️', risk: 'Critical Risk: Typhoons', level: 'Critical' },
            { coords: [28.6139, 77.2090], radius: 500000, color: '#ef4444', name: 'New Delhi ⚠️', risk: 'Critical Risk: Air Quality', level: 'Critical' },
            { coords: [-33.8688, 151.2093], radius: 380000, color: '#ef4444', name: 'Sydney 🔥', risk: 'Critical Risk: Wildfires & Droughts', level: 'Critical' },
            { coords: [48.8566, 2.3522], radius: 350000, color: '#f59e0b', name: 'Paris 🌧️', risk: 'High Risk: Extreme Rainfall', level: 'High' },
            { coords: [1.3521, 103.8198], radius: 320000, color: '#f59e0b', name: 'Singapore 🌊', risk: 'High Risk: Coastal Flooding', level: 'High' },
            { coords: [-23.5505, -46.6333], radius: 420000, color: '#ef4444', name: 'São Paulo 🌧️', risk: 'Critical Risk: Landslides & Flooding', level: 'Critical' },
            { coords: [52.5200, 13.4050], radius: 300000, color: '#f59e0b', name: 'Berlin 🌡️', risk: 'High Risk: Temperature Extremes', level: 'High' },
            { coords: [37.7749, -122.4194], radius: 350000, color: '#f59e0b', name: 'San Francisco 🔥', risk: 'High Risk: Wildfires', level: 'High' },
            { coords: [19.4326, -99.1332], radius: 380000, color: '#f59e0b', name: 'Mexico City ⚠️', risk: 'High Risk: Water Scarcity', level: 'High' },
            { coords: [31.2304, 30.0505], radius: 400000, color: '#ef4444', name: 'Cairo 🏜️', risk: 'Critical Risk: Desertification', level: 'Critical' },
            { coords: [39.9042, 116.4074], radius: 450000, color: '#ef4444', name: 'Beijing 🌫️', risk: 'Critical Risk: Air Pollution', level: 'Critical' },
            { coords: [13.0827, 80.2707], radius: 380000, color: '#f59e0b', name: 'Chennai 🌊', risk: 'High Risk: Tropical Cyclones', level: 'High' },
            { coords: [55.7558, 37.6173], radius: 400000, color: '#f59e0b', name: 'Moscow 🌡️', risk: 'High Risk: Permafrost Thawing', level: 'High' }
        ];

        riskZones.forEach(zone => {
            const circle = L.circle(zone.coords, { 
                color: zone.color, 
                radius: zone.radius, 
                fillOpacity: 0.3,
                weight: 2
            }).addTo(map);
            
            // Create tooltip content with risk level
            const tooltipContent = `<strong>${zone.name}</strong><br>${zone.risk}<br>Risk Level: <strong>${zone.level}</strong>`;
            
            // Bind popup to circle
            circle.bindPopup(tooltipContent);
            
            // Add hover effects
            circle.on('mouseover', function() {
                this.setStyle({
                    fillOpacity: 0.6,
                    weight: 3
                });
                this.openPopup();
            });
            
            circle.on('mouseout', function() {
                this.setStyle({
                    fillOpacity: 0.3,
                    weight: 2
                });
                this.closePopup();
            });
            
            // Optional: Add click to keep popup open
            circle.on('click', function() {
                this.togglePopup();
            });
        });
    }

// --- Sparkle Animation Logic ---
function createSparkle() {
    const sparkleContainer = document.querySelector('.sparkle-container');
    if (!sparkleContainer) return;

    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle';

    // Random horizontal position
    sparkle.style.left = Math.random() * 100 + '%';

    // Random size variation
    const size = Math.random() * 3 + 2; // 2-5px
    sparkle.style.width = size + 'px';
    sparkle.style.height = size + 'px';

    // Random animation delay
    sparkle.style.animationDelay = Math.random() * 3 + 's';

    sparkleContainer.appendChild(sparkle);

    // Remove sparkle after animation completes
    setTimeout(() => {
        if (sparkle.parentNode) {
            sparkle.parentNode.removeChild(sparkle);
        }
    }, 6000); // 6 seconds to cover longest animation
}

// --- Date and Time Update Logic ---
let dateTimeInterval;

function startDateTimeUpdates() {
    // Initial update
    updateDateTime();

    // Update every second
    dateTimeInterval = setInterval(updateDateTime, 1000);
}

function updateDateTime() {
    const now = new Date();

    // Update dashboard date and time if elements exist
    const dashboardDateEl = document.getElementById('dashboardDate');
    const dashboardTimeEl = document.getElementById('dashboardTime');

    if (dashboardDateEl && dashboardTimeEl) {
        // Format date: 11 March 2026
        const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
        const formattedDate = now.toLocaleDateString('en-US', dateOptions);
        dashboardDateEl.textContent = formattedDate;

        // Format time: 10:45:30 AM
        const timeOptions = {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        };
        const formattedTime = now.toLocaleTimeString('en-US', timeOptions);
        dashboardTimeEl.textContent = formattedTime;
    }
}

function initSparkles() {
    const sparkleContainer = document.querySelector('.sparkle-container');
    if (!sparkleContainer) return;

    // Create initial sparkles
    for (let i = 0; i < 15; i++) {
        setTimeout(createSparkle, i * 200);
    }

    // Continuously create new sparkles
    setInterval(createSparkle, 800);
}
