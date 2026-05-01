"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Card = void 0;
const types_1 = require("../../shared/types");
class Card {
    constructor(suit, value) {
        this.suit = suit;
        this.value = value;
    }
    toString() {
        const rankStr = this.value <= 10 ? this.value.toString() : types_1.Rank[this.value];
        return `${rankStr} of ${this.suit}`;
    }
}
exports.Card = Card;
