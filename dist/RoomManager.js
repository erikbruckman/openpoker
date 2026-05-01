"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomManager = void 0;
const Game_1 = require("./Game");
class RoomManager {
    constructor() {
        this.rooms = new Map();
    }
    static getInstance() {
        if (!RoomManager.instance) {
            RoomManager.instance = new RoomManager();
        }
        return RoomManager.instance;
    }
    /**
     * Retrieves an existing room or creates a new one if it doesn't exist.
     */
    getOrCreateRoom(roomCode) {
        if (!this.rooms.has(roomCode)) {
            this.rooms.set(roomCode, new Game_1.Game(roomCode));
            console.log(`[RoomManager] Created new room: ${roomCode}`);
        }
        return this.rooms.get(roomCode);
    }
    /**
     * Retrieves an existing room without creating it.
     */
    getRoom(roomCode) {
        return this.rooms.get(roomCode);
    }
    /**
     * Checks if a room should be destroyed and destroys it if empty.
     */
    checkAndDestroyEmptyRoom(roomCode) {
        const room = this.rooms.get(roomCode);
        if (room && room.players.length === 0) {
            this.rooms.delete(roomCode);
            console.log(`[RoomManager] Destroyed empty room: ${roomCode}`);
        }
    }
    /**
     * Remove a player from whatever room they are in.
     * Returns the room code if they were in one.
     */
    removePlayerFromAllRooms(socketId) {
        for (const [roomCode, game] of this.rooms.entries()) {
            const playerIndex = game.players.findIndex(p => p.socketId === socketId);
            if (playerIndex !== -1) {
                const playerId = game.players[playerIndex].id;
                game.removePlayer(playerId);
                this.checkAndDestroyEmptyRoom(roomCode);
                return roomCode;
            }
        }
        return undefined;
    }
}
exports.RoomManager = RoomManager;
