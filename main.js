document.addEventListener('DOMContentLoaded', () => {
    
    const trainBtn = document.getElementById('trainBtn');
    const demoBtn = document.getElementById('demoBtn');
    const predictForm = document.getElementById('predictForm');
    
    // Train Model Logic
    const trainStatus = document.getElementById('trainStatus');
    const trainMessage = document.getElementById('trainMessage');
    const trainMetrics = document.getElementById('trainMetrics');
    
    trainBtn.addEventListener('click', async () => {
        trainBtn.disabled = true;
        trainBtn.textContent = 'Training...';
        trainStatus.classList.remove('hidden');
        trainMetrics.classList.add('hidden');
        trainMessage.textContent = 'Analyzing and training the Random Forest model...';
        
        try {
            const res = await fetch('/api/train', { method: 'POST' });
            const data = await res.json();
            
            if (data.success) {
                document.getElementById('accVal').textContent = data.metrics.accuracy.toFixed(2) + '%';
                document.getElementById('precVal').textContent = data.metrics.precision.toFixed(2) + '%';
                document.getElementById('f1Val').textContent = data.metrics.f1_score.toFixed(2) + '%';
                trainMessage.textContent = 'Training Complete! Model deployed successfully.';
                trainMetrics.classList.remove('hidden');
            } else {
                trainMessage.textContent = 'Training failed: ' + data.error;
            }
        } catch (error) {
            console.error(error);
            trainMessage.textContent = 'Network or server error during training.';
        } finally {
            trainBtn.disabled = false;
            trainBtn.textContent = 'Train Model';
        }
    });

    const toggleAdvanced = document.getElementById('toggleAdvanced');
    const advancedSettings = document.getElementById('advancedSettings');
    const advIcon = document.getElementById('advIcon');
    
    toggleAdvanced.addEventListener('click', () => {
        advancedSettings.classList.toggle('hidden');
        advIcon.textContent = advancedSettings.classList.contains('hidden') ? '▼' : '▲';
    });

    // Chart.js Setup (Old Prediction Chart - Kept for Future Simulator but removed main refs)
    let predictionChart = null;
    const predictCtx = document.getElementById('predictionChart');
    if (predictCtx) {
        predictionChart = new Chart(predictCtx.getContext('2d'), {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // Initialize Climate Risk Map
    const mapContainer = document.getElementById('riskMap');
    if (mapContainer) {
        const map = L.map('riskMap').setView([20, 0], 2);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        // Add mock risk zones
        const riskZones = [
            { coords: [40.7128, -74.0060], radius: 400000, color: '#ef4444', name: 'High Risk (Coastal Flooding) - New York' },
            { coords: [51.5074, -0.1278], radius: 300000, color: '#f59e0b', name: 'Medium Risk (Heatwaves) - London' },
            { coords: [35.6762, 139.6503], radius: 450000, color: '#ef4444', name: 'High Risk (Typhoons) - Tokyo' },
            { coords: [-33.8688, 151.2093], radius: 400000, color: '#10b981', name: 'Low Risk (Stable) - Sydney' },
            { coords: [28.6139, 77.2090], radius: 500000, color: '#ef4444', name: 'High Risk (Pollution/Heat) - New Delhi' },
            { coords: [-23.5505, -46.6333], radius: 350000, color: '#f59e0b', name: 'Medium Risk (Rainfall Variants) - Sao Paulo' },
            { coords: [64.2823, -135.0000], radius: 600000, color: '#10b981', name: 'Low Risk (Stable) - Yukon' }
        ];

        riskZones.forEach(zone => {
            L.circle(zone.coords, {
                color: zone.color,
                fillColor: zone.color,
                fillOpacity: 0.4,
                radius: zone.radius
            }).addTo(map).bindPopup(`<b>${zone.name}</b>`);
        });
    }

    // --- Future Climate Simulator Logic ---

    const simYear = document.getElementById('simYear');
    const simCO2 = document.getElementById('simCO2');
    const simPollution = document.getElementById('simPollution');
    
    const yearLabel = document.getElementById('yearLabel');
    const co2Label = document.getElementById('co2Label');
    const pollutionLabel = document.getElementById('pollutionLabel');
    
    const simBtn = document.getElementById('simBtn');
    const simCompareToggle = document.getElementById('simCompareToggle');
    
    const levels = { 1: 'Low', 2: 'Medium', 3: 'High' };
    const polLevels = { 1: 'Low', 2: 'Moderate', 3: 'Severe' };

    // Update labels on input
    simYear.addEventListener('input', (e) => yearLabel.textContent = e.target.value);
    simCO2.addEventListener('input', (e) => co2Label.textContent = levels[e.target.value]);
    simPollution.addEventListener('input', (e) => pollutionLabel.textContent = polLevels[e.target.value]);

    let simTempChart = null;
    const simCtx = document.getElementById('simTempChart').getContext('2d');

    function renderSimChart(baseTemp, finalTemp) {
        if(simTempChart) simTempChart.destroy();
        
        // Simple 2-point gradient line chart to show the jump
        let gradient = simCtx.createLinearGradient(0, 0, 100, 0);
        gradient.addColorStop(0, '#3b82f6');
        gradient.addColorStop(1, '#ef4444');

        simTempChart = new Chart(simCtx, {
            type: 'line',
            data: {
                labels: ['Now', simYear.value],
                datasets: [{
                    data: [baseTemp, finalTemp],
                    borderColor: gradient,
                    borderWidth: 3,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#ef4444'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: {
                    x: { display: false },
                    y: { display: false, min: baseTemp - 1, max: finalTemp + 1 }
                },
                layout: { padding: 5 }
            }
        });
    }

    simBtn.addEventListener('click', () => {
        // UI Switching
        document.getElementById('simEmptyState').classList.add('hidden');
        const resultContent = document.getElementById('simResultContent');
        resultContent.classList.remove('hidden');
        
        // Re-trigger animation
        resultContent.classList.remove('animate-up');
        void resultContent.offsetWidth; 
        resultContent.classList.add('animate-up');

        // Capture values
        const year = parseInt(simYear.value);
        const co2 = parseInt(simCO2.value);
        const pol = parseInt(simPollution.value);
        const compare = simCompareToggle.checked;

        // Mock Calculations based on years from now (assuming now is 2026)
        const yearsAhead = year - 2026;
        
        // Base multipliers
        const tempMultiplier = (co2 * 0.3) + (pol * 0.1);
        const rawTempInc = (yearsAhead * 0.04 * tempMultiplier).toFixed(1);
        
        const seaLevelRise = Math.floor(yearsAhead * 0.5 * co2); // cm

        // Calculate Water Risk (1 = Low, 2 = Medium, 3 = High)
        let waterRiskScore = Math.floor((co2 + pol + (yearsAhead > 40 ? 2 : 1)) / 2);
        waterRiskScore = Math.max(1, Math.min(3, waterRiskScore));
        
        // --- Populate UI ---
        
        // Temperature
        const tempEl = document.getElementById('simResTemp');
        tempEl.textContent = `+${rawTempInc}°C`;
        tempEl.className = `sim-val ${rawTempInc > 2.0 ? 'danger-text' : 'warning-text'}`;
        
        // Water Risk
        const waterEl = document.getElementById('simResWater');
        const waterDesc = document.getElementById('simWaterDesc');
        if(waterRiskScore === 3) {
            waterEl.textContent = 'High';
            waterEl.className = 'sim-badge badge-danger';
            waterDesc.textContent = 'Severe drought warnings and groundwater depletion expected.';
        } else if(waterRiskScore === 2) {
            waterEl.textContent = 'Medium';
            waterEl.className = 'sim-badge badge-warning';
            waterDesc.textContent = 'Drought frequency expected to increase by 15-30%.';
        } else {
            waterEl.textContent = 'Low';
            waterEl.className = 'sim-badge badge-safe';
            waterDesc.textContent = 'Water cycles remain relatively stable.';
        }

        // Sea Level
        const seaEl = document.getElementById('simResSea');
        const seaBar = document.getElementById('simSeaBar');
        seaEl.innerHTML = `+${seaLevelRise} <span style="font-size:1rem;color:#94a3b8">cm</span>`;
        // Animate bar width (max out at 100cm visual representation)
        setTimeout(() => {
            const widthPct = Math.min(100, Math.max(5, seaLevelRise));
            seaBar.style.width = widthPct + '%';
            if(widthPct > 60) seaBar.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
            else seaBar.style.background = 'linear-gradient(90deg, #3b82f6, #0ea5e9)';
        }, 100);

        // Summary
        document.getElementById('simResSummary').textContent = 
            `By ${year}, a ${levels[co2].toLowerCase()} increase in CO₂ coupled with ${polLevels[pol].toLowerCase()} pollution will likely drive global temperatures up by ${rawTempInc}°C. ` + 
            (seaLevelRise > 20 ? 'Coastal communities face severe flooding risks. ' : 'Coastal impact remains manageable. ') +
            (rawTempInc > 2.5 ? 'Significant shifts in agricultural zones are practically guaranteed.' : 'Minor ecological adaptations will be necessary.');

        // Chart
        renderSimChart(15.0, 15.0 + parseFloat(rawTempInc)); // Assume 15.0 as baseline global temp

        // Compare Toggle Logic
        const compTemp = document.getElementById('compTemp');
        const compSea = document.getElementById('compSea');
        
        if(compare) {
            compTemp.classList.remove('hidden');
            compSea.classList.remove('hidden');
            
            // Present mock comparison (assuming current is baseline 0)
            compTemp.textContent = `(curr: +1.2°C)`;
            compSea.textContent = `(curr: +5 cm)`;
            compTemp.className = 'compare-val worse';
            compSea.className = 'compare-val worse';
        } else {
            compTemp.classList.add('hidden');
            compSea.classList.add('hidden');
        }

    });

    // --- City Climate Analysis Logic ---
    const cityAnalyzeForm = document.getElementById('cityAnalyzeForm');
    const analyzeCityBtn = document.getElementById('analyzeCityBtn');
    const cityAnalysisResults = document.getElementById('cityAnalysisResults');
    const cityInput = document.getElementById('analyze_city_input');
    
    // UI Elements for Loading/Errors
    const cityLoadingSpinner = document.getElementById('cityLoadingSpinner');
    const cityErrorMsg = document.getElementById('cityErrorMsg');
    const emptyState = document.getElementById('emptyState');
    const resultsPanel = document.getElementById('analysisResultsPanel'); // Right Panel container

    let pastClimateChart = null;
    let compareTrendChart = null;

    cityAnalyzeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const city = cityInput.value.trim();
        if(!city) return;

        // Add visual waiting state
        analyzeCityBtn.disabled = true;
        analyzeCityBtn.textContent = 'Analyzing...';
        
        // Hide Old states
        cityAnalysisResults.classList.add('hidden');
        cityErrorMsg.classList.add('hidden');
        emptyState.classList.add('hidden');
        
        // Show Loading
        cityLoadingSpinner.classList.remove('hidden');
        
        try {
            const res = await fetch('/api/analyze_city', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ city })
            });
            const data = await res.json();
            
            cityLoadingSpinner.classList.add('hidden');
            
            if(data.success && !data.error) {
                renderCityAnalysis(data);
                cityAnalysisResults.classList.remove('hidden');
                
                // Add minor animation delay and scroll smoothly into view
                setTimeout(() => {
                    resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 100);
            } else {
                throw new Error(data.error || 'City not found or data unavailable');
            }
        } catch(error) {
            console.error('City Analysis Error:', error);
            cityLoadingSpinner.classList.add('hidden');
            cityErrorMsg.textContent = error.message.includes('not found') ? 'City not found. Please try a different location.' : 'Error: Failed to connect to climate analysis servers.';
            cityErrorMsg.classList.remove('hidden');
            emptyState.classList.remove('hidden');
        } finally {
            analyzeCityBtn.disabled = false;
            analyzeCityBtn.textContent = 'Analyze Climate';
        }
    });

    function renderCityAnalysis(data) {
        // --- 1. Summary Text ---
        const avgTempPast = data.past.temperatures.reduce((a, b) => a + b, 0) / data.past.temperatures.length;
        const avgTempFut = data.future.temperatures.reduce((a, b) => a + b, 0) / data.future.temperatures.length;
        
        const summaryText = document.getElementById('cityTrendSummaryText');
        const pastSummaryText = document.getElementById('pastSummaryText');
        
        let trend = "stable";
        if (avgTempFut > avgTempPast + 1) trend = "warming rapidly";
        else if (avgTempFut > avgTempPast + 0.3) trend = "warming slightly";
        else if (avgTempFut < avgTempPast - 0.3) trend = "cooling";

        summaryText.innerHTML = `Analysis for <strong>${data.city}</strong> indicates a <strong>${trend}</strong> trend. 
        The average past year temperature was ${avgTempPast.toFixed(1)}°C, and the upcoming week forecasts an average of ${avgTempFut.toFixed(1)}°C. 
        Recent humidity and air quality patterns suggest typical seasonal transitions.`;

        pastSummaryText.textContent = `Over the past 12 months, ${data.city} experienced an average temperature of ${avgTempPast.toFixed(1)}°C with notable rainfall peaks.`;

        // --- 2. Past Climate Chart ---
        const ctxPast = document.getElementById('pastClimateChart').getContext('2d');
        if(pastClimateChart) pastClimateChart.destroy();
        pastClimateChart = new Chart(ctxPast, {
            type: 'line',
            data: {
                labels: data.past.labels,
                datasets: [
                    {
                        label: 'Temperature (°C)',
                        data: data.past.temperatures,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 2,
                        yAxisID: 'y',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        type: 'bar',
                        label: 'Rainfall (mm)',
                        data: data.past.rainfall,
                        backgroundColor: 'rgba(56, 189, 248, 0.6)',
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#e2e8f0' } } },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { 
                        type: 'linear', position: 'left', 
                        ticks: { color: '#ef4444' }, grid: { color: 'rgba(255,255,255,0.05)' } 
                    },
                    y1: { 
                        type: 'linear', position: 'right', 
                        ticks: { color: '#38bdf8' }, grid: { drawOnChartArea: false } 
                    }
                }
            }
        });

        // --- 3. Present Climate DOM Update ---
        const condIcons = { 'Sunny':'☀️', 'Partly Cloudy':'⛅', 'Cloudy':'☁️', 'Rainy':'🌧️', 'Clear':'🌙' };
        document.getElementById('curTemp').textContent = `${data.present.temperature}°C`;
        document.getElementById('curHum').textContent = `${data.present.humidity}%`;
        document.getElementById('curWind').textContent = `${data.present.wind_speed} km/h`;
        document.getElementById('curAQI').textContent = data.present.air_quality;
        document.getElementById('curCond').textContent = data.present.condition;
        document.getElementById('curCondIcon').textContent = condIcons[data.present.condition] || '🌡️';

        // --- 4. Future Forecast Cards ---
        const forecastContainer = document.getElementById('forecastCards');
        forecastContainer.innerHTML = '';
        
        const fIcons = { 'Sunny':'☀️', 'Cloudy':'☁️', 'Rainy':'🌧️', 'Stormy':'⛈️' };
        
        for(let i=0; i<7; i++) {
            const riskLevel = data.future.temperatures[i] > 30 ? 'high' : (data.future.temperatures[i] > 25 ? 'med' : 'low');
            const riskText = riskLevel === 'high' ? 'High Risk' : (riskLevel === 'med' ? 'Elevated' : 'Normal');
            
            const card = document.createElement('div');
            card.className = 'forecast-day-card animate-up';
            card.style.animationDelay = `${i * 0.05}s`;
            
            card.innerHTML = `
                <div class="fd-day">${data.future.labels[i]}</div>
                <div class="fd-icon">${fIcons[data.future.conditions[i]] || '☀️'}</div>
                <div class="fd-temp">${data.future.temperatures[i]}°C</div>
                <div class="fd-rain">💧 ${data.future.rain_probability[i]}%</div>
                <div class="fd-risk risk-${riskLevel}">${riskText}</div>
            `;
            forecastContainer.appendChild(card);
        }

        // --- 5. Compare Past Vs Future Chart ---
        const ctxCompare = document.getElementById('compareTrendChart').getContext('2d');
        if(compareTrendChart) compareTrendChart.destroy();
        
        // Take last 7 days of past (mocked) and next 7 days of future to align lengths for a visual comparison
        const recentPast = data.past.temperatures.slice(-7);
        
        compareTrendChart = new Chart(ctxCompare, {
            type: 'line',
            data: {
                labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
                datasets: [
                    {
                        label: 'Recent Past Average (°C)',
                        data: recentPast,
                        borderColor: '#94a3b8',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        tension: 0.4
                    },
                    {
                        label: 'Future Prediction (°C)',
                        data: data.future.temperatures,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#e2e8f0' } } },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#f8fafc' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    }

});
