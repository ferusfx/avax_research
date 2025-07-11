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
const sliderEl = document.getElementById('dateRangeSlider');
const startDateEl = document.getElementById('startDate');
const endDateEl = document.getElementById('endDate');

// Tab Elements
const tabItems = document.querySelectorAll('.tab-item');
const tabContents = document.querySelectorAll('.tab-content');
const totalChainsEl = document.getElementById('totalChains');

// Chart canvases
const chartCanvases = {
  activeAddresses: document.getElementById('activeAddresses-chart'),
  transactions: document.getElementById('transactions-chart'),
  transactionFees: document.getElementById('transactionFees-chart'),
  gasUsed: document.getElementById('gasUsed-chart')
};

// Chain selects
const chainSelects = {
  activeAddresses: document.getElementById('activeAddresses-chainSelect'),
  transactions: document.getElementById('transactions-chainSelect'),
  transactionFees: document.getElementById('transactionFees-chainSelect'),
  gasUsed: document.getElementById('gasUsed-chainSelect')
};

// Blockchain DOM Elements
const blockchainList = document.getElementById('blockchainList');
const blockchainListStatus = document.getElementById('blockchainListStatus');
const blockchainTable = document.getElementById('blockchainTable');

// Sorting state for blockchain table
let currentSortColumn = 'chainName'; // Default sort column
let currentSortDirection = 'asc'; // Default sort direction

// Filter buttons
const filter7d = document.getElementById('filter7d');
const filter14d = document.getElementById('filter14d');
const filter30d = document.getElementById('filter30d');
const filter90d = document.getElementById('filter90d');
const filter365d = document.getElementById('filter365d');

// Metrics KPI Elements
const chainsKpiSection = document.createElement('div');
chainsKpiSection.className = 'kpi-section';
chainsKpiSection.innerHTML = `
  <h3>Blockchain Count Trends</h3>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">7 Days Ago</div>
      <div class="kpi-value" id="kpi-7d">-</div>
      <div class="kpi-change" id="kpi-7d-change">-</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">30 Days Ago</div>
      <div class="kpi-value" id="kpi-30d">-</div>
      <div class="kpi-change" id="kpi-30d-change">-</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">90 Days Ago</div>
      <div class="kpi-value" id="kpi-90d">-</div>
      <div class="kpi-change" id="kpi-90d-change">-</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">365 Days Ago</div>
      <div class="kpi-value" id="kpi-365d">-</div>
      <div class="kpi-change" id="kpi-365d-change">-</div>
    </div>
  </div>
`;

// State
let startTimestamp = TODAY_TIMESTAMP - (30 * DAY_IN_SECONDS); // Default to last 30 days
let endTimestamp = TODAY_TIMESTAMP;
let charts = {}; // Charts instances
let activeTab = 'overview'; // Current active tab
let chart = null; // Main chart instance
let ctx = null; // Main chart context

// Format date as DD.MM.YYYY
function formatDate(timestamp) {
  // Make sure timestamp is in seconds, not milliseconds
  // More robust check for milliseconds vs seconds timestamp
  // Unix timestamps in seconds won't exceed ~2.5 billion until year 2050
  // Current millisecond timestamps are ~1.7 trillion
  if (timestamp > 10000000000) { // If timestamp is in milliseconds (after 2001 in ms)
    console.log(`Converting millisecond timestamp ${timestamp} to seconds`);
    timestamp = Math.floor(timestamp / 1000);
  }
  
  // Check if the date is valid before proceeding
  const date = new Date(timestamp * 1000);
  if (date.toString() === 'Invalid Date' || date.getFullYear() < 2000 || date.getFullYear() > 2050) {
    console.error(`Invalid date from timestamp ${timestamp}, using current date`);
    return 'Invalid Date';
  }
  
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
    
    // Update the date display
    updateDateDisplay();
    
    // Update blockchain KPIs when date range changes
    if (activeTab === 'overview') {
      updateBlockchainKpis();
    }
  }
  
  updateDateDisplay();
  
  // Update the active tab data if needed
  updateActiveTabData();
}

// Initialize noUiSlider
let slider = null;

