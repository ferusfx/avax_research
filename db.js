const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure the data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Create or open the database
const db = new Database(path.join(dataDir, 'metrics.db'));

// Initialize tables
function initDatabase() {
  // Create the api_metrics table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      function_name TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      count INTEGER NOT NULL,
      formatted_date TEXT NOT NULL
    )
  `);
  
  console.log('[DB] Database initialized');
}

// Format date as DD.MM.YYYY HH:MM:SS
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}

// Log API metric
function logApiMetric(functionName, count) {
  const now = new Date();
  const timestamp = Math.floor(now.getTime() / 1000);
  const formattedDate = formatDate(now);
  
  const insert = db.prepare(`
    INSERT INTO api_metrics (function_name, timestamp, count, formatted_date)
    VALUES (?, ?, ?, ?)
  `);
  
  const info = insert.run(functionName, timestamp, count, formattedDate);
  console.log(`[DB] Logged metric for ${functionName}: ${count} items at ${formattedDate}`);
  
  return info;
}

// Get the latest metric for a function
function getLatestMetric(functionName) {
  const query = db.prepare(`
    SELECT * FROM api_metrics
    WHERE function_name = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `);
  
  return query.get(functionName);
}

// Get metric from X days ago
function getMetricFromDaysAgo(functionName, days) {
  const now = new Date();
  const pastDate = new Date(now);
  pastDate.setDate(pastDate.getDate() - days);
  const pastTimestamp = Math.floor(pastDate.getTime() / 1000);
  
  const query = db.prepare(`
    SELECT * FROM api_metrics
    WHERE function_name = ? AND timestamp <= ?
    ORDER BY timestamp DESC
    LIMIT 1
  `);
  
  return query.get(functionName, pastTimestamp);
}

// Calculate change over time period (days)
function calculateChange(functionName, days) {
  const latest = getLatestMetric(functionName);
  if (!latest) {
    return { current: 0, previous: 0, change: 0, percentChange: 0 };
  }
  
  const previous = getMetricFromDaysAgo(functionName, days);
  if (!previous || previous.id === latest.id) {
    return { 
      current: latest.count, 
      previous: latest.count, 
      change: 0, 
      percentChange: 0,
      currentDate: latest.formatted_date,
      previousDate: previous ? previous.formatted_date : 'N/A'
    };
  }
  
  const change = latest.count - previous.count;
  const percentChange = ((change / previous.count) * 100).toFixed(2);
  
  return {
    current: latest.count,
    previous: previous.count,
    change: change,
    percentChange: parseFloat(percentChange),
    currentDate: latest.formatted_date,
    previousDate: previous.formatted_date
  };
}

// Get all metrics for a specific period
function getMetricsForPeriod(functionName, days) {
  const now = new Date();
  const pastDate = new Date(now);
  pastDate.setDate(pastDate.getDate() - days);
  const pastTimestamp = Math.floor(pastDate.getTime() / 1000);
  
  const query = db.prepare(`
    SELECT * FROM api_metrics
    WHERE function_name = ? AND timestamp >= ?
    ORDER BY timestamp ASC
  `);
  
  return query.all(functionName, pastTimestamp);
}

// Initialize the database
initDatabase();

module.exports = {
  logApiMetric,
  getLatestMetric,
  calculateChange,
  getMetricsForPeriod
};
