import { Player } from '../models/Player';
import { Card } from '../models/Card';
import { PlayerAction } from '../../shared/types';
import { HandEvaluator, HandResult } from '../utils/HandEvaluator';

export function computeSidePots(players: ReadonlyArray<Player>): Array<{ amount: number; eligible: Player[] }> {
  const pots: Array<{ amount: number; eligible: Player[] }> = [];
  const remaining = new Map(players.map(p => [p.id, p.contributedThisHand]));
  const folded = new Set(
    players.filter(p => p.currentAction === PlayerAction.Fold).map(p => p.id)
  );

  while (true) {
    let minContrib = Infinity;
    for (const contrib of remaining.values()) {
      if (contrib > 0 && contrib < minContrib) minContrib = contrib;
    }
    if (minContrib === Infinity) break;

    let potAmount = 0;
    const eligible: Player[] = [];

    for (const player of players) {
      const contrib = remaining.get(player.id)!;
      if (contrib > 0) {
        const take = Math.min(contrib, minContrib);
        potAmount += take;
        remaining.set(player.id, contrib - take);
        if (!folded.has(player.id)) eligible.push(player as Player);
      }
    }

    pots.push({ amount: potAmount, eligible });
  }

  return pots;
}

export function resolveShowdown(
  players: ReadonlyArray<Player>,
  communityCards: ReadonlyArray<Card>
): void {
  const activePlayers = players.filter(p => p.currentAction !== PlayerAction.Fold) as Player[];

  if (activePlayers.length === 1) {
    const totalPot = computeSidePots(players).reduce((sum, pot) => sum + pot.amount, 0);
    activePlayers[0].addChips(totalPot);
    return;
  }

  const playerResults: { player: Player; result: HandResult }[] = activePlayers.map(player => ({
    player,
    result: HandEvaluator.evaluate([...player.currentHand, ...communityCards]),
  }));

  for (const sidePot of computeSidePots(players)) {
    const eligibleResults = playerResults.filter(r =>
      sidePot.eligible.some(e => e.id === r.player.id)
    );
    if (eligibleResults.length === 0) continue;

    eligibleResults.sort((a, b) => HandEvaluator.compare(b.result, a.result));

    const winners = [eligibleResults[0].player];
    const bestResult = eligibleResults[0].result;

    for (let i = 1; i < eligibleResults.length; i++) {
      if (HandEvaluator.compare(bestResult, eligibleResults[i].result) === 0) {
        winners.push(eligibleResults[i].player);
      } else {
        break;
      }
    }

    const splitAmount = Math.floor(sidePot.amount / winners.length);
    const remainder = sidePot.amount % winners.length;
    for (const winner of winners) {
      winner.addChips(splitAmount);
    }
    // Odd chip goes to the first eligible winner (closest to dealer's left in the array).
    winners[0].addChips(remainder);
  }
}
