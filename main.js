document.addEventListener('DOMContentLoaded', () => {
    console.log('Climate Dashboard initialized.');

    // --- State & Global Config ---
    let pastClimateChart = null;
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
                // Try to get client location (best-effort). Timeout/fallback handled.
                const getLocation = () => new Promise((resolve) => {
                    if (!navigator.geolocation) return resolve(null);
                    let resolved = false;
                    const timer = setTimeout(() => { if (!resolved) { resolved = true; resolve(null); } }, 5000);
                    navigator.geolocation.getCurrentPosition((pos) => {
                        if (resolved) return;
                        resolved = true; clearTimeout(timer);
                        resolve(pos.coords);
                    }, (err) => { if (resolved) return; resolved = true; clearTimeout(timer); resolve(null); }, { maximumAge: 60000, timeout: 5000 });
                });

                const coords = await getLocation();
                const payload = { city, datetime: new Date().toISOString() };
                if (coords) { payload.latitude = coords.latitude; payload.longitude = coords.longitude; }

                const res = await fetch('/api/analyze_city', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
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

        // B. Past Climate Chart (Fixing Layout & Legend)
        const ctxPast = document.getElementById('pastClimateChart');
        if(ctxPast) {
            if(pastClimateChart) pastClimateChart.destroy();
            pastClimateChart = new Chart(ctxPast.getContext('2d'), {
                type: 'line',
                data: {
                    labels: data.past.labels,
                    datasets: [
                        {
                            label: 'Avg Temperature (°C)',
                            data: data.past.temperatures,
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            fill: true,
                            tension: 0.4, // Smooth curve
                            borderWidth: 3,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        },
                        {
                            label: 'Rainfall (mm)',
                            data: data.past.rainfall.map(r => r / 5), // Scale for visibility
                            type: 'bar',
                            backgroundColor: 'rgba(56, 189, 248, 0.2)',
                            borderColor: 'rgba(56, 189, 248, 0.5)',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top', align: 'end', labels: { boxWidth: 12, padding: 20 } },
                        tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: 12, cornerRadius: 8 }
                    },
                    scales: {
                        y: { 
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { padding: 10 }
                        },
                        x: { 
                            grid: { display: false },
                            ticks: { padding: 10 }
                        }
                    },
                    layout: { padding: { left: 10, right: 10, top: 0, bottom: 0 } }
                }
            });
        }

        // C. Present Weather Cards
        const ids = { 
            'curTemp': `${data.present.temperature}°C`, 
            'curHum': `${data.present.humidity}%`, 
            'curWind': `${data.present.wind_speed} km/h`, 
            'curAQI': data.present.air_quality, 
            'curCond': data.present.condition 
        };
        for (const [id, val] of Object.entries(ids)) {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        }

        // D. Future 7-Day Forecast (Dynamic Rendering)
        const forecastContainer = document.getElementById('forecastCards');
        if (forecastContainer) {
            forecastContainer.innerHTML = ''; // Clear
            const labels = (data.future.labels && data.future.labels.length > 0) ? data.future.labels : [];
            const n = labels.length || 5; // default to 5 if server didn't send labels

            // Build safe arrays
            const temps = (data.future.temperatures && data.future.temperatures.length >= n) ? data.future.temperatures : Array(n).fill('--');
            const rains = (data.future.rain_probability && data.future.rain_probability.length >= n) ? data.future.rain_probability : Array(n).fill(0);
            const conds = (data.future.conditions && data.future.conditions.length >= n) ? data.future.conditions : Array(n).fill('Unknown');

            for (let i = 0; i < n; i++) {
                const label = labels[i] || `Year ${i+1}`;
                const temp = temps[i] != null ? temps[i] : '--';
                const cond = conds[i] || 'Unknown';
                const rain = rains[i] != null ? rains[i] : 0;

                const icon = cond === 'Sunny' ? '☀️' : cond === 'Rainy' ? '🌧️' : cond === 'Stormy' ? '🌩️' : '☁️';
                const riskClass = rain > 60 ? 'risk-high' : rain > 30 ? 'risk-med' : 'risk-low';
                const riskLabel = rain > 60 ? 'High' : rain > 30 ? 'Med' : 'Low';

                const card = document.createElement('div');
                card.className = 'forecast-day-card';
                card.innerHTML = `
                    <div class="fd-day">${label}</div>
                    <div class="fd-icon">${icon}</div>
                    <div class="fd-temp">${temp}°C</div>
                    <div class="fd-rain">💧 ${rain}%</div>
                    <div class="fd-risk ${riskClass}">${riskLabel} Risk</div>
                `;
                forecastContainer.appendChild(card);
            }
        }

        // E. Past vs Future Compare Chart
        const ctxCompare = document.getElementById('compareTrendChart');
        if(ctxCompare) {
            if(compareTrendChart) compareTrendChart.destroy();
            
            // Combine slices for comparison using server-provided future labels
            const futureLabels = (data.future.labels && data.future.labels.length > 0) ? data.future.labels : ['Year 1','Year 2','Year 3','Year 4','Year 5'];
            const n = futureLabels.length;
            let pastLastN = data.past.temperatures.slice(-n);
            if (pastLastN.length < n) {
                // pad with first value if not enough past data
                const padVal = data.past.temperatures.length ? data.past.temperatures[0] : 0;
                while (pastLastN.length < n) pastLastN.unshift(padVal);
            }
            const futureN = (data.future.temperatures && data.future.temperatures.length >= n) ? data.future.temperatures : Array(n).fill('--');

            compareTrendChart = new Chart(ctxCompare.getContext('2d'), {
                type: 'line',
                data: {
                    labels: futureLabels,
                    datasets: [
                        {
                            label: 'Past Comparison',
                            data: pastLastN,
                            borderColor: 'rgba(148, 163, 184, 0.5)',
                            borderDash: [5, 5],
                            tension: 0.4
                        },
                        {
                            label: 'Predicted Future',
                            data: futureN,
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
            
            let tempInc = (year - 2026) * 0.04 * ((co2 * 0.4) + (pol * 0.15));
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
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
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
            { coords: [28.6139, 77.2090], radius: 500000, color: '#ef4444', name: 'New Delhi ⚠️', risk: 'Critical Risk: Air Quality', level: 'Critical' }
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
});
