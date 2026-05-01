"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Card_1 = require("../models/Card");
const HandEvaluator_1 = require("./HandEvaluator");
describe('HandEvaluator', () => {
    it('should identify a Royal Flush', () => {
        const cards = [
            new Card_1.Card(Card_1.Suit.Hearts, Card_1.Rank.Ace),
            new Card_1.Card(Card_1.Suit.Hearts, Card_1.Rank.King),
            new Card_1.Card(Card_1.Suit.Hearts, Card_1.Rank.Queen),
            new Card_1.Card(Card_1.Suit.Hearts, Card_1.Rank.Jack),
            new Card_1.Card(Card_1.Suit.Hearts, Card_1.Rank.Ten),
            new Card_1.Card(Card_1.Suit.Diamonds, Card_1.Rank.Two), // extra card
            new Card_1.Card(Card_1.Suit.Clubs, Card_1.Rank.Three), // extra card
        ];
        const result = HandEvaluator_1.HandEvaluator.evaluate(cards);
        expect(result.rank).toBe(HandEvaluator_1.HandRank.RoyalFlush);
    });
    it('should identify a Full House and beat a Flush', () => {
        const fullHouseCards = [
            new Card_1.Card(Card_1.Suit.Hearts, Card_1.Rank.Ten),
            new Card_1.Card(Card_1.Suit.Diamonds, Card_1.Rank.Ten),
            new Card_1.Card(Card_1.Suit.Clubs, Card_1.Rank.Ten),
            new Card_1.Card(Card_1.Suit.Spades, Card_1.Rank.Nine),
            new Card_1.Card(Card_1.Suit.Hearts, Card_1.Rank.Nine),
            new Card_1.Card(Card_1.Suit.Diamonds, Card_1.Rank.Two),
            new Card_1.Card(Card_1.Suit.Clubs, Card_1.Rank.Three),
        ];
        const flushCards = [
            new Card_1.Card(Card_1.Suit.Spades, Card_1.Rank.Ace),
            new Card_1.Card(Card_1.Suit.Spades, Card_1.Rank.King),
            new Card_1.Card(Card_1.Suit.Spades, Card_1.Rank.Ten),
            new Card_1.Card(Card_1.Suit.Spades, Card_1.Rank.Seven),
            new Card_1.Card(Card_1.Suit.Spades, Card_1.Rank.Two),
            new Card_1.Card(Card_1.Suit.Diamonds, Card_1.Rank.Ace),
            new Card_1.Card(Card_1.Suit.Clubs, Card_1.Rank.King),
        ];
        const fhResult = HandEvaluator_1.HandEvaluator.evaluate(fullHouseCards);
        const flushResult = HandEvaluator_1.HandEvaluator.evaluate(flushCards);
        expect(fhResult.rank).toBe(HandEvaluator_1.HandRank.FullHouse);
        expect(flushResult.rank).toBe(HandEvaluator_1.HandRank.Flush);
        const comparison = HandEvaluator_1.HandEvaluator.compare(fhResult, flushResult);
        expect(comparison).toBeGreaterThan(0); // fh beats flush
    });
    it('should identify a low straight (A-2-3-4-5)', () => {
        const cards = [
            new Card_1.Card(Card_1.Suit.Hearts, Card_1.Rank.Ace),
            new Card_1.Card(Card_1.Suit.Diamonds, Card_1.Rank.Two),
            new Card_1.Card(Card_1.Suit.Clubs, Card_1.Rank.Three),
            new Card_1.Card(Card_1.Suit.Spades, Card_1.Rank.Four),
            new Card_1.Card(Card_1.Suit.Hearts, Card_1.Rank.Five),
            new Card_1.Card(Card_1.Suit.Diamonds, Card_1.Rank.Jack),
            new Card_1.Card(Card_1.Suit.Clubs, Card_1.Rank.King),
        ];
        const result = HandEvaluator_1.HandEvaluator.evaluate(cards);
        expect(result.rank).toBe(HandEvaluator_1.HandRank.Straight);
    });
});
