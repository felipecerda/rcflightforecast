        const locationInput = document.getElementById('locationInput');
        const windThresholdInput = document.getElementById('windThreshold');
        const windowDurationSelect = document.getElementById('windowDuration');
        const freeTimeStartInput = document.getElementById('freeTimeStart');
        const freeTimeEndInput = document.getElementById('freeTimeEnd');
        const checkWeatherBtn = document.getElementById('checkWeatherBtn');
        const messageBox = document.getElementById('messageBox');
        const loadingSpinner = document.getElementById('loadingSpinner');
        const resultsSection = document.getElementById('resultsSection');
        const resultsList = document.getElementById('resultsList');
        const daySelector = document.getElementById('daySelector');

        let allSuitableWindows = []; // Store all suitable windows for filtering

        // Helper function to format a Date object into YYYY-MM-DD (local time)
        function formatLocalDateToYYYYMMDD(date) {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        // Function to display messages (success, error, info)
        function showMessage(message, type = 'info') {
            messageBox.textContent = message;
            messageBox.className = 'message-box'; // Reset classes
            if (type === 'error') {
                messageBox.classList.add('error');
            }
            messageBox.style.display = 'block';
        }

        // Function to hide messages
        function hideMessage() {
            messageBox.style.display = 'none';
        }

        // Function to show/hide loading spinner
        function showLoading() {
            loadingSpinner.style.display = 'block';
            checkWeatherBtn.disabled = true;
            checkWeatherBtn.textContent = 'Checking...';
        }

        function hideLoading() {
            loadingSpinner.style.display = 'none';
            checkWeatherBtn.disabled = false;
            checkWeatherBtn.textContent = 'Check Weather for Flying';
        }

        // Function to clear previous results and day selector
        function clearResults() {
            resultsList.innerHTML = '';
            resultsSection.classList.add('hidden');
            daySelector.innerHTML = ''; // Clear day selector
            daySelector.classList.add('hidden'); // Hide day selector
            allSuitableWindows = []; // Clear stored windows
        }

        // Function to render results for a specific day
        function renderResultsForDay(selectedDateYYYYMMDD) { // Changed parameter name
            resultsList.innerHTML = '';
            const windowsForSelectedDay = allSuitableWindows.filter(window => {
                // Convert the UTC startISO string to a local Date object, then format to YYYY-MM-DD
                const windowLocalDay = formatLocalDateToYYYYMMDD(new Date(window.startISO));
                return windowLocalDay === selectedDateYYYYMMDD;
            });

            if (windowsForSelectedDay.length > 0) {
                resultsSection.classList.remove('hidden');
                windowsForSelectedDay.forEach(window => {
                    const listItem = document.createElement('li');
                    // Display times in local timezone for user readability
                    listItem.innerHTML = `
                        <strong>${new Date(window.startISO).toLocaleString()}</strong> to <strong>${new Date(window.endISO).toLocaleString()}</strong>
                        <br> (Avg Wind: ${window.avgWind} km/h, Max Wind: ${window.maxWind} km/h)
                    `;
                    resultsList.appendChild(listItem);
                });
            } else {
                resultsSection.classList.add('hidden'); // Hide results section if no windows
                // No message displayed here as per user request
            }
        }

        // Function to generate and display day buttons
        function generateDayButtons(suitableWindowsByDate) {
            daySelector.innerHTML = '';
            daySelector.classList.remove('hidden');

            const today = new Date(); // Get current local date
            today.setHours(0, 0, 0, 0); // Normalize to start of local day

            for (let i = 0; i < 7; i++) { // Generate buttons for next 7 days
                const date = new Date(today);
                date.setDate(today.getDate() + i); // Calculate date based on local 'today'

                // Use YYYY-MM-DD format for data-date attribute
                const dateYYYYMMDD = formatLocalDateToYYYYMMDD(date);
                const dayName = i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
                const displayDate = date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });

                const button = document.createElement('div');
                button.classList.add('day-button');
                button.textContent = `${dayName} ${displayDate}`;
                button.dataset.date = dateYYYYMMDD; // Store the YYYY-MM-DD string for filtering

                if (suitableWindowsByDate[dateYYYYMMDD] && suitableWindowsByDate[dateYYYYMMDD].length > 0) {
                    button.classList.add('has-windows');
                } else {
                    button.classList.add('no-windows');
                }

                button.addEventListener('click', () => {
                    // Remove 'selected' from all buttons
                    document.querySelectorAll('.day-button').forEach(btn => btn.classList.remove('selected'));
                    // Add 'selected' to the clicked button
                    button.classList.add('selected');
                    // Render results for the selected day using the YYYY-MM-DD string
                    renderResultsForDay(dateYYYYMMDD);
                });
                daySelector.appendChild(button);
            }
        }


        // Main function to check weather
        checkWeatherBtn.addEventListener('click', async () => {
            hideMessage();
            clearResults();
            showLoading();

            const location = locationInput.value.trim();
            const windThreshold = parseFloat(windThresholdInput.value);
            const windowDuration = parseInt(windowDurationSelect.value);
            const freeTimeStartStr = freeTimeStartInput.value;
            const freeTimeEndStr = freeTimeEndInput.value;

            if (!location) {
                showMessage('Please enter a location.', 'error');
                hideLoading();
                return;
            }

            if (isNaN(windThreshold) || windThreshold < 0) {
                showMessage('Please enter a valid wind speed threshold (a non-negative number).', 'error');
                hideLoading();
                return;
            }

            // Parse free time to hours and minutes
            const [freeTimeStartHour, freeTimeStartMinute] = freeTimeStartStr.split(':').map(Number);
            const [freeTimeEndHour, freeTimeEndMinute] = freeTimeEndStr.split(':').map(Number);

            // Convert free time to total minutes for easier comparison
            const freeTimeStartTotalMinutes = freeTimeStartHour * 60 + freeTimeStartMinute;
            const freeTimeEndTotalMinutes = freeTimeEndHour * 60 + freeTimeEndMinute;

            // Basic validation for free time: Start must be before End on the same day
            if (freeTimeStartTotalMinutes >= freeTimeEndTotalMinutes) {
                showMessage('Free Time Start must be before Free Time End on the same day.', 'error');
                hideLoading();
                return;
            }

            let latitude, longitude;

            // Try to parse as lat, lon first
            const latLonMatch = location.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
            if (latLonMatch) {
                latitude = parseFloat(latLonMatch[1]);
                longitude = parseFloat(latLonMatch[3]);
            } else {
                // Otherwise, use Open-Meteo Geocoding API
                try {
                    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
                    const geoResponse = await fetch(geocodingUrl);
                    const geoData = await geoResponse.json();

                    if (!geoResponse.ok || !geoData.results || geoData.results.length === 0) {
                        showMessage('Location not found. Please try a different or more specific location.', 'error');
                        hideLoading();
                        return;
                    }

                    latitude = geoData.results[0].latitude;
                    longitude = geoData.results[0].longitude;
                    showMessage(`Fetching weather for: ${geoData.results[0].name}, ${geoData.results[0].country}`, 'info');

                } catch (error) {
                    console.error('Error fetching geocoding data:', error);
                    showMessage('Could not get location data. Please check your input or try again later.', 'error');
                    hideLoading();
                    return;
                }
            }

            // Fetch weather forecast from Open-Meteo
            try {
                const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation,wind_speed_10m&timezone=auto&forecast_days=7`;
                const weatherResponse = await fetch(weatherUrl);
                const weatherData = await weatherResponse.json();

                if (!weatherResponse.ok || !weatherData.hourly) {
                    showMessage('Could not retrieve weather forecast. Please try again later.', 'error');
                    hideLoading();
                    return;
                }

                const { time, precipitation, wind_speed_10m } = weatherData.hourly;
                allSuitableWindows = []; // Reset for new search
                const suitableWindowsByDate = {}; // To track windows per day for calendar highlighting

                // Iterate through hourly data to find suitable windows
                for (let i = 0; i < time.length; i++) {
                    let isWindowSuitable = true;
                    // Check if there are enough hours remaining for the window duration
                    if (i + windowDuration > time.length) {
                        break; // Not enough hours left for a full window
                    }

                    // Loop through each hour in the potential window
                    for (let j = 0; j < windowDuration; j++) {
                        const currentHourIndex = i + j;
                        const forecastDate = new Date(time[currentHourIndex]); // This date is in UTC from API

                        // Check weather conditions for the current hour
                        if (precipitation[currentHourIndex] > 0 || wind_speed_10m[currentHourIndex] > windThreshold) {
                            isWindowSuitable = false;
                            break; // Weather condition not met for this hour
                        }

                        // Check if the current hour (in its local time equivalent) falls within the specified daily free time
                        // We need to get the local hour for comparison with freeTimeStart/End
                        const localHourMinutes = forecastDate.getHours() * 60 + forecastDate.getMinutes();

                        // The current hour must be >= freeTimeStart and < freeTimeEnd
                        if (!(localHourMinutes >= freeTimeStartTotalMinutes && localHourMinutes < freeTimeEndTotalMinutes)) {
                            isWindowSuitable = false;
                            break; // Free time condition not met for this hour
                        }
                    }

                    if (isWindowSuitable) {
                        // If we reach here, the entire window meets both weather and free time criteria
                        const startTime = new Date(time[i]); // This is UTC
                        const endTime = new Date(time[i + windowDuration - 1]); // This is UTC
                        endTime.setHours(endTime.getHours() + 1); // Adjust to be the end of the window (still UTC)

                        const newWindow = {
                            startISO: startTime.toISOString(), // Store UTC ISO string
                            endISO: endTime.toISOString(),     // Store UTC ISO string
                            avgWind: (wind_speed_10m.slice(i, i + windowDuration).reduce((a, b) => a + b, 0) / windowDuration).toFixed(1),
                            maxWind: Math.max(...wind_speed_10m.slice(i, i + windowDuration)).toFixed(1)
                        };
                        allSuitableWindows.push(newWindow);

                        // Use the local date part for the key to match day buttons
                        const windowDateYYYYMMDD = formatLocalDateToYYYYMMDD(startTime); // Convert UTC Date to local YYYY-MM-DD
                        if (!suitableWindowsByDate[windowDateYYYYMMDD]) {
                            suitableWindowsByDate[windowDateYYYYMMDD] = [];
                        }
                        suitableWindowsByDate[windowDateYYYYMMDD].push(newWindow);

                        // Skip ahead by the duration to avoid overlapping windows
                        i += windowDuration - 1;
                    }
                }

                if (allSuitableWindows.length > 0) {
                    generateDayButtons(suitableWindowsByDate);
                    // Automatically select the current local day
                    const todayLocalYYYYMMDD = formatLocalDateToYYYYMMDD(new Date());

                    // Find the button for today and select it
                    const todayButton = document.querySelector(`[data-date="${todayLocalYYYYMMDD}"]`);
                    if (todayButton) {
                        todayButton.classList.add('selected');
                        renderResultsForDay(todayLocalYYYYMMDD);
                    } else {
                        // Fallback: if today's button isn't found (e.g., no data for today), select the first day with data
                        const firstDayWithWindows = Object.keys(suitableWindowsByDate).sort()[0]; // Sort to get earliest
                        if (firstDayWithWindows) {
                            renderResultsForDay(firstDayWithWindows);
                            document.querySelector(`[data-date="${firstDayWithWindows}"]`).classList.add('selected');
                        } else {
                            // If no suitable windows at all, clear results and show general message
                            clearResults();
                            showMessage('No suitable flying windows found in the next 7 days within your specified free time and weather conditions.', 'info');
                        }
                    }

                } else {
                    // If no suitable windows at all, clear results and show general message
                    clearResults();
                    showMessage('No suitable flying windows found in the next 7 days within your specified free time and weather conditions.', 'info');
                }

            } catch (error) {
                console.error('Error fetching weather data:', error);
                showMessage('An error occurred while fetching weather data. Please try again.', 'error');
            } finally {
                hideLoading();
            }
        });

        // Initial message on load
        showMessage('Enter your RC club location, desired conditions, and free time to find suitable flying times.', 'info');
