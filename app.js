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

// Run buttons
const runButtons = {
  activeAddresses: document.getElementById('activeAddresses-runBtn'),
  transactions: document.getElementById('transactions-runBtn'),
  transactionFees: document.getElementById('transactionFees-runBtn'),
  gasUsed: document.getElementById('gasUsed-runBtn')
};

// Blockchain DOM Elements
const blockchainList = document.getElementById('blockchainList');
const blockchainListStatus = document.getElementById('blockchainListStatus');

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
      <div class="kpi-title">7 Day Change</div>
      <div class="kpi-value" id="kpi-7d">-</div>
      <div class="kpi-change" id="kpi-7d-change">-</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">30 Day Change</div>
      <div class="kpi-value" id="kpi-30d">-</div>
      <div class="kpi-change" id="kpi-30d-change">-</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">90 Day Change</div>
      <div class="kpi-value" id="kpi-90d">-</div>
      <div class="kpi-change" id="kpi-90d-change">-</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">365 Day Change</div>
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
  
  // Setup run buttons
  Object.keys(runButtons).forEach(metric => {
    if (runButtons[metric]) {
      runButtons[metric].addEventListener('click', () => {
        fetchAndDisplayData(metric, chainSelects[metric].value);
      });
    }
  });
  
  // Fetch blockchain list on page load
  fetchBlockchains();
  
  // Add KPI section to overview tab
  const overviewTab = document.getElementById('overview-tab');
  const blockchainSection = overviewTab.querySelector('.blockchain-section');
  if (overviewTab && blockchainSection) {
    overviewTab.insertBefore(chainsKpiSection, blockchainSection);
    console.log('Added blockchain KPI section to overview tab');
  } else {
    console.error('Could not find overview tab or blockchain section to add KPI section');
  }
});

// Map of metrics to their display names
const metricDisplayNames = {
  'activeAddresses': 'Active Addresses',
  'transactions': 'Transactions',
  'transactionFees': 'Transaction Fees',
  'gasUsed': 'Gas Used'
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
    } else {
      content.classList.remove('active');
    }
  });
}

// Fetch data and display chart for the selected metric and chain
async function fetchAndDisplayData(metricType, chainId) {
  console.log(`Fetching ${metricType} for chain ${chainId}`);
  
  // Get the human-friendly metric name
  const metricDisplayName = metricDisplayNames[metricType] || 'Active Addresses';
  
  // Show loading state
  const runBtn = runButtons[metricType];
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.textContent = 'Loading...';
  }
  
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
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.textContent = 'Run Query';
      }
      return;
    }
    
    const { results } = result.data;
    console.log(`Data received: ${results.length} data points`);
    
    if (results.length === 0) {
      console.error('No data received from API');
      alert('No data available for the selected parameters.');
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.textContent = 'Run Query';
      }
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
    
    // Get chain name for display
    const selectElement = chainSelects[metricType];
    const selectedOption = selectElement ? selectElement.options[selectElement.selectedIndex] : null;
    const chainName = selectedOption ? selectedOption.text : 'Unknown Chain';
    
    console.log(`Creating chart for ${chainName} (ID: ${chainId})`);
    
    // Get the canvas for this metric
    const canvas = chartCanvases[metricType];
    if (!canvas) {
      console.error(`Canvas not found for metric: ${metricType}`);
      return;
    }
    
    // Destroy previous chart instance if exists
    if (charts[metricType]) {
      charts[metricType].destroy();
    }
    
    // Create new chart
    charts[metricType] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: `${metricDisplayName} / day`,
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
              text: metricDisplayName
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
            text: `${metricDisplayName} on ${chainName} (${actualStartDate} to ${actualEndDate})`,
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
    console.error(`Error fetching ${metricType} data:`, err);
    alert(`Error: ${err.message || 'Unknown error occurred'}`);
  } finally {
    // Re-enable button
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.textContent = 'Run Query';
    }
  }
}

// Update KPI values for blockchain trends
async function updateBlockchainKpis() {
  try {
    // Get change data for different time periods
    const change7d = await window.metricsApi.calculateChange('fetchSupportedBlockchains', 7);
    const change30d = await window.metricsApi.calculateChange('fetchSupportedBlockchains', 30);
    const change90d = await window.metricsApi.calculateChange('fetchSupportedBlockchains', 90);
    const change365d = await window.metricsApi.calculateChange('fetchSupportedBlockchains', 365);
    
    // Update 7-day KPI
    document.getElementById('kpi-7d').textContent = change7d.current;
    const kpi7dChange = document.getElementById('kpi-7d-change');
    if (change7d.change === 0) {
      kpi7dChange.textContent = 'No change';
      kpi7dChange.className = 'kpi-change neutral';
    } else {
      const sign = change7d.change > 0 ? '+' : '';
      kpi7dChange.textContent = `${sign}${change7d.change} (${sign}${change7d.percentChange}%)`;
      kpi7dChange.className = 'kpi-change ' + (change7d.change > 0 ? 'positive' : 'negative');
    }
    
    // Update 30-day KPI
    document.getElementById('kpi-30d').textContent = change30d.current;
    const kpi30dChange = document.getElementById('kpi-30d-change');
    if (change30d.change === 0) {
      kpi30dChange.textContent = 'No change';
      kpi30dChange.className = 'kpi-change neutral';
    } else {
      const sign = change30d.change > 0 ? '+' : '';
      kpi30dChange.textContent = `${sign}${change30d.change} (${sign}${change30d.percentChange}%)`;
      kpi30dChange.className = 'kpi-change ' + (change30d.change > 0 ? 'positive' : 'negative');
    }
    
    // Update 90-day KPI
    document.getElementById('kpi-90d').textContent = change90d.current;
    const kpi90dChange = document.getElementById('kpi-90d-change');
    if (change90d.change === 0) {
      kpi90dChange.textContent = 'No change';
      kpi90dChange.className = 'kpi-change neutral';
    } else {
      const sign = change90d.change > 0 ? '+' : '';
      kpi90dChange.textContent = `${sign}${change90d.change} (${sign}${change90d.percentChange}%)`;
      kpi90dChange.className = 'kpi-change ' + (change90d.change > 0 ? 'positive' : 'negative');
    }
    
    // Update 365-day KPI
    document.getElementById('kpi-365d').textContent = change365d.current;
    const kpi365dChange = document.getElementById('kpi-365d-change');
    if (change365d.change === 0) {
      kpi365dChange.textContent = 'No change';
      kpi365dChange.className = 'kpi-change neutral';
    } else {
      const sign = change365d.change > 0 ? '+' : '';
      kpi365dChange.textContent = `${sign}${change365d.change} (${sign}${change365d.percentChange}%)`;
      kpi365dChange.className = 'kpi-change ' + (change365d.change > 0 ? 'positive' : 'negative');
    }
    
    console.log('Updated blockchain KPIs successfully');
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
  
  try {
    // Call the API exposed by preload
    const result = await window.avaxApi.fetchSupportedBlockchains();
    console.log(`Blockchain API call ${result.ok ? 'successful' : 'failed'}: ${result.status}`);
    
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
    
    // Update blockchain KPIs after fetching data
    await updateBlockchainKpis();
    
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
    
    console.log('Blockchain table and dropdowns populated successfully');
  } catch (err) {
    console.error('Blockchain API call error:', err);
    blockchainListStatus.textContent = `Error: ${err.message || 'An unexpected error occurred'}`;
    totalChainsEl.textContent = '-';
  }
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
      fetchAndDisplayData(activeTab, chainSelect.value);
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

