# Avalanche C-Chain Active Address Metrics Visualizer

An Electron desktop application that visualizes Avalanche C-Chain active address metrics over a specified date range.

## Features

- **Interactive Date Range Selection**: Use a dual-handle slider to select custom date ranges
- **Quick Filters**: Easily visualize data for the last 7, 14, 30, 90 days, or 1 year
- **Dynamic Chart Visualization**: Data is displayed in an interactive bar chart using Chart.js
- **Error Handling**: Robust error reporting and user feedback
- **Modern UI**: Clean and responsive interface

## Screenshots

(Add screenshots here)

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/ferusfx/avax_research.git
   ```

2. Navigate to the project directory:
   ```
   cd avax_research
   ```

3. Create a configuration file:
   ```
   cp config.example.json config.json
   ```

4. Edit the config.json file and add your Glacier API key:
   ```json
   {
     "apiKeys": {
       "glacier": "YOUR_GLACIER_API_KEY_HERE"
     }
   }
   ```

5. Install dependencies:
   ```
   npm install
   ```

6. Start the application:
   ```
   npm start
   ```

## Tech Stack

- Electron: Cross-platform desktop application framework
- Chart.js: Interactive chart visualization
- noUiSlider: Date range selection
- HTML/CSS/JavaScript: Frontend development

## API Keys

This application requires an API key from the Glacier API. To get a key:

1. Visit the Avalanche developer portal
2. Register for an API key
3. Add the key to your config.json file

The config.json file is included in .gitignore to prevent accidentally committing your API key.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)