document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded - initializing slider');
  console.log(`Earliest date: ${formatDate(EARLIEST_TIMESTAMP)}`);
  console.log(`Today: ${formatDate(TODAY_TIMESTAMP)}`);
  
  // Initialize the main chart context if exists
  const chartCanvas = document.getElementById('main-chart');
  if (chartCanvas) {
    ctx = chartCanvas.getContext('2d');
    console.log('Main chart canvas found and context initialized');
  } else {
    console.log('Main chart canvas not found in the DOM');
  }
  
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
      
      // Update blockchain KPIs when date range changes
      if (activeTab === 'overview') {
        updateBlockchainKpis();
      }
    });
  }
  
  // Initialize with default date display
  updateDateDisplay();
  
  // Setup tab switching
  tabItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      switchTab(tabId);
    });
  });
  
  // Setup chain selection dropdown event listeners
  Object.keys(chainSelects).forEach(metric => {
    if (chainSelects[metric]) {
      chainSelects[metric].addEventListener('change', () => {
        const selectedChainId = chainSelects[metric].value;
        const selectedOption = chainSelects[metric].options[chainSelects[metric].selectedIndex];
        const selectedChainName = selectedOption ? selectedOption.text : 'Unknown';
        
        console.log(`Chain selection changed for ${metric} tab to ${selectedChainName} (${selectedChainId})`);
        
        // Map tabs to their specific metric types
        let metricType;
        switch(metric) {
          case 'transactions':
            metricType = 'txCount';
            break;
          case 'transactionFees':
            metricType = 'feesPaid';
            break;
          case 'gasUsed':
            metricType = 'gasUsed';
            break;
          default:
            metricType = metric;
        }
        
        console.log(`Fetching ${metricType} data for chain ${selectedChainId}`);
        fetchAndDisplayData(metricType, selectedChainId, metric);
      });
    } else {
      console.error(`Chain select element not found for metric: ${metric}`);
    }
  });
  
  // Add event listeners for sortable table headers
  document.querySelectorAll('.blockchain-table th.sortable').forEach(header => {
    header.addEventListener('click', () => {
      const column = header.getAttribute('data-sort');
      
      // Toggle sort direction if clicking on the same column
      const direction = (column === currentSortColumn && currentSortDirection === 'asc') ? 'desc' : 'asc';
      
      // Sort the table
      sortBlockchainTable(column, direction);
    });
  });
  
  // Fetch blockchain list on page load
  fetchBlockchains();
  
  // Add KPI section to overview tab
  const overviewTab = document.getElementById('overview-tab');
  const blockchainSection = overviewTab.querySelector('.blockchain-section');
  
  if (overviewTab && blockchainSection) {
    // Insert the KPI section before the blockchain section
    overviewTab.insertBefore(chainsKpiSection, blockchainSection);
    console.log('Added blockchain KPI section to overview tab');
    
    // Verify the KPI elements are in the DOM
    setTimeout(() => {
      const kpiElements = [
        'kpi-7d', 'kpi-7d-change', 
        'kpi-30d', 'kpi-30d-change',
        'kpi-90d', 'kpi-90d-change',
        'kpi-365d', 'kpi-365d-change'
      ];
      
      const missingElements = kpiElements.filter(id => !document.getElementById(id));
      
      if (missingElements.length > 0) {
        console.error('KPI elements missing from DOM:', missingElements.join(', '));
      } else {
        console.log('All KPI elements successfully added to DOM');
      }
    }, 0);
  } else {
    console.error('Could not find overview tab or blockchain section to add KPI section');
  }
});

// Map of metrics to their display names
const metricDisplayNames = {
  'activeAddresses': 'Active Addresses',
  'txCount': 'Transactions',
  'feesPaid': 'Transaction Fees',
  'gasUsed': 'Gas Used',
  'transactionFees': 'Transaction Fees' // For backward compatibility
};

// Switch between tabs
function switchTab(tabId) {
  console.log(`Switching to tab: ${tabId}`);
  
  // Update active tab state
  activeTab = tabId;
  
  // Update tab item styling
  tabItems.forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // Update tab content visibility
  tabContents.forEach(content => {
    if (content.id === `${tabId}-tab`) {
      content.classList.add('active');
      
      // If switching to overview tab, update the blockchain KPIs
      if (tabId === 'overview') {
        updateBlockchainKpis();
      }
    } else {
      content.classList.remove('active');
    }
  });
  
  // If this is a metric tab, fetch and display the data
  if (tabId !== 'overview') {
    const chainSelect = chainSelects[tabId];
    if (chainSelect) {
      const chainId = chainSelect.value;
      
      // Map tabs to their specific metric types
      let metricType;
      switch(tabId) {
        case 'transactions':
          metricType = 'txCount';
          break;
        case 'transactionFees':
          metricType = 'feesPaid';
          break;
        case 'gasUsed':
          metricType = 'gasUsed';
          break;
        default:
          metricType = tabId;
      }
      
      console.log(`Auto-loading data for ${tabId} tab with chain ID ${chainId} using metric type ${metricType}`);
      fetchAndDisplayData(metricType, chainId, tabId);
    } else {
      console.error(`No chain select found for tab: ${tabId}`);
    }
  } else {
    console.log(`Tab ${tabId} is the overview tab, not loading metrics data`);
  }
}

