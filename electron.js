const { app, BrowserWindow } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  win.loadFile('index.html'); // Nếu cần, sửa thành đường dẫn file web chat
}

app.whenReady().then(createWindow);
