const { app, BrowserWindow } = require('electron');
const activeWin = require('active-win');
const screenshot = require('screenshot-desktop');
const path = require('path');
const fs = require('fs');

let mainWindow;
let lastWindow = null;
let lastSwitchTime = Date.now();
let logFile;

// 📝 Generic log function
function writeLog(level, message, data = '') {
  if (!logFile) return;
  const fullMessage = `[${new Date().toISOString()}] [${level}] ${message} ${data}\n`;
  fs.appendFileSync(logFile, fullMessage);
  console.log(fullMessage);
}

function logInfo(msg, data) {
  writeLog('INFO', msg, data);
}
function logError(msg, err) {
  writeLog('ERROR', msg, err ? err.stack || err : '');
}

async function checkActiveWindow() {
  try {
    const win = await activeWin();

    if (win) {
      if (
        !lastWindow ||
        win.title !== lastWindow.title ||
        win.owner.name !== lastWindow.owner.name
      ) {
        if (lastWindow) {
          const duration = Math.floor((Date.now() - lastSwitchTime) / 1000);

          try {
            // 📸 take screenshot in memory as base64
            const imgBuffer = await screenshot({ format: 'jpg' });
            const base64Image = imgBuffer.toString('base64');

            logInfo(
              'Captured screenshot',
              `App=${lastWindow.owner.name}, Title=${lastWindow.title}, Duration=${duration}s`
            );

            mainWindow.webContents.send('tab-duration', {
              app: lastWindow.owner.name,
              title: lastWindow.title,
              duration,
              screenshot: `data:image/jpeg;base64,${base64Image}`,
            });
          } catch (err) {
            logError('Screenshot failed', err);
          }
        }

        logInfo('Switched window', `App=${win.owner.name}, Title=${win.title}`);
        lastWindow = win;
        lastSwitchTime = Date.now();
      }
    }
  } catch (err) {
    logError('Active window tracking failed', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('index.html');
  setInterval(checkActiveWindow, 2000);
}

app.whenReady().then(() => {
  // 📂 Always create log file
  const logDir = path.join(app.getPath('documents'), 'MyElectronApp');
  fs.mkdirSync(logDir, { recursive: true });
  logFile = path.join(logDir, 'activity.log');

  // Start log
  fs.writeFileSync(
    logFile,
    `[${new Date().toISOString()}] [INFO] Log initialized\n`,
    { flag: 'w' }
  );
  logInfo('App started');

  createWindow();
});

// global error handlers
process.on('uncaughtException', (err) => logError('Uncaught Exception', err));
process.on('unhandledRejection', (reason) =>
  logError('Unhandled Rejection', reason)
);
