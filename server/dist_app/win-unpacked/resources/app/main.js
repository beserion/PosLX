import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import './index.js'; // Start Express backend

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;

function waitForBackend(url, retries = 60, interval = 500) {
    return new Promise((resolve, reject) => {
        const attempt = (remaining) => {
            http.get(url, (res) => {
                if (res.statusCode === 200) {
                    resolve();
                } else {
                    retry(remaining);
                }
            }).on('error', () => retry(remaining));
        };
        const retry = (remaining) => {
            if (remaining <= 0) return reject(new Error('Backend başlatılamadı'));
            setTimeout(() => attempt(remaining - 1), interval);
        };
        attempt(retries);
    });
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Backend hazır olana kadar bekle, sonra frontend'i yükle
    waitForBackend(`http://localhost:${PORT}/api/health`)
        .then(() => {
            // Cache ve service worker'ları temizle
            return win.webContents.session.clearCache();
        })
        .then(() => {
            return win.webContents.session.clearStorageData({
                storages: ['serviceworkers', 'cachestorage']
            });
        })
        .then(() => {
            win.loadURL(`http://localhost:${PORT}`);
        })
        .catch((err) => {
            console.error('Backend başlatılamadı:', err.message);
            // Yine de yüklemeyi dene
            win.loadURL(`http://localhost:${PORT}`);
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
