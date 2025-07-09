const {app, BrowserWindow} = require('electron');
const path = require('path');

const createWindow = () => {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true, // Enable context isolation for security
      preload: path.join(__dirname, 'preload.js') // Use preload script
    },
  });

  // Load the index.html of the app.
  win.loadFile('index.html');
  win.setMenuBarVisibility(false); // Hide the menu bar
  
  // Open DevTools for debugging
  win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow()
});