// Fetch data and display chart for the selected metric and chain
async function fetchAndDisplayData(metricType, chainId, tabId = null) {
  // If tabId is not provided, use metricType as the tabId (for backward compatibility)
  const displayTabId = tabId || metricType;
  
  console.log(`Fetching ${metricType} for chain ${chainId} (tab: ${displayTabId})`);
  
  // Get the human-friendly metric name
  const metricDisplayName = metricDisplayNames[metricType] || 'Active Addresses';
  console.log(`Using display name "${metricDisplayName}" for metric type "${metricType}" on tab "${displayTabId}"`);
  
  try {
    // Call API
    const result = await window.avaxApi.fetchMetrics(
      startTimestamp,
      endTimestamp,
      metricType,
      chainId
    );
    
    console.log(`API call for ${metricType} ${result.ok ? 'successful' : 'failed'}: ${result.status}`);
    console.log(`Using chain ID: ${chainId} for API call`);
    
    if (!result.ok || !result.data) {
      console.error(`API call failed: ${result.status}`);
      alert(`Error fetching data: ${result.error || 'Unknown error'}`);
      return;
    }
    
    const { results } = result.data;
    console.log(`Data received: ${results.length} data points`);
    
    if (results.length === 0) {
      console.error('No data received from API');
      alert('No data available for the selected parameters.');
      return;
    }
    
    // Check if we got what looks like a partial response
    const requestedDayCount = Math.floor((endTimestamp - startTimestamp) / DAY_IN_SECONDS) + 1;
    console.log(`Requested ${requestedDayCount} days, received ${results.length} data points`);
    
    // Log first and last data points to debug date issues
    console.log('First data point:', {
      timestamp: results[0].timestamp,
      date: formatDate(results[0].timestamp),
      dateObject: new Date(results[0].timestamp * 1000).toISOString(),
      value: results[0].value
    });
    console.log('Last data point:', {
      timestamp: results[results.length-1].timestamp,
      date: formatDate(results[results.length-1].timestamp),
      dateObject: new Date(results[results.length-1].timestamp * 1000).toISOString(),
      value: results[results.length-1].value
    });
    
    // transform data → labels & dates
    const sortedResults = [...results].sort((a, b) => a.timestamp - b.timestamp); // Ensure chronological order
    
    // Validate timestamps before processing
    const validatedResults = sortedResults.map(r => {
      // Check if timestamp is valid (not null, undefined, or too small)
      if (!r.timestamp || r.timestamp < 1000000000) { // Basic sanity check for timestamps (before year 2001)
        console.warn(`Invalid timestamp found: ${r.timestamp}. Using current time instead.`);
        r.timestamp = Math.floor(Date.now() / 1000);
      } else if (r.timestamp > 10000000000) { // If timestamp is in milliseconds (after 2001 in ms)
        console.log(`Converting millisecond timestamp ${r.timestamp} to seconds`);
        r.timestamp = Math.floor(r.timestamp / 1000);
      }
      
      // Verify the date is valid by checking the year
      const testDate = new Date(r.timestamp * 1000);
      if (testDate.getFullYear() < 2010 || testDate.getFullYear() > 2050) {
        console.warn(`Suspicious date detected: ${testDate.toISOString()} from timestamp ${r.timestamp}`);
        r.timestamp = Math.floor(Date.now() / 1000);
      }
      
      return r;
    });
    
    const labels = validatedResults.map(r => formatDate(r.timestamp));
    const counts = validatedResults.map(r => r.value);
    
    // Get actual date range from the data
    const actualStartDate = formatDate(validatedResults[0].timestamp);
    const actualEndDate = formatDate(validatedResults[validatedResults.length - 1].timestamp);
    console.log(`Actual data range: ${actualStartDate} to ${actualEndDate}`);
    
    // Get chain name for display
    const selectElement = chainSelects[displayTabId];
    const selectedOption = selectElement ? selectElement.options[selectElement.selectedIndex] : null;
    const chainName = selectedOption ? selectedOption.text : 'Unknown Chain';
    
    // Create subtitle with date range and chain info
    const subtitle = `${chainName} | ${actualStartDate} - ${actualEndDate}`;
    
    console.log(`Creating chart for ${chainName} (ID: ${chainId})`);
    
    // Get the canvas for this metric
    const canvas = chartCanvases[displayTabId];
    if (!canvas) {
      console.error(`Canvas not found for tab: ${displayTabId}`);
      return;
    }
    
    // Destroy previous chart instance if exists
    if (charts[displayTabId]) {
      charts[displayTabId].destroy();
    }
    
    // Create new chart
    console.log(`Creating chart with ${labels.length} data points from ${validatedResults[0].timestamp} to ${validatedResults[validatedResults.length - 1].timestamp}`);
    console.log(`First label: ${labels[0]}, Last label: ${labels[labels.length - 1]}`);
    
    charts[displayTabId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: `${metricDisplayName} / day`,
            data: counts,
            backgroundColor: 'rgba(255, 0, 0, 0.7)',
            borderColor: 'rgba(220, 0, 0, 1)',
            borderWidth: 1,
            borderRadius: 4,
            hoverBackgroundColor: 'rgba(255, 0, 0, 0.9)',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: 'white'
            }
          },
          tooltip: {
            callbacks: {
              title: function(tooltipItems) {
                return tooltipItems[0].label;
              },
              label: function(context) {
                let value = context.parsed.y;
                let formattedValue = value.toLocaleString();
                return `${metricDisplayName}: ${formattedValue}`;
              }
            }
          },
          subtitle: {
            display: subtitle ? true : false,
            text: subtitle || '',
            color: 'white',
            font: {
              size: 14,
              style: 'italic'
            },
            padding: {
              bottom: 10
            }
          }
        },
        scales: {
          y: { 
            beginAtZero: true,
            title: {
              display: true,
              text: metricDisplayName,
              color: 'white',
              font: {
                weight: 'bold'
              }
            },
            ticks: {
              color: 'white',
              callback: function(value) {
                if (value >= 1000000) {
                  return (value / 1000000).toFixed(1) + 'M';
                } else if (value >= 1000) {
                  return (value / 1000).toFixed(1) + 'K';
                }
                return value;
              }
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Date',
              color: 'white',
              font: {
                weight: 'bold'
              }
            },
            ticks: {
              color: 'white'
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          }
        }
      }
    });
  } catch (err) {
    console.error(`Error fetching ${metricType} data:`, err);
    alert(`Error: ${err.message || 'Unknown error occurred'}`);
  }
}

