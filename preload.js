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
    
    // Call the appropriate metrics method based on the requested metric type
    let metricsIterator;
    switch (metricType) {
      case 'activeAddresses':
        console.log(`[Preload] Calling SDK for activeAddresses`);
        metricsIterator = await avaCloudSDK.metrics.chains.activeAddresses(params);
        break;
        
      case 'transactions':
        console.log(`[Preload] Calling SDK for transactions`);
        metricsIterator = await avaCloudSDK.metrics.chains.transactions(params);
        break;
        
      case 'transactionFees':
        console.log(`[Preload] Calling SDK for transactionFees`);
        metricsIterator = await avaCloudSDK.metrics.chains.transactionFees(params);
        break;
        
      case 'gasUsed':
        console.log(`[Preload] Calling SDK for gasUsed`);
        metricsIterator = await avaCloudSDK.metrics.chains.gasUsed(params);
        break;
        
      default:
        console.log(`[Preload] Unknown metric type: ${metricType}, falling back to activeAddresses`);
        metricsIterator = await avaCloudSDK.metrics.chains.activeAddresses(params);
        break;
    }
    
    // Collect all data from the iterator
    const allResults = [];
    for await (const page of metricsIterator) {
      console.log(`[Preload] Received metrics page:`, page);
      
      // Extract metrics based on response structure
      let metrics = [];
      if (page.result && Array.isArray(page.result)) {
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
      const formattedMetrics = metrics.map(metric => ({
        timestamp: Math.floor(new Date(metric.timestamp).getTime() / 1000),
        value: metric.value
      }));
      
      allResults.push(...formattedMetrics);
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
    }
    
    return result;
    
  } catch (error) {
    console.error('[Preload] Fetch metrics error:', error);
    return {
      ok: false,
      status: 0,
      data: null,
      error: error.message
    };
  }
}

/**
 * Fetch active addresses (for backward compatibility)
 */
async function fetchActiveAddresses(startTs, endTs) {
  console.log('[Preload] fetchActiveAddresses called, using fetchMetrics with C-Chain');
  return fetchMetrics(startTs, endTs, 'activeAddresses', '43114');
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

/* Expose a minimal, safe surface to the renderer */
contextBridge.exposeInMainWorld('avaxApi', {
  fetchActiveAddresses,
  fetchMetrics,
  fetchSupportedBlockchains
});

/* Expose metrics functions to renderer */
contextBridge.exposeInMainWorld('metricsApi', {
  getLatestMetric: (functionName) => db.getLatestMetric(functionName),
  calculateChange: (functionName, days) => db.calculateChange(functionName, days),
  getMetricsForPeriod: (functionName, days) => db.getMetricsForPeriod(functionName, days)
});