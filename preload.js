const { contextBridge } = require('electron');

/**
 * Build the AVAX active-addresses API URL for the given time span.
 */
function buildApiUrl(startTs, endTs) {
  // The API seems to have limitations on how far back data is available
  // Ensure we're requesting a valid date range with this endpoint
  return (
    'https://metrics.avax.network/v2/chains/43114/metrics/activeAddresses' +
    `?startTimestamp=${startTs}&endTimestamp=${endTs}` +
    '&timeInterval=day&pageSize=2000'
  );
}

/**
 * Call the AVAX metrics API and return { ok, status, data }.
 */
async function fetchActiveAddresses(startTs, endTs) {
  try {
    const formattedStart = new Date(startTs * 1000).toLocaleDateString();
    const formattedEnd = new Date(endTs * 1000).toLocaleDateString();
    
    console.log(`[Preload] Fetching data for range: ${formattedStart} (${startTs}) to ${formattedEnd} (${endTs})`);
    const url = buildApiUrl(startTs, endTs);
    console.log(`[Preload] URL: ${url}`);
    
    const resp = await fetch(url);
    
    const result = {
      ok: resp.ok,
      status: resp.status,
      data: null
    };
    
    if (resp.ok) {
      result.data = await resp.json();
      console.log(`[Preload] Received ${result.data.results?.length || 0} data points`);
      
      // Log first and last data points for debugging
      if (result.data.results && result.data.results.length > 0) {
        const first = result.data.results[0];
        const last = result.data.results[result.data.results.length - 1];
        
        console.log(`[Preload] First data point: ${new Date(first.timestamp * 1000).toLocaleDateString()} (${first.timestamp})`);
        console.log(`[Preload] Last data point: ${new Date(last.timestamp * 1000).toLocaleDateString()} (${last.timestamp})`);
        console.log(`[Preload] Note: API data may be limited to a specific date range regardless of request params`);
      }
    }
    
    return result;
  } catch (error) {
    console.error('[Preload] Fetch error:', error);
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
  fetchActiveAddresses
});