// Update KPI values for blockchain trends
async function updateKpiValues() {
  try {
    // Since db.js is removed, we'll just display "N/A" for all metrics
    // In a real app, you might want to implement an alternative metrics solution
    
    // For all KPI elements, set to N/A
    document.getElementById('kpi-7d').textContent = 'N/A';
    document.getElementById('kpi-7d-change').textContent = 'N/A';
    document.getElementById('kpi-7d-change').className = 'kpi-change neutral';
    
    document.getElementById('kpi-30d').textContent = 'N/A';
    document.getElementById('kpi-30d-change').textContent = 'N/A';
    document.getElementById('kpi-30d-change').className = 'kpi-change neutral';
    
    document.getElementById('kpi-90d').textContent = 'N/A';
    document.getElementById('kpi-90d-change').textContent = 'N/A';
    document.getElementById('kpi-90d-change').className = 'kpi-change neutral';
    
    document.getElementById('kpi-365d').textContent = 'N/A';
    document.getElementById('kpi-365d-change').textContent = 'N/A';
    document.getElementById('kpi-365d-change').className = 'kpi-change neutral';
    
    console.log('KPI values set to N/A (metrics database removed)');
  } catch (error) {
    console.error('Error updating KPI values:', error);
  }
}

// Calculate blockchain trends based on creation timestamps
async function updateBlockchainKpis() {
  try {
    console.log('Updating blockchain KPIs from table data');
    
    // Check if the blockchain list element exists
    if (!blockchainList) {
      console.error('blockchainList element is not defined!');
      return;
    }
    
    console.log('blockchainList element ID:', blockchainList.id);
    console.log('blockchainList parent:', blockchainList.parentElement?.tagName);
    console.log('blockchainList HTML:', blockchainList.outerHTML);
    
    // Get all rows from the blockchain table
    const rows = Array.from(blockchainList.querySelectorAll('tr'));
    console.log(`Found ${rows.length} rows in the blockchain table`);
    
    if (rows.length === 0) {
      console.log('No blockchain data in table yet, deferring KPI update');
      return;
    }
    
    // Get the current end date from the slider
    const currentEndDate = new Date(endTimestamp * 1000);
    console.log(`Current end date for KPI calculations: ${currentEndDate.toISOString()}`);
    
    // Calculate the reference dates based on the end date
    const date7dAgo = new Date(currentEndDate);
    date7dAgo.setDate(currentEndDate.getDate() - 7);
    
    const date30dAgo = new Date(currentEndDate);
    date30dAgo.setDate(currentEndDate.getDate() - 30);
    
    const date90dAgo = new Date(currentEndDate);
    date90dAgo.setDate(currentEndDate.getDate() - 90);
    
    const date365dAgo = new Date(currentEndDate);
    date365dAgo.setDate(currentEndDate.getDate() - 365);
    
    console.log('Reference dates for KPI calculations:', {
      'current': currentEndDate.toISOString(),
      '7d ago': date7dAgo.toISOString(),
      '30d ago': date30dAgo.toISOString(),
      '90d ago': date90dAgo.toISOString(),
      '365d ago': date365dAgo.toISOString()
    });
    
    // Helper function to parse dates from the table
    const parseTableDate = (dateStr) => {
      if (!dateStr || dateStr === 'N/A') return null;
      
      // Normalize the input by trimming whitespace
      const normalizedDateStr = dateStr.trim();
      
      // Try to parse the date string using various methods
      try {
        // If it's already a Date object
        if (normalizedDateStr instanceof Date) return normalizedDateStr;
        
        // Common formats to try (ordered by likelihood):
        
        // 1. Parse date in format DD.MM.YYYY
        const dotParts = normalizedDateStr.split('.');
        if (dotParts.length === 3) {
          const parsedDate = new Date(dotParts[2], dotParts[1] - 1, dotParts[0]);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
          }
        }
        
        // 2. Parse date in format YYYY-MM-DD (ISO format)
        const dashParts = normalizedDateStr.split('-');
        if (dashParts.length === 3) {
          const parsedDate = new Date(dashParts[0], dashParts[1] - 1, dashParts[2]);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
          }
        }
        
        // 3. Try ISO format date parsing (includes time component)
        const isoDate = new Date(normalizedDateStr);
        if (!isNaN(isoDate.getTime())) {
          return isoDate;
        }
        
        // 4. Try to handle numeric timestamps (seconds or milliseconds)
        const numTimestamp = Number(normalizedDateStr);
        if (!isNaN(numTimestamp)) {
          // Check if it's in seconds (10 digits) or milliseconds (13 digits)
          const timestamp = new Date(numTimestamp < 10000000000 ? numTimestamp * 1000 : numTimestamp);
          if (!isNaN(timestamp.getTime())) {
            return timestamp;
          }
        }
        
        console.warn(`Could not parse date string: "${normalizedDateStr}" using any known method`);
      } catch (e) {
        console.error(`Error parsing date: "${normalizedDateStr}"`, e);
      }
      
      return null;
    };
    
    // Count blockchains created before each date
    const countBefore = (date) => {
      let parsedCount = 0;
      let unparsedCount = 0;
      let noDateCount = 0;
      
      const count = rows.filter(row => {
        // The creation date is in the third column (index 2)
        const creationDateCell = row.cells[2];
        if (!creationDateCell) {
          noDateCount++;
          return false;
        }
        
        const creationDateStr = creationDateCell.textContent.trim();
        
        // If the creation date is N/A, skip this row
        if (creationDateStr === 'N/A') {
          noDateCount++;
          return false;
        }
        
        const creationDate = parseTableDate(creationDateStr);
        
        // If we couldn't parse the date, skip this row
        if (!creationDate) {
          unparsedCount++;
          return false;
        }
        
        parsedCount++;
        return creationDate <= date;
      }).length;
      
      // Log parse stats occasionally to help diagnose date parsing issues
      if (date === currentEndDate) {
        console.log(`Date parsing stats: Successfully parsed ${parsedCount} dates, failed to parse ${unparsedCount} dates, ${noDateCount} N/A or missing dates`);
        if (unparsedCount > 0) {
          // Sample a few rows to see what date formats we're dealing with
          const sampleRows = rows.slice(0, Math.min(5, rows.length));
          console.log('Sample date values from table:', sampleRows.map(row => row.cells[2]?.textContent || 'N/A'));
        }
      }
      
      return count;
    };
    
    // Current total count (all blockchains in the table)
    const currentCount = rows.length;
    
    // Counts at reference dates
    const count7dAgo = countBefore(date7dAgo);
    const count30dAgo = countBefore(date30dAgo);
    const count90dAgo = countBefore(date90dAgo);
    const count365dAgo = countBefore(date365dAgo);
    
    console.log(`KPI Counts: Current=${currentCount}, 7d ago=${count7dAgo}, 30d ago=${count30dAgo}, 90d ago=${count90dAgo}, 365d ago=${count365dAgo}`);
    
    // Calculate changes
    const change7d = currentCount - count7dAgo;
    const change30d = currentCount - count30dAgo;
    const change90d = currentCount - count90dAgo;
    const change365d = currentCount - count365dAgo;
    
    // Calculate percent changes
    const percentChange7d = count7dAgo > 0 ? (change7d / count7dAgo) * 100 : 0;
    const percentChange30d = count30dAgo > 0 ? (change30d / count30dAgo) * 100 : 0;
    const percentChange90d = count90dAgo > 0 ? (change90d / count90dAgo) * 100 : 0;
    const percentChange365d = count365dAgo > 0 ? (change365d / count365dAgo) * 100 : 0;
    
    console.log('Blockchain trend calculations:', {
      currentCount,
      '7d': { before: count7dAgo, change: change7d, percent: percentChange7d.toFixed(2) + '%' },
      '30d': { before: count30dAgo, change: change30d, percent: percentChange30d.toFixed(2) + '%' },
      '90d': { before: count90dAgo, change: change90d, percent: percentChange90d.toFixed(2) + '%' },
      '365d': { before: count365dAgo, change: change365d, percent: percentChange365d.toFixed(2) + '%' }
    });
    
    // Check if KPI elements exist
    const kpiElements = {
      '7d': document.getElementById('kpi-7d'),
      '7d-change': document.getElementById('kpi-7d-change'),
      '30d': document.getElementById('kpi-30d'),
      '30d-change': document.getElementById('kpi-30d-change'),
      '90d': document.getElementById('kpi-90d'),
      '90d-change': document.getElementById('kpi-90d-change'),
      '365d': document.getElementById('kpi-365d'),
      '365d-change': document.getElementById('kpi-365d-change')
    };
    
    // Check if any elements are missing
    const missingElements = Object.entries(kpiElements)
      .filter(([key, element]) => !element)
      .map(([key]) => key);
    
    if (missingElements.length > 0) {
      console.error('Some KPI elements are missing:', missingElements.join(', '));
      return;
    }
    
    // Update the KPI elements
    // 7-day KPI
    kpiElements['7d'].textContent = count7dAgo;
    kpiElements['7d-change'].textContent = `${change7d > 0 ? '+' : ''}${change7d} (${percentChange7d.toFixed(2)}%)`;
    kpiElements['7d-change'].className = `kpi-change ${change7d > 0 ? 'positive' : change7d < 0 ? 'negative' : 'neutral'}`;
    
    // 30-day KPI
    kpiElements['30d'].textContent = count30dAgo;
    kpiElements['30d-change'].textContent = `${change30d > 0 ? '+' : ''}${change30d} (${percentChange30d.toFixed(2)}%)`;
    kpiElements['30d-change'].className = `kpi-change ${change30d > 0 ? 'positive' : change30d < 0 ? 'negative' : 'neutral'}`;
    
    // 90-day KPI
    kpiElements['90d'].textContent = count90dAgo;
    kpiElements['90d-change'].textContent = `${change90d > 0 ? '+' : ''}${change90d} (${percentChange90d.toFixed(2)}%)`;
    kpiElements['90d-change'].className = `kpi-change ${change90d > 0 ? 'positive' : change90d < 0 ? 'negative' : 'neutral'}`;
    
    // 365-day KPI
    kpiElements['365d'].textContent = count365dAgo;
    kpiElements['365d-change'].textContent = `${change365d > 0 ? '+' : ''}${change365d} (${percentChange365d.toFixed(2)}%)`;
    kpiElements['365d-change'].className = `kpi-change ${change365d > 0 ? 'positive' : change365d < 0 ? 'negative' : 'neutral'}`;
    
  } catch (error) {
    console.error('Error updating blockchain KPIs:', error);
  }
}

