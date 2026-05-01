"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Deck = void 0;
const Card_1 = require("./Card");
class Deck {
    constructor() {
        this.cards = [];
        this.initialize();
    }
    /**
     * Initializes a new sorted deck of 52 cards.
     */
    initialize() {
        this.cards = [];
        for (const suit of Object.values(Card_1.Suit)) {
            if (suit === Card_1.Suit.Hidden)
                continue;
            const ranks = Object.values(Card_1.Rank).filter(v => typeof v === 'number' && v !== Card_1.Rank.Hidden);
            for (const rank of ranks) {
                this.cards.push(new Card_1.Card(suit, rank));
            }
        }
    }
    /**
     * Performs a perfect Fisher-Yates shuffle on the deck.
     */
    shuffle() {
        let currentIndex = this.cards.length;
        let randomIndex;
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
    draw() {
        return this.cards.pop(); // Taking from the end of the array is O(1) and represents the "top"
    }
    /**
     * Gets the remaining number of cards in the deck.
     */
    get remaining() {
        return this.cards.length;
    }
}
exports.Deck = Deck;
