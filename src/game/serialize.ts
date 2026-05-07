import { Player } from '../models/Player';
import { Card } from '../models/Card';
import { GameState, PublicGameState, PrivateGameState } from '../../shared/types';

export function serializePublicState(
  state: GameState,
  pot: number,
  communityCards: ReadonlyArray<Card>,
  players: ReadonlyArray<Player>,
  currentHighestBet: number,
  dealerButtonIndex: number,
  currentPlayerTurn: number
): PublicGameState {
  return {
    state,
    pot,
    communityCards: [...communityCards],
    currentHighestBet,
    dealerButtonIndex,
    currentPlayerTurn,
    players: players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      currentBet: p.currentBet,
      currentAction: p.currentAction,
      currentHand:
        state === GameState.Showdown
          ? [...p.currentHand]
          : p.currentHand.length > 0
          ? [{ suit: 'hidden', value: 0 }, { suit: 'hidden', value: 0 }]
          : [],
    })),
  };
}

export function serializePrivateState(
  players: ReadonlyArray<Player>,
  playerId: string
): PrivateGameState {
  const player = players.find(p => p.id === playerId);
  return { hand: player ? [...player.currentHand] : [] };
}
