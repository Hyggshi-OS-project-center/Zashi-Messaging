const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html'); // Nạp file HTML của bạn
}

app.whenReady().then(() => {
  createWindow();
});
