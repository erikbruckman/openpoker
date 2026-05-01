import { Card, Rank, Suit } from '../models/Card';

export enum HandRank {
  HighCard = 0,
  Pair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
  RoyalFlush = 9,
}

export interface HandResult {
  rank: HandRank;
  // The 5 cards that make up the hand, sorted by importance (e.g. for Full House: the 3 matching cards, then the 2 matching)
  // For High Card: sorted descending.
  bestCards: Card[];
  // The score array is used to easily compare two hands of the same rank.
  // Example: [HandRank.Pair, Rank.Ten, Rank.Ace, Rank.King, Rank.Queen] (Pair of tens, with A,K,Q kickers)
  score: number[];
}

export class HandEvaluator {
  /**
   * Evaluates a hand of up to 7 cards (usually 2 hole cards + 5 community cards)
   * and returns the best 5-card combination.
   */
  public static evaluate(cards: Card[]): HandResult {
    if (cards.length < 5) {
      throw new Error('Need at least 5 cards to evaluate a hand.');
    }

    // Sort cards descending by rank
    const sortedCards = [...cards].sort((a, b) => b.value - a.value);

    // Group by rank and suit
    const rankCounts = new Map<Rank, Card[]>();
    const suitCounts = new Map<Suit, Card[]>();

    for (const card of sortedCards) {
      if (!rankCounts.has(card.value)) rankCounts.set(card.value, []);
      rankCounts.get(card.value)!.push(card);

      if (!suitCounts.has(card.suit)) suitCounts.set(card.suit, []);
      suitCounts.get(card.suit)!.push(card);
    }

    // Sort rank counts by frequency descending, then by rank descending
    const rankedGroups = Array.from(rankCounts.values()).sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length;
      return b[0].value - a[0].value;
    });

    const isFlush = this.findFlush(suitCounts);
    const isStraight = this.findStraight(sortedCards);

    // 1. Straight Flush / Royal Flush
    if (isFlush) {
      const flushCards = isFlush; // These are sorted desc
      const straightFlushCards = this.findStraight(flushCards);
      if (straightFlushCards) {
        const topRank = straightFlushCards[0].value;
        if (topRank === Rank.Ace) {
          return {
            rank: HandRank.RoyalFlush,
            bestCards: straightFlushCards,
            score: [HandRank.RoyalFlush],
          };
        }
        return {
          rank: HandRank.StraightFlush,
          bestCards: straightFlushCards,
          score: [HandRank.StraightFlush, topRank],
        };
      }
    }

    // 2. Four of a Kind
    if (rankedGroups[0].length === 4) {
      const quads = rankedGroups[0];
      const kickers = this.getKickers(sortedCards, quads, 1);
      return {
        rank: HandRank.FourOfAKind,
        bestCards: [...quads, ...kickers],
        score: [HandRank.FourOfAKind, quads[0].value, kickers[0].value],
      };
    }

    // 3. Full House
    if (rankedGroups[0].length === 3 && rankedGroups.length > 1 && rankedGroups[1].length >= 2) {
      const trips = rankedGroups[0];
      const pair = [rankedGroups[1][0], rankedGroups[1][1]];
      return {
        rank: HandRank.FullHouse,
        bestCards: [...trips, ...pair],
        score: [HandRank.FullHouse, trips[0].value, pair[0].value],
      };
    }

    // 4. Flush
    if (isFlush) {
      const bestFlush = isFlush.slice(0, 5);
      return {
        rank: HandRank.Flush,
        bestCards: bestFlush,
        score: [HandRank.Flush, ...bestFlush.map(c => c.value)],
      };
    }

    // 5. Straight
    if (isStraight) {
      return {
        rank: HandRank.Straight,
        bestCards: isStraight,
        score: [HandRank.Straight, isStraight[0].value],
      };
    }

    // 6. Three of a Kind
    if (rankedGroups[0].length === 3) {
      const trips = rankedGroups[0];
      const kickers = this.getKickers(sortedCards, trips, 2);
      return {
        rank: HandRank.ThreeOfAKind,
        bestCards: [...trips, ...kickers],
        score: [HandRank.ThreeOfAKind, trips[0].value, ...kickers.map(c => c.value)],
      };
    }

    // 7. Two Pair
    if (rankedGroups[0].length === 2 && rankedGroups.length > 1 && rankedGroups[1].length === 2) {
      const pair1 = rankedGroups[0];
      const pair2 = rankedGroups[1];
      const kickers = this.getKickers(sortedCards, [...pair1, ...pair2], 1);
      return {
        rank: HandRank.TwoPair,
        bestCards: [...pair1, ...pair2, ...kickers],
        score: [HandRank.TwoPair, pair1[0].value, pair2[0].value, kickers[0].value],
      };
    }

    // 8. One Pair
    if (rankedGroups[0].length === 2) {
      const pair = rankedGroups[0];
      const kickers = this.getKickers(sortedCards, pair, 3);
      return {
        rank: HandRank.Pair,
        bestCards: [...pair, ...kickers],
        score: [HandRank.Pair, pair[0].value, ...kickers.map(c => c.value)],
      };
    }

    // 9. High Card
    const highCards = sortedCards.slice(0, 5);
    return {
      rank: HandRank.HighCard,
      bestCards: highCards,
      score: [HandRank.HighCard, ...highCards.map(c => c.value)],
    };
  }

  /**
   * Compares two hand results. Returns > 0 if a wins, < 0 if b wins, 0 for a tie.
   */
  public static compare(a: HandResult, b: HandResult): number {
    const minLength = Math.min(a.score.length, b.score.length);
    for (let i = 0; i < minLength; i++) {
      if (a.score[i] !== b.score[i]) {
        return a.score[i] - b.score[i];
      }
    }
    return 0; // Absolute tie
  }

  private static findFlush(suitCounts: Map<Suit, Card[]>): Card[] | null {
    for (const cards of suitCounts.values()) {
      if (cards.length >= 5) {
        // Cards should already be sorted descending because they were inserted in order
        return cards;
      }
    }
    return null;
  }

  private static findStraight(sortedCards: Card[]): Card[] | null {
    if (sortedCards.length < 5) return null;

    // Remove duplicate ranks for straight evaluation
    const uniqueRanks: Card[] = [];
    for (const card of sortedCards) {
      if (uniqueRanks.length === 0 || uniqueRanks[uniqueRanks.length - 1].value !== card.value) {
        uniqueRanks.push(card);
      }
    }

    if (uniqueRanks.length < 5) return null;

    for (let i = 0; i <= uniqueRanks.length - 5; i++) {
      if (uniqueRanks[i].value - uniqueRanks[i + 4].value === 4) {
        return uniqueRanks.slice(i, i + 5);
      }
    }

    // Check for low straight (A-2-3-4-5)
    // If we have an Ace (which is at the start if it exists), check if we have 5,4,3,2 at the end
    if (uniqueRanks[0].value === Rank.Ace) {
      // Look for 5,4,3,2
      const lowCards = uniqueRanks.filter(c => c.value <= Rank.Five);
      if (lowCards.length === 4 && lowCards[0].value === Rank.Five && lowCards[3].value === Rank.Two) {
        // Construct the low straight: 5, 4, 3, 2, A
        return [...lowCards, uniqueRanks[0]];
      }
    }

    return null;
  }

  private static getKickers(allCards: Card[], excludeCards: Card[], count: number): Card[] {
    const excludeSet = new Set(excludeCards);
    const kickers: Card[] = [];
    for (const card of allCards) {
      if (!excludeSet.has(card)) {
        kickers.push(card);
        if (kickers.length === count) break;
      }
    }
    return kickers;
  }
}
