import { Server, Socket } from 'socket.io';
import { RoomManager } from '../RoomManager';
import { Player } from '../models/Player';
import { v4 as uuidv4 } from 'uuid';

export class SocketController {
  private io: Server;
  private roomManager: RoomManager;

  constructor(io: Server) {
    this.io = io;
    this.roomManager = RoomManager.getInstance();
    this.initialize();
  }

  // Broadcasts the game state to everyone in a room, and private state to individuals
  private broadcastGameState(roomCode: string) {
    const game = this.roomManager.getRoom(roomCode);
    if (!game) return;

    const publicState = game.getPublicState();
    this.io.to(roomCode).emit('gameState', publicState);

    // Send private hole cards to each player
    for (const player of game.players) {
      if (player.socketId && !player.isDisconnected) {
        this.io.to(player.socketId).emit('privateState', game.getPrivateState(player.id));
      }
    }
  }

  private initialize() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`[Socket] User connected: ${socket.id}`);

      socket.on('joinRoom', ({ playerName, roomCode, playerId }) => {
        // Find if this player is already in a room and reconnect them there, or just in the requested room
        const game = this.roomManager.getOrCreateRoom(roomCode);
        
        let player = playerId ? game.players.find(p => p.id === playerId) : undefined;

        if (player) {
          // Reconnect existing player
          player.socketId = socket.id;
          player.name = playerName;
          player.isDisconnected = false;
        } else {
          // If the socket was previously associated with another player, leave old room
          const oldRoom = this.roomManager.removePlayerFromAllRooms(socket.id);
          if (oldRoom) {
              socket.leave(oldRoom);
              this.broadcastGameState(oldRoom);
          }

          // Create new player with 5000 chips
          const newPlayerId = playerId || uuidv4();
          player = new Player(newPlayerId, playerName, 5000);
          player.socketId = socket.id;
          game.addPlayer(player);
        }

        socket.join(roomCode);
        socket.emit('roomJoined', { playerId: player.id });

        console.log(`[Socket] ${playerName} joined room ${roomCode}`);
        
        // Broadcast updated state
        this.broadcastGameState(roomCode);
      });

      socket.on('startHand', ({ roomCode }) => {
        const game = this.roomManager.getRoom(roomCode);
        if (game) {
          try {
            game.startHand();
            this.broadcastGameState(roomCode);
          } catch (e: any) {
            socket.emit('error', e.message);
          }
        }
      });

      socket.on('playerAction', ({ roomCode, action, amount }) => {
        const game = this.roomManager.getRoom(roomCode);
        if (game) {
          const player = game.players.find(p => p.socketId === socket.id);
          if (player) {
            try {
              game.handlePlayerAction(player.id, action, amount);
              this.broadcastGameState(roomCode);
            } catch (e: any) {
              socket.emit('error', e.message);
            }
          }
        }
      });

      socket.on('disconnect', () => {
        console.log(`[Socket] User disconnected: ${socket.id}`);
        // Handle disconnect mid-hand gracefully.
        // We look for any room this socket is in
        const roomCode = this.roomManager.handleDisconnect(socket.id);
        if (roomCode) {
            this.broadcastGameState(roomCode);
        }
      });
    });
  }
}
