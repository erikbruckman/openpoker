import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';

import { RoomManager } from './RoomManager';
import { SocketController } from './controllers/SocketController';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const corsOrigin: string | string[] = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : '*';

const app = express();
app.set('trust proxy', true);

app.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime() });
});

app.use(cors({ origin: corsOrigin }));
app.use(express.static(path.join(__dirname, '../public')));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager();
new SocketController(io, roomManager);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Socket.io server running on port ${PORT}`);
});
