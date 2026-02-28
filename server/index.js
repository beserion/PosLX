import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import productsRouter from './routes/products.js';
import salesRouter from './routes/sales.js';
import couriersRouter from './routes/couriers.js';
import categoriesRouter from './routes/categories.js';
import transactionsRouter from './routes/transactions.js';
import invoicesRouter from './routes/invoices.js';
import accountsRouter from './routes/accounts.js';
import ordersRouter from './routes/orders.js';
import { setupCourierSocket } from './sockets/courierSocket.js';
import { getDb } from './config/db.js';

dotenv.config();

// Keep native __dirname provided by CJS/pkg instead of redefining it.
// If not defined (unlikely in CJS/pkg), fallback to cwd.
const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

const app = express();
const httpServer = createServer(app);

// Socket.io
const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
});
setupCourierSocket(io);

// Middleware
app.use(cors());
app.use(express.json());

// REST routes
app.use('/api/products', productsRouter);
app.use('/api/sales', salesRouter);
app.use('/api/couriers', couriersRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/orders', ordersRouter);

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React Frontend (Static Files)
// In pkg snapshot, __dirname refers to the directory where the entry point is located,
// which is /snapshot/poslx-server/build
const clientDistPath = path.join(currentDir, 'public');
app.use(express.static(clientDistPath));

// Catch-all route to serve the React index.html for unknown routes (client-side routing)
app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Start
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, async () => {
    console.log(`🚀 PosLX server running on http://localhost:${PORT}`);
    // Initialize SQLite DB
    getDb();
});