// Fetch and display blockchain list
async function fetchBlockchains() {
  console.log('Fetching supported blockchains...');
  
  // Show loading status
  blockchainListStatus.textContent = 'Fetching blockchains, please wait...';
  blockchainList.innerHTML = ''; // Clear existing blockchain list
  
  // Debug: Check the blockchain list element
  console.log('blockchainList element:', blockchainList);
  if (!blockchainList) {
    console.error('blockchainList element not found!');
  }
  
  try {
    // Call the standard API exposed by preload
    const result = await window.avaxApi.fetchSupportedBlockchains();
    console.log(`Blockchain API call ${result.ok ? 'successful' : 'failed'}: ${result.status}`);
    
    // Also fetch the blockchains with creation dates from Glacier API
    const glacierResult = await window.avaxApi.glacierListBlockchains();
    console.log(`Glacier API call ${glacierResult.ok ? 'successful' : 'failed'}: ${glacierResult.status}`);
    
    // Create a map of blockchain creation dates by evmChainId
    const creationDates = {};
    if (glacierResult.ok && glacierResult.data && glacierResult.data.blockchains) {
      console.log(`Received ${glacierResult.data.blockchains.length} blockchains from Glacier API`);
      
      // Debug output for the first few blockchain entries
      if (glacierResult.data.blockchains.length > 0) {
        console.log('First few blockchain entries:', 
          glacierResult.data.blockchains.slice(0, 3).map(b => ({
            id: b.evmChainId,
            name: b.blockchainName || 'unknown',
            date: b.formattedCreateDate,
            hasEvmChainId: !!b.evmChainId,
            hasDate: !!b.formattedCreateDate
          }))
        );
      }
      
      glacierResult.data.blockchains.forEach(blockchain => {
        if (blockchain.evmChainId && blockchain.formattedCreateDate) {
          creationDates[blockchain.evmChainId] = blockchain.formattedCreateDate;
        }
      });
      console.log(`Loaded creation dates for ${Object.keys(creationDates).length} blockchains`);
      
      if (Object.keys(creationDates).length > 0) {
        console.log('Sample creation dates:', Object.entries(creationDates).slice(0, 3));
      } else {
        console.error('No valid creation dates were found in the API response');
      }
    } else {
      console.error('Failed to load creation dates from Glacier API:', 
        glacierResult.error || 'Unknown error');
      
      // If available, log the raw response for debugging
      if (glacierResult.data) {
        console.log('Glacier API response data:', glacierResult.data);
      }
    }
    
    if (!result.ok || !result.data) {
      console.error(`Blockchain API call failed: ${result.status}`);
      blockchainListStatus.textContent = `Error: ${result.error || 'Failed to fetch blockchains'}`;
      return;
    }
    
    // Debug: Log the entire result data to understand its structure
    console.log('Complete result data structure:', JSON.stringify(result.data, null, 2));
    
    const { chains } = result.data;
    console.log(`Received ${chains ? chains.length : 0} blockchains`);
    
    // Update the total chains count in the overview tab
    if (totalChainsEl && chains) {
      totalChainsEl.textContent = chains.length;
    }
    
    // Debug: Log the structure of the first blockchain object if available
    if (chains && chains.length > 0) {
      console.log('First blockchain object structure:', JSON.stringify(chains[0], null, 2));
    } else {
      console.log('No blockchains found in chains array');
      
      // Try to find blockchain data in a different structure
      if (result.data.rawResult) {
        console.log('Found raw result data:', result.data.rawResult);
        
        // Try to convert the raw result to a usable chains array
        if (Array.isArray(result.data.rawResult)) {
          result.data.chains = result.data.rawResult;
          console.log('Using raw result array as chains');
        } else if (typeof result.data.rawResult === 'object') {
          // Check if rawResult might be a single blockchain object
          if (result.data.rawResult.chainName || result.data.rawResult.evmChainId) {
            result.data.chains = [result.data.rawResult];
            console.log('Converting single blockchain object to array');
          } else if (result.data.rawResult.chains && Array.isArray(result.data.rawResult.chains)) {
            result.data.chains = result.data.rawResult.chains;
            console.log('Using nested chains array from raw result');
          }
        }
      } else if (result.data.result && Array.isArray(result.data.result)) {
        console.log('Found potential blockchain data in result array');
        result.data.chains = result.data.result;
      } else if (result.data.result && result.data.result.chains && Array.isArray(result.data.result.chains)) {
        console.log('Found potential blockchain data in result.chains array');
        result.data.chains = result.data.result.chains;
      }
    }
    
    if (!chains || chains.length === 0) {
      blockchainListStatus.textContent = 'No blockchains found';
      totalChainsEl.textContent = '0';
      return;
    }
    
    // Clear status message
    blockchainListStatus.textContent = '';
    
    // Sort chains by name for better usability
    chains.sort((a, b) => {
      if (a.chainName && b.chainName) {
        return a.chainName.localeCompare(b.chainName);
      }
      return 0;
    });
    
    // Populate all chain select dropdowns
    populateChainSelects(chains);
    
    // Populate the table with blockchain data
    chains.forEach(chain => {
      // Skip chains without evmChainId or chainName
      if (!chain.evmChainId || !chain.chainName) {
        return;
      }
      
      // Create row for table
      const row = document.createElement('tr');
      
      // Create and append cells for each column
      const nameCell = document.createElement('td');
      nameCell.textContent = chain.chainName || 'N/A';
      row.appendChild(nameCell);
      
      const evmChainIdCell = document.createElement('td');
      evmChainIdCell.textContent = chain.evmChainId || 'N/A';
      row.appendChild(evmChainIdCell);
      
      // Add creation date cell as the third column
      const creationDateCell = document.createElement('td');
      // Look up the creation date from our map of Glacier API data
      const chainIdStr = chain.evmChainId.toString();
      
      if (creationDates[chainIdStr]) {
        creationDateCell.textContent = creationDates[chainIdStr];
        console.log(`Found creation date for chain ${chainIdStr}: ${creationDates[chainIdStr]}`);
      } else {
        creationDateCell.textContent = 'N/A';
        console.log(`No creation date found for chain ${chainIdStr}`);
      }
      
      row.appendChild(creationDateCell);
      
      const blockchainIdCell = document.createElement('td');
      blockchainIdCell.textContent = chain.blockchainId || 'N/A';
      row.appendChild(blockchainIdCell);
      
      const subnetIdCell = document.createElement('td');
      subnetIdCell.textContent = chain.subnetId || 'N/A';
      row.appendChild(subnetIdCell);
      
      const networkCell = document.createElement('td');
      networkCell.textContent = chain.network || 'N/A';
      row.appendChild(networkCell);
      
      // Add the row to the table
      blockchainList.appendChild(row);
    });
    
    // Sort the table using the current sort column and direction
    sortBlockchainTable(currentSortColumn, currentSortDirection);
    
    // Now that the table is populated, update the blockchain KPIs
    console.log(`Table population complete. Added ${blockchainList.querySelectorAll('tr').length} rows to the blockchain table.`);
    await updateBlockchainKpis();
    
    console.log('Blockchain table and dropdowns populated successfully');
  } catch (err) {
    console.error('Blockchain API call error:', err);
    blockchainListStatus.textContent = `Error: ${err.message || 'An unexpected error occurred'}`;
    totalChainsEl.textContent = '-';
  }
}

