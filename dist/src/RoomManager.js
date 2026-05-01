"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomManager = void 0;
const Game_1 = require("./Game");
const types_1 = require("../shared/types");
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
    /**
     * Handle a player disconnecting.
     * Returns the room code if they were in one.
     */
    handleDisconnect(socketId) {
        for (const [roomCode, game] of this.rooms.entries()) {
            const player = game.players.find(p => p.socketId === socketId);
            if (player) {
                player.isDisconnected = true;
                // If they are in a hand, we auto fold them if it's their turn.
                // Game.ts will clean up disconnected players at the end of the hand.
                if (game.state !== types_1.GameState.Waiting && game.state !== types_1.GameState.Showdown) {
                    if (game.players[game.currentPlayerTurn]?.id === player.id) {
                        try {
                            game.handlePlayerAction(player.id, 'fold');
                        }
                        catch (e) { }
                    }
                }
                else {
                    // If waiting or showdown, we can safely remove them.
                    game.removePlayer(player.id);
                    this.checkAndDestroyEmptyRoom(roomCode);
                }
                return roomCode;
            }
        }
        return undefined;
    }
}
exports.RoomManager = RoomManager;
