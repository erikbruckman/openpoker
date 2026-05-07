import { Deck } from '../models/Deck';
import { Player } from '../models/Player';
import { Card } from '../models/Card';

export function postBlinds(
  players: Player[],
  sbIndex: number,
  bbIndex: number,
  smallBlind: number,
  bigBlind: number
): number {
  let pot = 0;
  pot += players[sbIndex].bet(smallBlind);
  pot += players[bbIndex].bet(bigBlind);
  return pot;
}

export function dealHoleCards(deck: Deck, players: Player[]): void {
  for (let i = 0; i < 2; i++) {
    for (const player of players) {
      const card = deck.draw();
      if (card) player.receiveCards([card]);
    }
  }
}

export function dealCommunityCards(deck: Deck, count: number): Card[] {
  deck.draw(); // burn card
  const cards: Card[] = [];
  for (let i = 0; i < count; i++) {
    const card = deck.draw();
    if (card) cards.push(card);
  }
  return cards;
}
