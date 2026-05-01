"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Player = void 0;
const PlayerAction_1 = require("./PlayerAction");
class Player {
    constructor(id, name, initialChips = 1000) {
        this.id = id;
        this.name = name;
        this.currentHand = [];
        this.currentBet = 0;
        this.currentAction = PlayerAction_1.PlayerAction.None;
        this.socketId = '';
        this.isDisconnected = false;
        this.chips = initialChips;
    }
    /**
     * Resets the player's state for a new hand.
     */
    resetForNewHand() {
        this.currentHand = [];
        this.currentBet = 0;
        this.currentAction = PlayerAction_1.PlayerAction.None;
    }
    /**
     * Receives cards to add to the hand.
     */
    receiveCards(cards) {
        this.currentHand.push(...cards);
    }
    /**
     * Bets a certain amount of chips.
     * Returns the actual amount bet (in case player has fewer chips than requested).
     */
    bet(amount) {
        const actualBet = Math.min(this.chips, amount);
        this.chips -= actualBet;
        this.currentBet += actualBet;
        return actualBet;
    }
    /**
     * Folds the current hand.
     */
    fold() {
        this.currentAction = PlayerAction_1.PlayerAction.Fold;
    }
}
exports.Player = Player;
