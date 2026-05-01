"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Game = exports.GameState = void 0;
const Deck_1 = require("./models/Deck");
const HandEvaluator_1 = require("./utils/HandEvaluator");
var GameState;
(function (GameState) {
    GameState["Waiting"] = "Waiting";
    GameState["PreFlop"] = "PreFlop";
    GameState["Flop"] = "Flop";
    GameState["Turn"] = "Turn";
    GameState["River"] = "River";
    GameState["Showdown"] = "Showdown";
})(GameState || (exports.GameState = GameState = {}));
class Game {
    constructor(roomCode = '') {
        this.roomCode = roomCode;
        this.players = [];
        this.communityCards = [];
        this.pot = 0;
        this.state = GameState.Waiting;
        this.dealerButtonIndex = 0;
        this.smallBlind = 10;
        this.bigBlind = 20;
        // Track turn logic
        this.currentPlayerTurn = -1;
        this.currentHighestBet = 0;
        this.deck = new Deck_1.Deck();
    }
    addPlayer(player) {
        this.players.push(player);
    }
    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
    }
    /**
     * Starts a new hand. Shuffles deck, posts blinds, deals hole cards.
     */
    startHand() {
        if (this.players.length < 2) {
            throw new Error('Not enough players to start a hand.');
        }
        this.state = GameState.PreFlop;
        this.pot = 0;
        this.communityCards = [];
        this.currentHighestBet = 0;
        // Reset players
        for (const player of this.players) {
            player.resetForNewHand();
        }
        // Prepare deck
        this.deck.initialize();
        this.deck.shuffle();
        // Post Blinds (Simplified: assumes players have enough chips, doesn't handle all-in strictly on blinds yet)
        const sbIndex = (this.dealerButtonIndex + 1) % this.players.length;
        const bbIndex = (this.dealerButtonIndex + 2) % this.players.length;
        const sbPlayer = this.players[sbIndex];
        const bbPlayer = this.players[bbIndex];
        this.pot += sbPlayer.bet(this.smallBlind);
        this.pot += bbPlayer.bet(this.bigBlind);
        this.currentHighestBet = this.bigBlind;
        // Deal hole cards (2 each)
        for (let i = 0; i < 2; i++) {
            for (const player of this.players) {
                const card = this.deck.draw();
                if (card)
                    player.receiveCards([card]);
            }
        }
        // Set turn to player after big blind
        this.currentPlayerTurn = (bbIndex + 1) % this.players.length;
    }
    /**
     * Deals the Flop (3 cards) and updates state.
     */
    dealFlop() {
        if (this.state !== GameState.PreFlop)
            throw new Error('Cannot deal flop right now.');
        this.deck.draw(); // Burn card
        for (let i = 0; i < 3; i++) {
            const card = this.deck.draw();
            if (card)
                this.communityCards.push(card);
        }
        this.state = GameState.Flop;
        this.resetBetsForNewRound();
    }
    /**
     * Deals the Turn (1 card) and updates state.
     */
    dealTurn() {
        if (this.state !== GameState.Flop)
            throw new Error('Cannot deal turn right now.');
        this.deck.draw(); // Burn card
        const card = this.deck.draw();
        if (card)
            this.communityCards.push(card);
        this.state = GameState.Turn;
        this.resetBetsForNewRound();
    }
    /**
     * Deals the River (1 card) and updates state.
     */
    dealRiver() {
        if (this.state !== GameState.Turn)
            throw new Error('Cannot deal river right now.');
        this.deck.draw(); // Burn card
        const card = this.deck.draw();
        if (card)
            this.communityCards.push(card);
        this.state = GameState.River;
        this.resetBetsForNewRound();
    }
    resetBetsForNewRound() {
        this.currentHighestBet = 0;
        for (const player of this.players) {
            player.currentBet = 0;
        }
        // In post-flop rounds, action starts with the first active player after the dealer
        this.currentPlayerTurn = this.getNextActivePlayerIndex(this.dealerButtonIndex);
    }
    /**
     * Scores the hand and awards the pot to the winner(s).
     */
    scoreHand() {
        this.state = GameState.Showdown;
        const activePlayers = this.players.filter(p => !p.hasFolded);
        if (activePlayers.length === 1) {
            // Everyone else folded
            activePlayers[0].chips += this.pot;
            this.endHand();
            return;
        }
        // Evaluate all hands
        const playerResults = activePlayers.map(player => ({
            player,
            result: HandEvaluator_1.HandEvaluator.evaluate([...player.currentHand, ...this.communityCards]),
        }));
        // Sort descending by hand strength
        playerResults.sort((a, b) => HandEvaluator_1.HandEvaluator.compare(b.result, a.result));
        const winners = [playerResults[0].player];
        const bestResult = playerResults[0].result;
        // Check for ties
        for (let i = 1; i < playerResults.length; i++) {
            if (HandEvaluator_1.HandEvaluator.compare(bestResult, playerResults[i].result) === 0) {
                winners.push(playerResults[i].player);
            }
            else {
                break;
            }
        }
        // Award pot (split if necessary)
        // Simplified: doesn't handle fractional chips perfectly if pot isn't perfectly divisible
        const splitAmount = Math.floor(this.pot / winners.length);
        for (const winner of winners) {
            winner.chips += splitAmount;
        }
        this.endHand();
    }
    endHand() {
        this.pot = 0;
        this.state = GameState.Waiting;
        this.dealerButtonIndex = (this.dealerButtonIndex + 1) % this.players.length;
    }
    // --- Betting Helpers ---
    getNextActivePlayerIndex(currentIndex) {
        let index = currentIndex;
        let count = 0;
        while (count < this.players.length) {
            index = (index + 1) % this.players.length;
            if (!this.players[index].hasFolded && this.players[index].chips > 0) { // ignoring all-ins for simplicity in this basic version
                return index;
            }
            count++;
        }
        return -1;
    }
    // Example action method
    handlePlayerAction(playerId, action, amount) {
        const player = this.players[this.currentPlayerTurn];
        if (player.id !== playerId)
            throw new Error('Not this player\'s turn.');
        if (action === 'fold') {
            player.fold();
        }
        else if (action === 'call') {
            const amountToCall = this.currentHighestBet - player.currentBet;
            this.pot += player.bet(amountToCall);
        }
        else if (action === 'raise' && amount) {
            const amountToCallAndRaise = (this.currentHighestBet - player.currentBet) + amount;
            this.pot += player.bet(amountToCallAndRaise);
            this.currentHighestBet += amount;
        }
        // Move to next turn... (simplistic turn advancement, doesn't check if round is over)
        this.currentPlayerTurn = this.getNextActivePlayerIndex(this.currentPlayerTurn);
    }
    // --- Serialization ---
    /**
     * Returns the state of the game meant to be broadcasted to ALL players.
     * Strips out the deck and other players' hole cards (unless Showdown).
     */
    getPublicState() {
        return {
            state: this.state,
            pot: this.pot,
            communityCards: this.communityCards,
            currentHighestBet: this.currentHighestBet,
            dealerButtonIndex: this.dealerButtonIndex,
            currentPlayerTurn: this.currentPlayerTurn,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                chips: p.chips,
                currentBet: p.currentBet,
                hasFolded: p.hasFolded,
                // Only show cards if it's showdown, otherwise hide them.
                currentHand: this.state === GameState.Showdown ? p.currentHand : (p.currentHand.length > 0 ? [{ suit: 'hidden', value: 0 }, { suit: 'hidden', value: 0 }] : [])
            })),
        };
    }
    /**
     * Returns the private state for a specific player (their real hand).
     */
    getPrivateState(playerId) {
        const player = this.players.find(p => p.id === playerId);
        return {
            hand: player ? player.currentHand : []
        };
    }
}
exports.Game = Game;
