import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';


import { SocketController } from './controllers/SocketController';

const app = express();
app.use(cors());

// Basic health check route so visiting the server in a browser doesn't show an error
app.get('/', (req, res) => {
  res.send('OpenPoker WebSocket Server is running! Connect via socket.io to start playing.');
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

new SocketController(io);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`[Server] Socket.io server running on port ${PORT}`);
});