// Sort the blockchain table based on column and direction
function sortBlockchainTable(column, direction) {
  const rows = Array.from(blockchainList.querySelectorAll('tr'));
  
  // Update the sort icons in the table headers
  const headers = blockchainTable.querySelectorAll('th.sortable');
  headers.forEach(header => {
    const sortColumn = header.getAttribute('data-sort');
    const sortIcon = header.querySelector('.sort-icon');
    
    if (sortColumn === column) {
      sortIcon.textContent = direction === 'asc' ? '↑' : '↓';
      sortIcon.className = `sort-icon ${direction}`;
    } else {
      sortIcon.textContent = '↕';
      sortIcon.className = 'sort-icon';
    }
  });
  
  // Sort the rows based on the selected column and direction
  const sortedRows = rows.sort((a, b) => {
    const aValue = a.querySelector(`td:nth-child(${getColumnIndex(column)})`).textContent;
    const bValue = b.querySelector(`td:nth-child(${getColumnIndex(column)})`).textContent;
    
    // Special handling for EVM Chain ID (numeric sort)
    if (column === 'evmChainId') {
      const aNum = parseInt(aValue, 10) || 0;
      const bNum = parseInt(bValue, 10) || 0;
      return direction === 'asc' ? aNum - bNum : bNum - aNum;
    }
    
    // Special handling for creation date (if it's in a standard format)
    if (column === 'creationDate') {
      // If the date is in DD.MM.YYYY format, convert for proper comparison
      // Otherwise, fall back to string comparison
      const aDate = aValue !== 'N/A' ? parseDate(aValue) : new Date(0);
      const bDate = bValue !== 'N/A' ? parseDate(bValue) : new Date(0);
      
      if (aDate && bDate) {
        return direction === 'asc' ? aDate - bDate : bDate - aDate;
      }
    }
    
    // Default string comparison for other columns
    return direction === 'asc' 
      ? aValue.localeCompare(bValue)
      : bValue.localeCompare(aValue);
  });
  
  // Clear the table and append the sorted rows
  blockchainList.innerHTML = '';
  sortedRows.forEach(row => blockchainList.appendChild(row));
  
  // Update the current sort state
  currentSortColumn = column;
  currentSortDirection = direction;
  
  console.log(`Sorted blockchain table by ${column} in ${direction} order`);
}

