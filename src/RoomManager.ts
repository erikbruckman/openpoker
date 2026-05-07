import { Game } from './game/Game';
import { GameState, PlayerAction } from '../shared/types';

export class RoomManager {
  private rooms: Map<string, Game> = new Map();

  public getOrCreateRoom(roomCode: string): Game {
    if (!this.rooms.has(roomCode)) {
      this.rooms.set(roomCode, new Game(roomCode));
      console.log(`[RoomManager] Created new room: ${roomCode}`);
    }
    return this.rooms.get(roomCode)!;
  }

  public getRoom(roomCode: string): Game | undefined {
    return this.rooms.get(roomCode);
  }

  public checkAndDestroyEmptyRoom(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (room && room.players.length === 0) {
      this.rooms.delete(roomCode);
      console.log(`[RoomManager] Destroyed empty room: ${roomCode}`);
    }
  }

  public removePlayerFromAllRooms(socketId: string): string | undefined {
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

  public handleDisconnect(socketId: string): string | undefined {
    for (const [roomCode, game] of this.rooms.entries()) {
      const player = game.players.find(p => p.socketId === socketId);
      if (player) {
        player.isDisconnected = true;
        if (game.state !== GameState.Waiting && game.state !== GameState.Showdown) {
          if (game.players[game.currentPlayerTurn]?.id === player.id) {
            try {
              game.handlePlayerAction(player.id, PlayerAction.Fold);
            } catch (e) {}
          }
        } else {
          game.removePlayer(player.id);
          this.checkAndDestroyEmptyRoom(roomCode);
        }
        return roomCode;
      }
    }
    return undefined;
  }
}
