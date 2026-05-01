"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const RoomManager_1 = require("./RoomManager");
const Player_1 = require("./models/Player");
const uuid_1 = require("uuid");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});
const roomManager = RoomManager_1.RoomManager.getInstance();
// Broadcasts the game state to everyone in a room, and private state to individuals
const broadcastGameState = (roomCode) => {
    const game = roomManager.getRoom(roomCode);
    if (!game)
        return;
    const publicState = game.getPublicState();
    io.to(roomCode).emit('gameState', publicState);
    // Send private hole cards to each player
    for (const player of game.players) {
        if (player.socketId) {
            io.to(player.socketId).emit('privateState', game.getPrivateState(player.id));
        }
    }
};
io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);
    socket.on('joinRoom', ({ playerName, roomCode }) => {
        // Leave previous rooms if any
        const oldRoom = roomManager.removePlayerFromAllRooms(socket.id);
        if (oldRoom) {
            socket.leave(oldRoom);
            broadcastGameState(oldRoom);
        }
        const game = roomManager.getOrCreateRoom(roomCode);
        // Create new player with 5000 chips
        const playerId = (0, uuid_1.v4)();
        const newPlayer = new Player_1.Player(playerId, playerName, 5000);
        newPlayer.socketId = socket.id;
        game.addPlayer(newPlayer);
        socket.join(roomCode);
        console.log(`[Socket] ${playerName} joined room ${roomCode}`);
        // Broadcast updated state
        broadcastGameState(roomCode);
    });
    socket.on('startHand', ({ roomCode }) => {
        const game = roomManager.getRoom(roomCode);
        if (game) {
            try {
                game.startHand();
                broadcastGameState(roomCode);
            }
            catch (e) {
                socket.emit('error', e.message);
            }
        }
    });
    socket.on('playerAction', ({ roomCode, action, amount }) => {
        const game = roomManager.getRoom(roomCode);
        if (game) {
            const player = game.players.find(p => p.socketId === socket.id);
            if (player) {
                try {
                    game.handlePlayerAction(player.id, action, amount);
                    broadcastGameState(roomCode);
                }
                catch (e) {
                    socket.emit('error', e.message);
                }
            }
        }
    });
    socket.on('disconnect', () => {
        console.log(`[Socket] User disconnected: ${socket.id}`);
        const roomCode = roomManager.removePlayerFromAllRooms(socket.id);
        if (roomCode) {
            broadcastGameState(roomCode);
        }
    });
});
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`[Server] Socket.io server running on port ${PORT}`);
});
