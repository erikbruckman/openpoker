"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const SocketController_1 = require("./controllers/SocketController");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
// Basic health check route so visiting the server in a browser doesn't show an error
app.get('/', (req, res) => {
    res.send('OpenPoker WebSocket Server is running! Connect via socket.io to start playing.');
});
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});
new SocketController_1.SocketController(io);
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`[Server] Socket.io server running on port ${PORT}`);
});
