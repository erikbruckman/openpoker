import { Player } from '../models/Player';
import { PlayerAction } from '../../shared/types';

export function getNextActivePlayerIndex(players: ReadonlyArray<Player>, currentIndex: number): number {
  let index = currentIndex;
  let count = 0;
  while (count < players.length) {
    index = (index + 1) % players.length;
    const player = players[index];
    if (player.currentAction !== PlayerAction.Fold && player.chips > 0) {
      return index;
    }
    count++;
  }
  return -1;
}

export function isBettingRoundOver(players: ReadonlyArray<Player>, currentHighestBet: number): boolean {
  const activePlayers = players.filter(p => p.currentAction !== PlayerAction.Fold);
  if (activePlayers.length <= 1) return true;
  return activePlayers.every(p =>
    p.chips === 0 ||
    (p.currentAction !== PlayerAction.None && p.currentBet === currentHighestBet)
  );
}

export function resetBetsForNewRound(players: Player[], dealerButtonIndex: number): number {
  for (const player of players) {
    player.beginBettingRound();
  }
  return getNextActivePlayerIndex(players, dealerButtonIndex);
}

export interface ActionResult {
  potIncrease: number;
  newHighestBet: number;
}

export function applyPlayerAction(
  players: Player[],
  currentPlayerTurn: number,
  currentHighestBet: number,
  playerId: string,
  action: PlayerAction,
  amount?: number
): ActionResult {
  const player = players[currentPlayerTurn];
  if (!player || player.id !== playerId) throw new Error("Not this player's turn.");

  let potIncrease = 0;
  let newHighestBet = currentHighestBet;

  if (action === PlayerAction.Fold) {
    player.setAction(PlayerAction.Fold);
  } else if (action === PlayerAction.Check) {
    if (currentHighestBet !== player.currentBet) {
      throw new Error('Cannot check when there is an outstanding bet.');
    }
    player.setAction(PlayerAction.Check);
  } else if (action === PlayerAction.Call) {
    const amountToCall = currentHighestBet - player.currentBet;
    potIncrease = player.bet(amountToCall);
    player.setAction(amountToCall === 0 ? PlayerAction.Check : PlayerAction.Call);
  } else if (action === PlayerAction.Raise && amount !== undefined && amount > 0) {
    const amountToCallAndRaise = (currentHighestBet - player.currentBet) + amount;
    potIncrease = player.bet(amountToCallAndRaise);
    if (player.currentBet > currentHighestBet) {
      newHighestBet = player.currentBet;
      // A raise re-opens betting for everyone who can still act.
      for (const p of players) {
        if (p.id !== player.id && p.currentAction !== PlayerAction.Fold && p.chips > 0) {
          p.setAction(PlayerAction.None);
        }
      }
    }
    player.setAction(PlayerAction.Raise);
  } else {
    throw new Error('Invalid action or missing raise amount.');
  }

  return { potIncrease, newHighestBet };
}
