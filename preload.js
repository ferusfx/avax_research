const { contextBridge } = require('electron');
const db = require('./db'); // Import our database module
let AvaCloudSDK;
let avaCloudSDK;

// Load AvaCloud SDK
try {
  const avacloudSdk = require('@avalabs/avacloud-sdk');
  AvaCloudSDK = avacloudSdk.AvaCloudSDK;
  
  console.log('[Preload] Successfully imported AvaCloudSDK');
  
  // Initialize the SDK without setting a default chain ID
  avaCloudSDK = new AvaCloudSDK({
    serverURL: "https://metrics.avax.network",
  });
  
  console.log('[Preload] Successfully initialized AvaCloudSDK');
  
  // Log available methods to help with debugging
  console.log('[Preload] Available SDK methods:', {
    metrics: Object.keys(avaCloudSDK.metrics || {}),
    chains: Object.keys(avaCloudSDK.metrics?.chains || {}),
    methods: Object.getOwnPropertyNames(Object.getPrototypeOf(avaCloudSDK.metrics?.chains || {}))
  });
  
  // Log metrics-specific methods for deeper analysis
  try {
    // Get available metrics methods for debugging
    const metricsKeys = Object.keys(avaCloudSDK.metrics || {});
    const chainsMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(avaCloudSDK.metrics?.chains || {}));
    
    console.log('[Preload] Available metrics methods:', metricsKeys);
    console.log('[Preload] Available chains methods:', chainsMethods);
    
    // Try to discover method signatures for better compatibility
    if (avaCloudSDK.metrics.chains.getMetrics) {
      console.log('[Preload] getMetrics method found, checking expected parameters...');
      // This will help us understand which parameters are required
    }
  } catch (err) {
    console.error('[Preload] Error inspecting SDK methods:', err);
  }
} catch (error) {
  console.error('[Preload] Error loading or initializing AvaCloudSDK:', error.message);
  console.error('[Preload] Stack trace:', error.stack);
}

/**
 * Fetch metrics using AvaCloudSDK
 * Supports different metric types and chains
 */
