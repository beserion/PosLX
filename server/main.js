import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import './index.js'; // Start Express backend

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    const port = process.env.PORT || 3001;

    const loadApp = () => {
        win.loadURL(`http://localhost:${port}`).catch((err) => {
            console.log('Server not ready yet, retrying in 500ms...');
            setTimeout(loadApp, 500);
        });
    };

    // Clear cache and service workers on startup to ensure updates are visible
    win.webContents.session.clearCache().then(() => {
        win.webContents.session.clearStorageData({
            storages: ['serviceworkers', 'cachestorage']
        }).then(() => {
            loadApp();
        });
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
