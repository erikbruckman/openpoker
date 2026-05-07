import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';

import { SocketController } from './controllers/SocketController';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const corsOrigin: string | string[] = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : '*';

const app = express();
app.use(cors({ origin: corsOrigin }));
app.use(express.static(path.join(__dirname, '../public')));

app.get('/health', (_req, res) => {
  res.send('ok');
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
});

new SocketController(io);

httpServer.listen(PORT, () => {
  console.log(`[Server] Socket.io server running on port ${PORT}`);
});
