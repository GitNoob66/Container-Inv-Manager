const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    title: "Container Yard Manager",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const offlineEntry = path.join(__dirname, "..", "offline-dist", "offline-index.html");
  window.loadFile(offlineEntry).catch((error) => {
    dialog.showErrorBox(
      "Container Yard Manager could not start",
      `The offline application files could not be loaded.\n\n${error.message}`,
    );
    app.quit();
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => app.quit());