async function fetchMetrics(startTs, endTs, metricType, chainId) {
  try {
    const formattedStart = new Date(startTs * 1000).toLocaleDateString();
    const formattedEnd = new Date(endTs * 1000).toLocaleDateString();
    
    console.log(`[Preload] Fetching ${metricType} for chain ${chainId} from ${formattedStart} to ${formattedEnd}`);
    
    // Default to C-Chain if no chainId provided
    if (!chainId) {
      chainId = "43114"; // C-Chain ID
      console.log(`[Preload] No chainId provided, defaulting to C-Chain (${chainId})`);
    }
    
    // Ensure chainId is a number for the SDK
    const numericChainId = parseInt(chainId, 10);
    console.log(`[Preload] Using chain ID: ${numericChainId} (parsed from: ${chainId})`);
    
    if (isNaN(numericChainId)) {
      console.error(`[Preload] Invalid chain ID: ${chainId}`);
      return {
        ok: false,
        status: 400,
        data: null,
        error: `Invalid chain ID: ${chainId}`
      };
    }
    
    // Convert timestamps to ISO strings for SDK
    const startDate = new Date(startTs * 1000).toISOString();
    const endDate = new Date(endTs * 1000).toISOString();
    
    // Initialize the result object
    const result = {
      ok: true,
      status: 200,
      data: { results: [] },
      error: null
    };
    
    // Check if we have a valid SDK instance
    if (!avaCloudSDK || !avaCloudSDK.metrics) {
      throw new Error("AvaCloudSDK is not properly initialized");
    }
    
    // Construct SDK parameters
    const params = {
      evmChainId: numericChainId,
      startTime: startDate,
      endTime: endDate,
      timeInterval: "day"
    };
    
    console.log(`[Preload] SDK params:`, params);
    
    // Parameters for the new getMetrics API
    const getMetricsParams = {
      metric: metricType,
      startTimestamp: Math.floor(new Date(startDate).getTime() / 1000),
      endTimestamp: Math.floor(new Date(endDate).getTime() / 1000),
      timeInterval: "day",
      pageSize: 2000,
      chainId: String(numericChainId), // Must be a string according to the API schema
    };
    
    console.log(`[Preload] getMetrics params:`, getMetricsParams);
    
    // Call the appropriate metrics method based on the requested metric type
    let metricsIterator;
    try {
      // Try the new getMetrics API first
      console.log(`[Preload] Trying SDK metrics.chains.getMetrics for ${metricType}`);
      
      // Check if the SDK has a getMetrics method
      if (typeof avaCloudSDK.metrics.chains.getMetrics === 'function') {
        console.log(`[Preload] Using chains.getMetrics with params:`, getMetricsParams);
        metricsIterator = await avaCloudSDK.metrics.chains.getMetrics(getMetricsParams);
      } 
      // If getMetrics isn't available, try to use the specific metric method
      else if (typeof avaCloudSDK.metrics.chains[metricType] === 'function') {
        console.log(`[Preload] Found direct method for ${metricType} with params:`, params);
        metricsIterator = await avaCloudSDK.metrics.chains[metricType](params);
      }
      // Try using the metrics API directly
      else if (typeof avaCloudSDK.metrics[metricType] === 'function') {
        console.log(`[Preload] Using metrics.${metricType} directly with params:`, params);
        metricsIterator = await avaCloudSDK.metrics[metricType](params);
      }
      // Try using general query methods
      else if (typeof avaCloudSDK.metrics.queryMetrics === 'function') {
        console.log(`[Preload] Using metrics.queryMetrics with params:`, {
          ...params,
          metric: metricType
        });
        metricsIterator = await avaCloudSDK.metrics.queryMetrics({
          ...params,
          metric: metricType
        });
      } 
      else if (typeof avaCloudSDK.metrics.chains.query === 'function') {
        console.log(`[Preload] Using metrics.chains.query with params:`, {
          ...params,
          metric: metricType
        });
        metricsIterator = await avaCloudSDK.metrics.chains.query({
          ...params,
          metric: metricType
        });
      }
      else {
        // Last resort - try to use a generic metrics endpoint
        console.log(`[Preload] No compatible method found, trying generic approach`);
        
        // Log all available methods for debugging
        console.log('[Preload] Available SDK methods for diagnosis:', {
          metrics: Object.keys(avaCloudSDK.metrics || {}),
          chains: Object.keys(avaCloudSDK.metrics?.chains || {}),
          chainsMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(avaCloudSDK.metrics?.chains || {}))
        });
        
        throw new Error(`No compatible method found for metric type: ${metricType}`);
      }
    } catch (apiError) {
      console.error(`[Preload] API error:`, apiError);
      throw apiError;
    }
    
    // Collect all data from the iterator
    const allResults = [];
    for await (const page of metricsIterator) {
      console.log(`[Preload] Received metrics page:`, page);
      
      // Extract metrics based on response structure
      let metrics = [];
      
      // Direct top-level results array (as per the API documentation)
      if (page.results && Array.isArray(page.results)) {
        console.log('[Preload] Found metrics in top-level results array (standard API format)');
        metrics = page.results;
      } else if (page.result && page.result.results && Array.isArray(page.result.results)) {
        console.log('[Preload] Found metrics in page.result.results array');
        metrics = page.result.results;
      } else if (page.result && Array.isArray(page.result)) {
        console.log('[Preload] Found metrics in page.result array');
        metrics = page.result;
      } else if (page.result && page.result.metrics && Array.isArray(page.result.metrics)) {
        console.log('[Preload] Found metrics in page.result.metrics array');
        metrics = page.result.metrics;
      } else if (Array.isArray(page)) {
        console.log('[Preload] Page itself is an array of metrics');
        metrics = page;
      } else if (page.metrics && Array.isArray(page.metrics)) {
        console.log('[Preload] Found metrics in page.metrics array');
        metrics = page.metrics;
      }
      
      // Convert SDK response format to match the expected format
      if (metrics.length > 0) {
        console.log(`[Preload] Successfully extracted ${metrics.length} metrics from response`);
        console.log(`[Preload] First metric sample:`, metrics[0]);
        
        const formattedMetrics = metrics.map(metric => {
          // Check if the timestamp is already a unix timestamp (seconds since epoch)
          let timestamp;
          if (typeof metric.timestamp === 'number') {
            // If it's already a number, check if it's in seconds or milliseconds
            if (metric.timestamp > 10000000000) { // milliseconds timestamp will be much larger (after 2001 in ms)
              // Convert from milliseconds to seconds if needed
              timestamp = Math.floor(metric.timestamp / 1000);
              console.log(`[Preload] Converting millisecond timestamp ${metric.timestamp} to second timestamp ${timestamp}`);
            } else {
              // Already in seconds
              timestamp = metric.timestamp;
            }
            
            // Validate the timestamp makes sense by checking the year
            const testDate = new Date(timestamp * 1000);
            if (testDate.getFullYear() < 2010 || testDate.getFullYear() > 2050) {
              console.warn(`[Preload] Suspicious date detected after conversion: ${testDate.toISOString()} from timestamp ${timestamp}`);
              // Use current time as fallback if date is suspicious
              timestamp = Math.floor(Date.now() / 1000);
            }
          } else if (metric.timestamp) {
            // If it's a string date or ISO format, convert to unix timestamp in seconds
            timestamp = Math.floor(new Date(metric.timestamp).getTime() / 1000);
            console.log(`[Preload] Converting date string/object ${metric.timestamp} to timestamp ${timestamp}`);
          } else {
            // No valid timestamp, use current time as fallback
            timestamp = Math.floor(Date.now() / 1000);
            console.log(`[Preload] No valid timestamp found, using current time: ${timestamp}`);
          }
          
          return {
            timestamp: timestamp,
            value: metric.value
          };
        });
        
        allResults.push(...formattedMetrics);
      } else {
        console.error('[Preload] No metrics found in the response. Full response:', JSON.stringify(page, null, 2));
        
        // Last-ditch effort - try to find any array property with values that might contain metrics
        if (page.result && typeof page.result === 'object') {
          for (const [key, value] of Object.entries(page.result)) {
            if (Array.isArray(value) && value.length > 0 && value[0].value !== undefined) {
              console.log(`[Preload] Found potential metrics array in page.result.${key}`);
              const potentialMetrics = value.map(item => {
                // Same timestamp logic as above for consistency
                let timestamp;
                if (typeof item.timestamp === 'number') {
                  if (item.timestamp > 10000000000) { // if in milliseconds (after 2001 in ms)
                    timestamp = Math.floor(item.timestamp / 1000);
                  } else {
                    timestamp = item.timestamp;
                  }
                  
                  // Validate the timestamp makes sense
                  const testDate = new Date(timestamp * 1000);
                  if (testDate.getFullYear() < 2010 || testDate.getFullYear() > 2050) {
                    console.warn(`[Preload] Suspicious date detected in fallback: ${testDate.toISOString()}`);
                    timestamp = Math.floor(Date.now() / 1000);
                  }
                } else if (item.timestamp) {
                  timestamp = Math.floor(new Date(item.timestamp).getTime() / 1000);
                } else {
                  timestamp = Math.floor(Date.now() / 1000);
                }
                
                return {
                  timestamp: timestamp,
                  value: item.value !== undefined ? item.value : 0
                };
              });
              allResults.push(...potentialMetrics);
              break;
            }
          }
        }
      }
    }
    
    // Sort results by timestamp (newest first)
    allResults.sort((a, b) => b.timestamp - a.timestamp);
    
    result.data.results = allResults;
    console.log(`[Preload] Collected ${allResults.length} data points using SDK`);
    
    // Log first and last data points for debugging
    if (allResults.length > 0) {
      const first = allResults[0];
      const last = allResults[allResults.length - 1];
      
      console.log(`[Preload] First data point: ${new Date(first.timestamp * 1000).toLocaleDateString()} (${first.timestamp})`);
      console.log(`[Preload] Last data point: ${new Date(last.timestamp * 1000).toLocaleDateString()} (${last.timestamp})`);
    } else {
      console.error('[Preload] No data points were extracted from the API response');
      
      // Try once more with the raw response if available
      if (metricsIterator && metricsIterator._response) {
        console.log('[Preload] Attempting to extract data from raw response');
        try {
          const rawData = await metricsIterator._response.json();
          if (rawData && typeof rawData === 'object') {
            console.log('[Preload] Raw response data:', rawData);
            // Try to find arrays in the response that might contain our metrics
            const findArrays = (obj, path = '') => {
              if (!obj) return [];
              
              let arrays = [];
              for (const [key, value] of Object.entries(obj)) {
                const newPath = path ? `${path}.${key}` : key;
                if (Array.isArray(value) && value.length > 0) {
                  arrays.push({ path: newPath, data: value });
                } else if (typeof value === 'object') {
                  arrays = arrays.concat(findArrays(value, newPath));
                }
              }
              return arrays;
            };
            
            const potentialArrays = findArrays(rawData);
            console.log('[Preload] Found potential data arrays:', potentialArrays.map(a => a.path));
            
            // Look for arrays that might contain metrics data
            for (const arr of potentialArrays) {
              if (arr.data[0] && (arr.data[0].value !== undefined || arr.data[0].timestamp !== undefined)) {
                console.log(`[Preload] Found potential metrics in ${arr.path}`);
                const metrics = arr.data.map(item => ({
                  timestamp: item.timestamp ? 
                    (typeof item.timestamp === 'number' && item.timestamp > 10000000000 ? 
                      Math.floor(item.timestamp / 1000) : 
                      Math.floor(new Date(item.timestamp).getTime() / 1000)) : 
                    Math.floor(Date.now() / 1000),
                  value: item.value !== undefined ? item.value : 0
                }));
                
                if (metrics.length > 0 && metrics[0].timestamp) {
                  allResults.push(...metrics);
                  break;
                }
              }
            }
          }
        } catch (e) {
          console.error('[Preload] Failed to extract from raw response:', e);
        }
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('[Preload] Fetch metrics error:', error);
    
    // Create a more user-friendly error message
    let errorMessage = error.message; 

    return {
      ok: false,
      status: 0,
      data: null,
      error: errorMessage
    };
  }
}

/**
 * Fetch the list of supported blockchains from AvaCloud API
 */
async function fetchSupportedBlockchains() {
  try {
    console.log('[Preload] Fetching supported blockchains...');
    
    const result = {
      ok: true,
      status: 200,
      data: { chains: [] },
      error: null
    };
    
    if (!avaCloudSDK || !avaCloudSDK.metrics) {
      throw new Error("AvaCloudSDK is not properly initialized");
    }
    
    try {
      const chainsList = await avaCloudSDK.metrics.chains.list({
        network: "mainnet",
      });
      
      console.log('[Preload] Received chainsList iterator from SDK');
      
      // Collect all pages of results
      const chains = [];
      for await (const page of chainsList) {
        console.log('[Preload] Received blockchain page:', JSON.stringify(page));
        
        // Extract chains from different possible response structures
        let extractedChains = [];
        if (page.result && typeof page.result === 'object') {
          // Handle the case where page = { result: { ... } }
          if (page.result.chains && Array.isArray(page.result.chains)) {
            extractedChains = page.result.chains;
            console.log('[Preload] Found chains in page.result.chains');
          } else if (Array.isArray(page.result)) {
            extractedChains = page.result;
            console.log('[Preload] Found chains in page.result array');
          } else if (page.result.chainName || page.result.evmChainId) {
            extractedChains = [page.result];
            console.log('[Preload] Found single chain in page.result');
          }
        } else if (page.chains && Array.isArray(page.chains)) {
          extractedChains = page.chains;
          console.log('[Preload] Found chains in page.chains array');
        } else if (Array.isArray(page)) {
          extractedChains = page;
          console.log('[Preload] Page itself is an array of chains');
        } else if (page.chainName || page.evmChainId) {
          extractedChains = [page];
          console.log('[Preload] Page itself is a single chain object');
        }
        
        console.log(`[Preload] Extracted ${extractedChains.length} chains from this page`);
        
        // Make sure chain IDs are strings for consistent comparison
        extractedChains = extractedChains.map(chain => {
          // Always stringify evmChainId for consistent handling
          const stringifiedChain = {
            ...chain,
            evmChainId: chain.evmChainId !== undefined ? chain.evmChainId.toString() : undefined
          };
          
          console.log(`[Preload] Processed chain: ${stringifiedChain.chainName || 'unnamed'} (ID: ${stringifiedChain.evmChainId})`);
          return stringifiedChain;
        });
        
        chains.push(...extractedChains);
      }
      
      // Filter out any chains without an evmChainId
      const validChains = chains.filter(chain => chain.evmChainId);
      console.log(`[Preload] Filtered to ${validChains.length} chains with valid EVMChainIDs`);
      
      result.data = { chains: validChains };
      console.log(`[Preload] Received ${validChains.length} blockchains`);
      
      // Log metric to database
      db.logApiMetric('fetchSupportedBlockchains', validChains.length);
    } catch (apiError) {
      console.error('[Preload] AvaCloud API error:', apiError);
      result.ok = false;
      result.status = apiError.status || 500;
      result.error = apiError.message || 'Error fetching blockchain list';
    }
    
    return result;
  } catch (error) {
    console.error('[Preload] Fetch blockchains error:', error);
    return {
      ok: false,
      status: 0,
      data: null,
      error: error.message
    };
  }
}

/**
 * Fetch blockchain list with creation dates from Glacier API
 */
async function glacierListBlockchains() {
  try {
    console.log('[Preload] Fetching blockchains from Glacier API...');
    
    const result = {
      ok: true,
      status: 200,
      data: { blockchains: [] },
      error: null
    };
    
    // Set up headers with the API key
    const headers = {
      'x-glacier-api-key': 'ac_iqDte1gB5XmdqdtOWEvdzfu6p8K3X09z0jNWz0EpkZ8eFUQefL-3xXHRzaQARr92ckttFTzVpIecL0Mg8uofvA',
      'Content-Type': 'application/json'
    };
    
    try {
      // Use direct fetch instead of SDK to avoid validation errors
      console.log('[Preload] Using direct fetch to Glacier API...');
      
      // Use the correct URL structure based on the API documentation
      const apiUrl = 'https://glacier-api.avax.network/v1/networks/mainnet/blockchains?pageSize=2000';
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: headers
      });
      
      if (!response.ok) {
        const responseText = await response.text();
        console.error(`[Preload] Glacier API error response: ${responseText}`);
        throw new Error(`Glacier API responded with status: ${response.status} - ${responseText.substring(0, 100)}`);
      }
      
      const data = await response.json();
      console.log('[Preload] Received direct response from Glacier API:', 
        JSON.stringify(data).substring(0, 200) + '...');
      
      // Extract blockchains from the response
      let blockchains = [];
      
      if (data.blockchains && Array.isArray(data.blockchains)) {
        blockchains = data.blockchains;
        console.log(`[Preload] Found ${blockchains.length} blockchains in data.blockchains`);
      } else if (data.Result && data.Result.blockchains && Array.isArray(data.Result.blockchains)) {
        blockchains = data.Result.blockchains;
        console.log(`[Preload] Found ${blockchains.length} blockchains in data.Result.blockchains`);
      } else if (Array.isArray(data)) {
        blockchains = data;
        console.log(`[Preload] Response itself is an array with ${blockchains.length} blockchains`);
      } else {
        console.error('[Preload] Could not find blockchains array in response');
        console.log('[Preload] Response structure:', Object.keys(data));
        
        // If we can't find a proper structure, check all properties
        for (const [key, value] of Object.entries(data)) {
          if (Array.isArray(value)) {
            console.log(`[Preload] Found array in response.${key} with ${value.length} items`);
            if (value.length > 0 && (value[0].blockchainId || value[0].createBlockTimestamp || value[0].name)) {
              blockchains = value;
              console.log(`[Preload] Using ${key} as blockchains array`);
              break;
            }
          } else if (typeof value === 'object' && value !== null) {
            for (const [subKey, subValue] of Object.entries(value)) {
              if (Array.isArray(subValue)) {
                console.log(`[Preload] Found array in response.${key}.${subKey} with ${subValue.length} items`);
                if (subValue.length > 0 && (subValue[0].blockchainId || subValue[0].createBlockTimestamp || subValue[0].name)) {
                  blockchains = subValue;
                  console.log(`[Preload] Using ${key}.${subKey} as blockchains array`);
                  break;
                }
              }
            }
          }
        }
      }
      
      // Process and format each blockchain
      const formattedBlockchains = blockchains.map(blockchain => {
        // Extract creation timestamp, supporting different field names
        const createBlockTimestamp = 
          blockchain.createBlockTimestamp || 
          blockchain.createTimestamp || 
          blockchain.created ||
          blockchain.createdAt ||
          blockchain.timestamp;
          
        // Format createBlockTimestamp as a date string if available
        let createDate = null;
        if (createBlockTimestamp) {
          // Convert to seconds if in milliseconds
          const timestamp = createBlockTimestamp > 10000000000 
            ? Math.floor(createBlockTimestamp / 1000) 
            : createBlockTimestamp;
            
          createDate = new Date(timestamp * 1000);
          
          // Validate the date is reasonable
          if (createDate.getFullYear() < 2010 || createDate.getFullYear() > 2050) {
            console.warn(`[Preload] Suspicious creation date detected: ${createDate.toISOString()} from timestamp ${timestamp}`);
            createDate = null;
          }
        }
        
        // Handle different field naming conventions
        const evmChainId = 
          blockchain.evmChainId || 
          blockchain.evm_chain_id || 
          blockchain.chainId || 
          blockchain.chain_id;
          
        const blockchainName = 
          blockchain.blockchainName || 
          blockchain.blockchain_name || 
          blockchain.name ||
          blockchain.chainName;
        
        return {
          ...blockchain,
          createBlockTimestamp: createBlockTimestamp,
          blockchainName: blockchainName,
          // Convert evmChainId to string for consistent comparisons
          evmChainId: evmChainId ? evmChainId.toString() : undefined,
          // Add a formatted date string for display
          formattedCreateDate: createDate ? formatDate(createDate) : 'N/A'
        };
      });
      
      // Filter out any blockchains without an evmChainId
      const validBlockchains = formattedBlockchains.filter(blockchain => blockchain.evmChainId);
      console.log(`[Preload] Filtered to ${validBlockchains.length} blockchains with valid EVMChainIDs from ${formattedBlockchains.length} total`);
      
      // Log complete data for debugging if we have no valid blockchains
      if (validBlockchains.length === 0 && formattedBlockchains.length > 0) {
        console.log('[Preload] No valid blockchains found with evmChainId. Sample data:', 
          formattedBlockchains.slice(0, 3).map(b => JSON.stringify(b)));
      }
      
      result.data = { blockchains: validBlockchains };
      console.log(`[Preload] Received ${validBlockchains.length} blockchains from Glacier API`);
      
      // Log the first few blockchains for debugging
      if (validBlockchains.length > 0) {
        console.log('[Preload] Sample blockchain data:', 
          validBlockchains.slice(0, 3).map(b => ({
            name: b.blockchainName || b.blockchain_name || b.name || 'unknown',
            evmChainId: b.evmChainId,
            createTimestamp: b.createBlockTimestamp,
            formattedDate: b.formattedCreateDate,
            allKeys: Object.keys(b)
          }))
        );
      }
      
      // Log metric to database
      db.logApiMetric('glacierListBlockchains', validBlockchains.length);
    } catch (apiError) {
      console.error('[Preload] Glacier API error:', apiError);
      result.ok = false;
      result.status = apiError.status || 500;
      result.error = apiError.message || 'Error fetching blockchain list from Glacier API';
    }
    
    return result;
  } catch (error) {
    console.error('[Preload] Glacier list blockchains error:', error);
    return {
      ok: false,
      status: 0,
      data: null,
      error: error.message
    };
  }
}

// Helper function to format date as DD.MM.YYYY
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/* Expose a minimal, safe surface to the renderer */
contextBridge.exposeInMainWorld('avaxApi', {
  fetchMetrics,
  fetchSupportedBlockchains,
  glacierListBlockchains
});

/* Expose metrics functions to renderer */
contextBridge.exposeInMainWorld('metricsApi', {
  getLatestMetric: (functionName) => db.getLatestMetric(functionName),
  calculateChange: (functionName, days) => db.calculateChange(functionName, days),
  getMetricsForPeriod: (functionName, days) => db.getMetricsForPeriod(functionName, days)
});