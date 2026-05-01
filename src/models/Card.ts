import { Suit, Rank, ICard } from '../../shared/types';
export { Suit, Rank };

export class Card implements ICard {
  constructor(public suit: Suit, public value: Rank) {}

  toString(): string {
    const rankStr = this.value <= 10 ? this.value.toString() : Rank[this.value];
    return `${rankStr} of ${this.suit}`;
  }
}
