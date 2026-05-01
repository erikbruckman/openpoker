import { Card } from './models/Card';
import { Deck } from './models/Deck';
import { Player } from './models/Player';
import { HandEvaluator, HandResult } from './utils/HandEvaluator';
import { PlayerAction } from './models/PlayerAction';

import { GameState, PublicGameState, PrivateGameState } from '../shared/types';

export class Game {
  public players: Player[] = [];
  public deck: Deck;
  public communityCards: Card[] = [];
  public pot: number = 0;
  
  public state: GameState = GameState.Waiting;
  public dealerButtonIndex: number = 0;
  public smallBlind: number = 10;
  public bigBlind: number = 20;

  // Track turn logic
  public currentPlayerTurn: number = -1;
  public currentHighestBet: number = 0;

  constructor(public roomCode: string = '') {
    this.deck = new Deck();
  }

  public addPlayer(player: Player): void {
    this.players.push(player);
  }

  public removePlayer(playerId: string): void {
    this.players = this.players.filter(p => p.id !== playerId);
  }

  /**
   * Starts a new hand. Shuffles deck, posts blinds, deals hole cards.
   */
  public startHand(): void {
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
        if (card) player.receiveCards([card]);
      }
    }

    // Set turn to player after big blind
    this.currentPlayerTurn = (bbIndex + 1) % this.players.length;

    // Blinds are forced bets. No one has voluntarily acted yet.
    for (const p of this.players) {
        p.currentAction = PlayerAction.None;
    }
  }

  /**
   * Deals the Flop (3 cards) and updates state.
   */
  public dealFlop(): void {
    if (this.state !== GameState.PreFlop) throw new Error('Cannot deal flop right now.');
    this.deck.draw(); // Burn card
    for (let i = 0; i < 3; i++) {
      const card = this.deck.draw();
      if (card) this.communityCards.push(card);
    }
    this.state = GameState.Flop;
    this.resetBetsForNewRound();
  }

  /**
   * Deals the Turn (1 card) and updates state.
   */
  public dealTurn(): void {
    if (this.state !== GameState.Flop) throw new Error('Cannot deal turn right now.');
    this.deck.draw(); // Burn card
    const card = this.deck.draw();
    if (card) this.communityCards.push(card);
    this.state = GameState.Turn;
    this.resetBetsForNewRound();
  }

  /**
   * Deals the River (1 card) and updates state.
   */
  public dealRiver(): void {
    if (this.state !== GameState.Turn) throw new Error('Cannot deal river right now.');
    this.deck.draw(); // Burn card
    const card = this.deck.draw();
    if (card) this.communityCards.push(card);
    this.state = GameState.River;
    this.resetBetsForNewRound();
  }

  private resetBetsForNewRound(): void {
    this.currentHighestBet = 0;
    for (const player of this.players) {
      player.currentBet = 0;
      if (player.currentAction !== PlayerAction.Fold) {
        player.currentAction = PlayerAction.None;
      }
    }
    // In post-flop rounds, action starts with the first active player after the dealer
    this.currentPlayerTurn = this.getNextActivePlayerIndex(this.dealerButtonIndex);
  }

  /**
   * Scores the hand and awards the pot to the winner(s).
   */
  public scoreHand(): void {
    this.state = GameState.Showdown;

    const activePlayers = this.players.filter(p => p.currentAction !== PlayerAction.Fold);

    if (activePlayers.length === 1) {
      // Everyone else folded
      activePlayers[0].chips += this.pot;
      this.endHand();
      return;
    }

    // Evaluate all hands
    const playerResults: { player: Player; result: HandResult }[] = activePlayers.map(player => ({
      player,
      result: HandEvaluator.evaluate([...player.currentHand, ...this.communityCards]),
    }));

    // Sort descending by hand strength
    playerResults.sort((a, b) => HandEvaluator.compare(b.result, a.result));

    const winners = [playerResults[0].player];
    const bestResult = playerResults[0].result;

    // Check for ties
    for (let i = 1; i < playerResults.length; i++) {
      if (HandEvaluator.compare(bestResult, playerResults[i].result) === 0) {
        winners.push(playerResults[i].player);
      } else {
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

  private endHand(): void {
    this.pot = 0;
    this.state = GameState.Waiting;
    
    // Clean up disconnected players
    this.players = this.players.filter(p => !p.isDisconnected);
    
    if (this.players.length > 0) {
      this.dealerButtonIndex = (this.dealerButtonIndex + 1) % this.players.length;
    } else {
      this.dealerButtonIndex = 0;
    }
  }

  // --- Betting Helpers ---

  public getNextActivePlayerIndex(currentIndex: number): number {
    let index = currentIndex;
    let count = 0;
    while (count < this.players.length) {
      index = (index + 1) % this.players.length;
      if (this.players[index].currentAction !== PlayerAction.Fold && this.players[index].chips > 0) { // ignoring all-ins for simplicity in this basic version
        return index;
      }
      count++;
    }
    return -1;
  }

  // Example action method
  public handlePlayerAction(playerId: string, action: 'fold' | 'call' | 'raise', amount?: number): void {
    const player = this.players[this.currentPlayerTurn];
    if (player.id !== playerId) throw new Error('Not this player\'s turn.');

    if (action === 'fold') {
      player.currentAction = PlayerAction.Fold;
    } else if (action === 'call') {
      const amountToCall = this.currentHighestBet - player.currentBet;
      this.pot += player.bet(amountToCall);
      player.currentAction = amountToCall === 0 ? PlayerAction.Check : PlayerAction.Call;
    } else if (action === 'raise' && amount) {
      const amountToCallAndRaise = (this.currentHighestBet - player.currentBet) + amount;
      this.pot += player.bet(amountToCallAndRaise);
      this.currentHighestBet += amount;
      player.currentAction = PlayerAction.Raise;
      
      // A raise re-opens the betting round for everyone else
      for (const p of this.players) {
        if (p.id !== player.id && p.currentAction !== PlayerAction.Fold) {
          p.currentAction = PlayerAction.None;
        }
      }
    }

    if (this.isBettingRoundOver()) {
      this.advanceGameState();
    } else {
      this.currentPlayerTurn = this.getNextActivePlayerIndex(this.currentPlayerTurn);
    }
  }

  private isBettingRoundOver(): boolean {
    const activePlayers = this.players.filter(p => p.currentAction !== PlayerAction.Fold);
    if (activePlayers.length <= 1) return true; // everyone else folded
    
    // Check if everyone has acted and matched the bet (or is all-in, but assuming chips > 0 for now)
    return activePlayers.every(p => p.currentAction !== PlayerAction.None && p.currentBet === this.currentHighestBet);
  }

  private advanceGameState(): void {
    const activePlayers = this.players.filter(p => p.currentAction !== PlayerAction.Fold);
    if (activePlayers.length <= 1) {
        this.scoreHand();
        return;
    }

    if (this.state === GameState.PreFlop) {
        this.dealFlop();
    } else if (this.state === GameState.Flop) {
        this.dealTurn();
    } else if (this.state === GameState.Turn) {
        this.dealRiver();
    } else if (this.state === GameState.River) {
        this.scoreHand();
    }
  }

  // --- Serialization ---

  /**
   * Returns the state of the game meant to be broadcasted to ALL players.
   * Strips out the deck and other players' hole cards (unless Showdown).
   */
  public getPublicState(): PublicGameState {
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
        currentAction: p.currentAction,
        currentHand: this.state === GameState.Showdown ? p.currentHand : (p.currentHand.length > 0 ? [{suit: 'hidden', value: 0}, {suit: 'hidden', value: 0}] : [])
      })),
    };
  }

  /**
   * Returns the private state for a specific player (their real hand).
   */
  public getPrivateState(playerId: string): PrivateGameState {
    const player = this.players.find(p => p.id === playerId);
    return {
      hand: player ? player.currentHand : []
    };
  }
}
