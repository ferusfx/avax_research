// Using regular script, not ES module
// Chart.js and noUiSlider are loaded via separate script tags in HTML

// Date range constants
const DAY_IN_SECONDS = 86400;
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0); // Start of today
const TODAY_TIMESTAMP = Math.floor(TODAY.getTime() / 1000);

// Calculate earliest date (Sep 23, 2020)
const EARLIEST_DATE = new Date(2020, 8, 23); // Month is 0-indexed, so 8 = September
const EARLIEST_TIMESTAMP = Math.floor(EARLIEST_DATE.getTime() / 1000);

// DOM Elements
const runApiBtn = document.getElementById('runApiBtn');
const sliderEl = document.getElementById('dateRangeSlider');
const startDateEl = document.getElementById('startDate');
const endDateEl = document.getElementById('endDate');
const ctx = document.getElementById('activeChart');

// Filter buttons
const filter7d = document.getElementById('filter7d');
const filter14d = document.getElementById('filter14d');
const filter30d = document.getElementById('filter30d');
const filter90d = document.getElementById('filter90d');
const filter365d = document.getElementById('filter365d');

// State
let startTimestamp = TODAY_TIMESTAMP - (30 * DAY_IN_SECONDS); // Default to last 30 days
let endTimestamp = TODAY_TIMESTAMP;
let chart = null; // Chart instance

// Format date as DD.MM.YYYY
function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// Update the displayed date range
function updateDateDisplay() {
  startDateEl.textContent = `Start: ${formatDate(startTimestamp)}`;
  endDateEl.textContent = `End: ${formatDate(endTimestamp)}`;
}

// Set date range based on number of days from today
function setDateRange(days) {
  endTimestamp = TODAY_TIMESTAMP;
  startTimestamp = endTimestamp - (days * DAY_IN_SECONDS);
  
  if (slider && slider.noUiSlider) {
    // Update the slider without triggering the change event
    slider.noUiSlider.set([startTimestamp, endTimestamp]);
  }
  
  updateDateDisplay();
}

// Initialize noUiSlider
let slider = null;

document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded - initializing slider');
  console.log(`Earliest date: ${formatDate(EARLIEST_TIMESTAMP)}`);
  console.log(`Today: ${formatDate(TODAY_TIMESTAMP)}`);
  
  // Create the double-handled slider
  slider = document.getElementById('dateRangeSlider');
  
  if (slider) {
    noUiSlider.create(slider, {
      start: [startTimestamp, endTimestamp],
      connect: true,
      step: DAY_IN_SECONDS, // One day step
      range: {
        'min': EARLIEST_TIMESTAMP,
        'max': TODAY_TIMESTAMP
      },
      format: {
        to: value => Math.round(value),
        from: value => Math.round(value)
      }
    });
    
    console.log('Slider created with range:', {
      min: formatDate(EARLIEST_TIMESTAMP),
      max: formatDate(TODAY_TIMESTAMP),
      currentStart: formatDate(startTimestamp),
      currentEnd: formatDate(endTimestamp)
    });
    
    // Update date display when slider values change
    slider.noUiSlider.on('update', function(values, handle) {
      startTimestamp = parseInt(values[0]);
      endTimestamp = parseInt(values[1]);
      console.log(`Slider updated: start=${formatDate(startTimestamp)}, end=${formatDate(endTimestamp)}`);
      updateDateDisplay();
    });
  }
  
  // Initialize with default date display
  updateDateDisplay();
});

// Filter button event listeners
filter7d.addEventListener('click', () => setDateRange(7));
filter14d.addEventListener('click', () => setDateRange(14));
filter30d.addEventListener('click', () => setDateRange(30));
filter90d.addEventListener('click', () => setDateRange(90));
filter365d.addEventListener('click', () => setDateRange(365));

// API call button event listener
runApiBtn.addEventListener('click', async () => {
  console.log('runApiBtn clicked – building URL & starting fetch…');
  console.log(`startTs=${startTimestamp} (${formatDate(startTimestamp)}), endTs=${endTimestamp} (${formatDate(endTimestamp)})`);
  
  // Show loading indicator or disable button
  runApiBtn.disabled = true;
  runApiBtn.textContent = 'Loading...';

  try {
    // Use the API exposed by preload
    const result = await window.avaxApi.fetchActiveAddresses(startTimestamp, endTimestamp);
    console.log(`API call ${result.ok ? 'successful' : 'failed'}: ${result.status}`);

    if (!result.ok || !result.data) {
      console.error(`API call failed: ${result.status}`);
      runApiBtn.disabled = false;
      runApiBtn.textContent = 'Run API Query';
      return;
    }

    const { results } = result.data;
    console.log(`Data received: ${results.length} data points`);
    
    if (results.length === 0) {
      console.error('No data received from API');
      runApiBtn.disabled = false;
      runApiBtn.textContent = 'Run API Query';
      return;
    }
    
    // Check if we got what looks like a partial response
    const requestedDayCount = Math.floor((endTimestamp - startTimestamp) / DAY_IN_SECONDS) + 1;
    console.log(`Requested ${requestedDayCount} days, received ${results.length} data points`);
    
    // Log first and last data points to debug date issues
    console.log('First data point:', {
      timestamp: results[0].timestamp,
      date: formatDate(results[0].timestamp),
      value: results[0].value
    });
    console.log('Last data point:', {
      timestamp: results[results.length-1].timestamp,
      date: formatDate(results[results.length-1].timestamp),
      value: results[results.length-1].value
    });

    // transform data → labels & dates
    const labels = results
      .map(r => formatDate(r.timestamp))
      .reverse(); // API returns newest first
    const counts = results.map(r => r.value).reverse();

    // Get actual date range from the data (results are ordered newest to oldest)
    const actualEndDate = formatDate(results[0].timestamp);
    const actualStartDate = formatDate(results[results.length - 1].timestamp);
    console.log(`Actual data range: ${actualStartDate} to ${actualEndDate}`);

    // replace previous chart if it exists
    if (chart) {
      chart.destroy();
    }
    
    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Active addresses / day',
            data: counts,
            backgroundColor: 'rgba(0, 123, 255, 0.6)',
            borderColor: 'rgba(0, 123, 255, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: { 
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Addresses'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: `Active Addresses on Avalanche C-Chain (${actualStartDate} to ${actualEndDate})`,
            font: {
              size: 16
            },
            subtitle: {
              display: results.length < requestedDayCount,
              text: `Note: API returned ${results.length} of ${requestedDayCount} requested days`,
              font: {
                size: 12,
                style: 'italic'
              }
            }
          },
          legend: {
            display: true,
            position: 'top'
          }
        }
      }
    });
  } catch (err) {
    console.error('API call error:', err);
  } finally {
    // Re-enable button
    runApiBtn.disabled = false;
    runApiBtn.textContent = 'Run API Query';
  }
});

