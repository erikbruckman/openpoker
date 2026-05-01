import { Card, Rank, Suit } from '../models/Card';
import { HandEvaluator, HandRank } from './HandEvaluator';

describe('HandEvaluator', () => {
  it('should identify a Royal Flush', () => {
    const cards = [
      new Card(Suit.Hearts, Rank.Ace),
      new Card(Suit.Hearts, Rank.King),
      new Card(Suit.Hearts, Rank.Queen),
      new Card(Suit.Hearts, Rank.Jack),
      new Card(Suit.Hearts, Rank.Ten),
      new Card(Suit.Diamonds, Rank.Two), // extra card
      new Card(Suit.Clubs, Rank.Three), // extra card
    ];
    const result = HandEvaluator.evaluate(cards);
    expect(result.rank).toBe(HandRank.RoyalFlush);
  });

  it('should identify a Full House and beat a Flush', () => {
    const fullHouseCards = [
      new Card(Suit.Hearts, Rank.Ten),
      new Card(Suit.Diamonds, Rank.Ten),
      new Card(Suit.Clubs, Rank.Ten),
      new Card(Suit.Spades, Rank.Nine),
      new Card(Suit.Hearts, Rank.Nine),
      new Card(Suit.Diamonds, Rank.Two),
      new Card(Suit.Clubs, Rank.Three),
    ];

    const flushCards = [
      new Card(Suit.Spades, Rank.Ace),
      new Card(Suit.Spades, Rank.King),
      new Card(Suit.Spades, Rank.Ten),
      new Card(Suit.Spades, Rank.Seven),
      new Card(Suit.Spades, Rank.Two),
      new Card(Suit.Diamonds, Rank.Ace),
      new Card(Suit.Clubs, Rank.King),
    ];

    const fhResult = HandEvaluator.evaluate(fullHouseCards);
    const flushResult = HandEvaluator.evaluate(flushCards);

    expect(fhResult.rank).toBe(HandRank.FullHouse);
    expect(flushResult.rank).toBe(HandRank.Flush);

    const comparison = HandEvaluator.compare(fhResult, flushResult);
    expect(comparison).toBeGreaterThan(0); // fh beats flush
  });

  it('should identify a low straight (A-2-3-4-5)', () => {
    const cards = [
      new Card(Suit.Hearts, Rank.Ace),
      new Card(Suit.Diamonds, Rank.Two),
      new Card(Suit.Clubs, Rank.Three),
      new Card(Suit.Spades, Rank.Four),
      new Card(Suit.Hearts, Rank.Five),
      new Card(Suit.Diamonds, Rank.Jack),
      new Card(Suit.Clubs, Rank.King),
    ];
    const result = HandEvaluator.evaluate(cards);
    expect(result.rank).toBe(HandRank.Straight);
  });
});
