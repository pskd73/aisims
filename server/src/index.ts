import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { World } from './game/World.js';
import { WebSocketHandler } from './ws/handler.js';
import { AuthManager } from './auth/AuthManager.js';
import { ExchangeManager } from './exchange/ExchangeManager.js';
import { createExchangeRouter } from './exchange/routes.js';
import { NotificationManager } from './notifications/NotificationManager.js';
import { MemoryManager } from './memory/MemoryManager.js';
import { createMemoryRouter } from './memory/routes.js';
import { createMoveRouter } from './move/routes.js';

const PORT = process.env.PORT || 3001;

// Initialize core systems
const world = new World(10, 10);
const authManager = new AuthManager();
const notificationManager = new NotificationManager();
const memoryManager = new MemoryManager();
const exchangeManager = new ExchangeManager(notificationManager);

// Express app
const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    players: world.getAllPlayers().length
  });
});

// HTTP server
const server = createServer(app);

// WebSocket server - create handler first so we can pass it to routes
const wss = new WebSocketServer({ server });
const wsHandler = new WebSocketHandler(world, authManager, exchangeManager, notificationManager, memoryManager);

// API routes - pass wsHandler for state broadcasting
app.use('/api/exchange', createExchangeRouter(authManager, exchangeManager, world, wsHandler));
app.use('/api/memory', createMemoryRouter(authManager, memoryManager));
app.use('/api/move', createMoveRouter(authManager, world, wsHandler));

wss.on('connection', (ws) => {
  wsHandler.handleConnection(ws);
});

wsHandler.startHeartbeat();

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready`);
  console.log(`Exchange API available at /api/exchange`);
  console.log(`Memory API available at /api/memory`);
  console.log(`Move API available at /api/move`);
  console.log(`Notifications sent via WebSocket heartbeat`);
  console.log(`Heartbeat interval: 5000ms`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  wsHandler.stopHeartbeat();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
