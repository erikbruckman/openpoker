import { Server, Socket } from 'socket.io';
import { RoomManager } from '../RoomManager';
import { Player } from '../models/Player';
import { v4 as uuidv4 } from 'uuid';
import { validatePlayerName, validateRoomCode, validateAction, validateAmount } from '../utils/validate';
import { GAME_CONFIG } from '../config/gameConfig';

export class SocketController {
  private io: Server;
  private roomManager: RoomManager;

  constructor(io: Server, roomManager: RoomManager) {
    this.io = io;
    this.roomManager = roomManager;
    this.initialize();
  }

  private broadcastGameState(roomCode: string) {
    const game = this.roomManager.getRoom(roomCode);
    if (!game) return;

    const publicState = game.getPublicState();
    this.io.to(roomCode).emit('gameState', publicState);

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
        const validName = validatePlayerName(playerName);
        if (!validName) { socket.emit('error', 'Invalid player name.'); return; }

        const validRoomCode = validateRoomCode(roomCode);
        if (!validRoomCode) { socket.emit('error', 'Invalid room code.'); return; }

        const game = this.roomManager.getOrCreateRoom(validRoomCode);
        let player: Player | undefined;

        // Reconnect: only allowed when the player exists and is actually disconnected.
        if (playerId && typeof playerId === 'string') {
          const existing = game.players.find(p => p.id === playerId);
          if (existing) {
            if (!existing.isDisconnected) {
              socket.emit('error', 'This player is already connected.');
              return;
            }
            existing.socketId = socket.id;
            existing.name = validName;
            existing.isDisconnected = false;
            player = existing;
          }
        }

        if (!player) {
          const oldRoom = this.roomManager.removePlayerFromAllRooms(socket.id);
          if (oldRoom) {
            socket.leave(oldRoom);
            this.broadcastGameState(oldRoom);
          }

          // Always generate playerId server-side; never trust the client's proposed ID.
          player = new Player(uuidv4(), validName, GAME_CONFIG.startingChips);
          player.socketId = socket.id;
          game.addPlayer(player);
        }

        socket.join(validRoomCode);
        socket.emit('roomJoined', { playerId: player.id });
        console.log(`[Socket] ${validName} joined room ${validRoomCode}`);
        this.broadcastGameState(validRoomCode);
      });

      socket.on('startHand', ({ roomCode }) => {
        const validRoomCode = validateRoomCode(roomCode);
        if (!validRoomCode) { socket.emit('error', 'Invalid room code.'); return; }

        const game = this.roomManager.getRoom(validRoomCode);
        if (game) {
          try {
            game.startHand();
            this.broadcastGameState(validRoomCode);
          } catch (e: any) {
            socket.emit('error', e.message);
          }
        }
      });

      socket.on('playerAction', ({ roomCode, action, amount }) => {
        const validRoomCode = validateRoomCode(roomCode);
        if (!validRoomCode) { socket.emit('error', 'Invalid room code.'); return; }

        const validAction = validateAction(action);
        if (!validAction) { socket.emit('error', 'Invalid action.'); return; }

        let validAmount: number | undefined;
        if (amount !== undefined && amount !== null) {
          const amt = validateAmount(amount);
          if (amt === null) { socket.emit('error', 'Invalid bet amount.'); return; }
          validAmount = amt;
        }

        const game = this.roomManager.getRoom(validRoomCode);
        if (game) {
          const player = game.players.find(p => p.socketId === socket.id);
          if (player) {
            try {
              game.handlePlayerAction(player.id, validAction, validAmount);
              this.broadcastGameState(validRoomCode);
            } catch (e: any) {
              socket.emit('error', e.message);
            }
          }
        }
      });

      socket.on('disconnect', () => {
        console.log(`[Socket] User disconnected: ${socket.id}`);
        const roomCode = this.roomManager.handleDisconnect(socket.id);
        if (roomCode) {
          this.broadcastGameState(roomCode);
        }
      });
    });
  }
}
