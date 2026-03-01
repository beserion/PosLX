import { spawn } from 'child_process';
import { getDb } from '../config/db.js';

let tunnelProcess = null;
let tunnelUrl = null;
let tunnelStartedAt = null;
let restarting = false;
const RESTART_DELAY_MS = 5000;

/**
 * Save the public tunnel URL to system_settings.
 */
function saveTunnelUrl(url) {
    try {
        const db = getDb();
        if (db) {
            db.prepare("INSERT INTO system_settings (key, value) VALUES ('public_tunnel_url', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
                .run(url || '');
        }
    } catch (err) {
        console.error('❌ Failed to save tunnel URL:', err.message);
    }
}

/**
 * Parse the public URL from cloudflared output.
 * Cloudflared prints a line like:
 *   | https://random-name.trycloudflare.com |
 * or
 *   INF +-------------------------------------------+
 *   INF | https://random-name.trycloudflare.com     |
 *   INF +-------------------------------------------+
 */
function parseUrl(data) {
    const str = data.toString();
    // Match https://*.trycloudflare.com
    const match = str.match(/(https:\/\/[a-zA-Z0-9\-]+\.trycloudflare\.com)/);
    return match ? match[1] : null;
}

/**
 * Start a cloudflare quick tunnel that exposes the given port.
 */
export function startTunnel(port) {
    if (tunnelProcess) {
        console.log('⚠️  Tunnel already running, skipping start.');
        return;
    }

    console.log(`🌐 Starting Cloudflare Tunnel for localhost:${port}...`);

    try {
        tunnelProcess = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`], {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
        });
    } catch (err) {
        console.warn('⚠️  cloudflared not found or failed to spawn:', err.message);
        console.warn('⚠️  Tunnel will not be available. Install cloudflared to enable tunnel connectivity.');
        tunnelProcess = null;
        return;
    }

    tunnelProcess.on('error', (err) => {
        console.warn('⚠️  cloudflared not found or failed to spawn:', err.message);
        console.warn('⚠️  Tunnel will not be available. Install cloudflared to enable tunnel connectivity.');
        tunnelProcess = null;
    });

    // Parse URL from both stdout and stderr (cloudflared prints to stderr)
    const handleOutput = (data) => {
        const line = data.toString();
        // Log cloudflared output for debugging
        if (line.trim()) {
            console.log(`[cloudflared] ${line.trim()}`);
        }
        if (!tunnelUrl) {
            const url = parseUrl(line);
            if (url) {
                tunnelUrl = url;
                tunnelStartedAt = Date.now();
                saveTunnelUrl(tunnelUrl);
                console.log(`✅ Tunnel active: ${tunnelUrl}`);
            }
        }
    };

    tunnelProcess.stdout.on('data', handleOutput);
    tunnelProcess.stderr.on('data', handleOutput);

    tunnelProcess.on('close', (code) => {
        console.log(`⚠️  Cloudflared exited with code ${code}`);
        tunnelProcess = null;
        tunnelUrl = null;
        tunnelStartedAt = null;
        saveTunnelUrl('');

        // Auto-restart unless we are deliberately stopping
        if (!restarting) {
            console.log(`🔄 Restarting tunnel in ${RESTART_DELAY_MS / 1000}s...`);
            restarting = true;
            setTimeout(() => {
                restarting = false;
                startTunnel(port);
            }, RESTART_DELAY_MS);
        }
    });
}

/**
 * Stop the tunnel gracefully.
 */
export function stopTunnel() {
    restarting = true; // prevent auto-restart
    if (tunnelProcess) {
        console.log('🛑 Stopping Cloudflare Tunnel...');
        tunnelProcess.kill('SIGTERM');
        tunnelProcess = null;
        tunnelUrl = null;
        tunnelStartedAt = null;
        saveTunnelUrl('');
    }
}

/**
 * Get current tunnel status.
 */
export function getTunnelStatus() {
    return {
        connected: tunnelProcess !== null && tunnelUrl !== null,
        url: tunnelUrl,
        pid: tunnelProcess?.pid || null,
        uptime: tunnelStartedAt ? Math.floor((Date.now() - tunnelStartedAt) / 1000) : 0,
    };
}
