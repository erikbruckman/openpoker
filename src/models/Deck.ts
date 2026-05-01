import { Card, Rank, Suit } from './Card';

export class Deck {
  public cards: Card[] = [];

  constructor() {
    this.initialize();
  }

  /**
   * Initializes a new sorted deck of 52 cards.
   */
  public initialize(): void {
    this.cards = [];
    for (const suit of Object.values(Suit)) {
      if (suit === Suit.Hidden) continue;
      
      const ranks = Object.values(Rank).filter(v => typeof v === 'number' && v !== Rank.Hidden) as Rank[];
      for (const rank of ranks) {
        this.cards.push(new Card(suit, rank));
      }
    }
  }

  /**
   * Performs a perfect Fisher-Yates shuffle on the deck.
   */
  public shuffle(): void {
    let currentIndex = this.cards.length;
    let randomIndex: number;

    // While there remain elements to shuffle.
    while (currentIndex !== 0) {
      // Pick a remaining element.
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      // And swap it with the current element.
      [this.cards[currentIndex], this.cards[randomIndex]] = [
        this.cards[randomIndex],
        this.cards[currentIndex],
      ];
    }
  }

  /**
   * Draws a card from the top of the deck.
   * @returns The drawn Card, or undefined if the deck is empty.
   */
  public draw(): Card | undefined {
    return this.cards.pop(); // Taking from the end of the array is O(1) and represents the "top"
  }

  /**
   * Gets the remaining number of cards in the deck.
   */
  public get remaining(): number {
    return this.cards.length;
  }
}