// Helper function to parse a date string in DD.MM.YYYY format
function parseDate(dateString) {
  if (dateString === 'N/A') return null;
  
  const parts = dateString.split('.');
  if (parts.length !== 3) return null;
  
  // Note: Month is 0-indexed in JavaScript Date
  return new Date(parts[2], parts[1] - 1, parts[0]);
}

// Helper function to get the column index based on the column name
function getColumnIndex(column) {
  const columnMap = {
    'chainName': 1,
    'evmChainId': 2,
    'creationDate': 3,
    'blockchainId': 4,
    'subnetId': 5, 
    'network': 6
  };
  
  return columnMap[column] || 1;
}

// Filter button event listeners
filter7d.addEventListener('click', () => setDateRange(7));
filter14d.addEventListener('click', () => setDateRange(14));
filter30d.addEventListener('click', () => setDateRange(30));
filter90d.addEventListener('click', () => setDateRange(90));
filter365d.addEventListener('click', () => setDateRange(365));

// If we're on a metric tab and not the overview, fetch data for the active tab
function updateActiveTabData() {
  if (activeTab !== 'overview') {
    const chainSelect = chainSelects[activeTab];
    if (chainSelect) {
      // Map tabs to their specific metric types
      let metricType;
      switch(activeTab) {
        case 'transactions':
          metricType = 'txCount';
          break;
        case 'transactionFees':
          metricType = 'feesPaid';
          break;
        case 'gasUsed':
          metricType = 'gasUsed';
          break;
        default:
          metricType = activeTab;
      }
      
      fetchAndDisplayData(metricType, chainSelect.value, activeTab);
    }
  }
}

