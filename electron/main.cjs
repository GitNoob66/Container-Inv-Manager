const { app, BrowserWindow, dialog, ipcMain, clipboard } = require("electron");
const path = require("path");

// Keep every record in a "data" folder beside the EXE so the whole extracted
// folder is portable (USB / any drive). Development runs keep Electron's default.
if (app.isPackaged) {
  app.setPath("userData", path.join(path.dirname(process.execPath), "data"));
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    title: "Container Yard Manager",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Haulage module: copy release memos to the clipboard as rich text
  ipcMain.removeHandler("memo:copy");
  ipcMain.handle("memo:copy", (event, value) => {
    if (event.sender !== window.webContents || typeof value?.html !== "string" || typeof value?.text !== "string" || value.html.length > 10000000 || value.text.length > 1000000) {
      throw new Error("Invalid memo clipboard request.");
    }
    clipboard.write({ html: value.html, text: value.text });
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