// Populate all chain select dropdowns with the given chains
function populateChainSelects(chains) {
  // Get all chain select elements
  const selects = Object.values(chainSelects);
  
  selects.forEach(select => {
    if (!select) return;
    
    // Store the currently selected value
    const currentChainId = select.value;
    console.log(`Current selected chain ID before update: ${currentChainId}`);
    
    // Clear current options except the default option
    while (select.options.length > 1) {
      select.remove(1);
    }
    
    // Keep track if we found the current selection
    let foundCurrentSelection = false;
    
    // Add chains to dropdown
    chains.forEach(chain => {
      // Skip chains without evmChainId or chainName
      if (!chain.evmChainId || !chain.chainName) {
        return;
      }
      
      // Convert to string consistently for comparison
      const chainIdStr = chain.evmChainId.toString();
      
      // Add to dropdown - ensure the value is a string
      const option = document.createElement('option');
      option.value = chainIdStr;
      option.textContent = `${chain.chainName} (${chain.network || 'unknown'})`;
      
      // If this matches the previously selected chain, select it
      if (chainIdStr === currentChainId) {
        option.selected = true;
        foundCurrentSelection = true;
        console.log(`Re-selected chain: ${chain.chainName} (${chainIdStr})`);
      }
      
      select.appendChild(option);
    });
  });
}

