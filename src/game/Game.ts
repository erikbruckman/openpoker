import { Card } from '../models/Card';
import { Deck } from '../models/Deck';
import { Player } from '../models/Player';
import { PlayerAction, GameState, PublicGameState, PrivateGameState } from '../../shared/types';
import { GAME_CONFIG } from '../config/gameConfig';
import { postBlinds, dealHoleCards, dealCommunityCards } from './Dealing';
import {
  getNextActivePlayerIndex,
  isBettingRoundOver,
  resetBetsForNewRound,
  applyPlayerAction,
} from './BettingRound';
import { resolveShowdown } from './Showdown';
import { serializePublicState, serializePrivateState } from './serialize';

export class Game {
  private _players: Player[] = [];
  private _deck: Deck;
  private _communityCards: Card[] = [];
  private _pot: number = 0;
  private _state: GameState = GameState.Waiting;
  private _dealerButtonIndex: number = 0;
  private _currentPlayerTurn: number = -1;
  private _currentHighestBet: number = 0;

  constructor(public readonly roomCode: string = '') {
    this._deck = new Deck();
  }

  get players(): ReadonlyArray<Player> { return this._players; }
  get communityCards(): ReadonlyArray<Card> { return this._communityCards; }
  get pot(): number { return this._pot; }
  get state(): GameState { return this._state; }
  get dealerButtonIndex(): number { return this._dealerButtonIndex; }
  get currentPlayerTurn(): number { return this._currentPlayerTurn; }
  get currentHighestBet(): number { return this._currentHighestBet; }

  public addPlayer(player: Player): void {
    this._players.push(player);
  }

  public removePlayer(playerId: string): void {
    this._players = this._players.filter(p => p.id !== playerId);
  }

  public startHand(): void {
    if (this._players.length < GAME_CONFIG.minPlayers) {
      throw new Error('Not enough players to start a hand.');
    }

    this._state = GameState.PreFlop;
    this._pot = 0;
    this._communityCards = [];
    this._currentHighestBet = 0;

    for (const player of this._players) {
      player.resetForNewHand();
    }

    this._deck.initialize();
    this._deck.shuffle();

    const sbIndex = (this._dealerButtonIndex + 1) % this._players.length;
    const bbIndex = (this._dealerButtonIndex + 2) % this._players.length;

    this._pot += postBlinds(this._players, sbIndex, bbIndex, GAME_CONFIG.smallBlind, GAME_CONFIG.bigBlind);
    this._currentHighestBet = GAME_CONFIG.bigBlind;

    dealHoleCards(this._deck, this._players);

    this._currentPlayerTurn = (bbIndex + 1) % this._players.length;
  }

  private dealFlop(): void {
    if (this._state !== GameState.PreFlop) throw new Error('Cannot deal flop right now.');
    this._communityCards.push(...dealCommunityCards(this._deck, 3));
    this._state = GameState.Flop;
    this.advanceAfterDeal();
  }

  private dealTurn(): void {
    if (this._state !== GameState.Flop) throw new Error('Cannot deal turn right now.');
    this._communityCards.push(...dealCommunityCards(this._deck, 1));
    this._state = GameState.Turn;
    this.advanceAfterDeal();
  }

  private dealRiver(): void {
    if (this._state !== GameState.Turn) throw new Error('Cannot deal river right now.');
    this._communityCards.push(...dealCommunityCards(this._deck, 1));
    this._state = GameState.River;
    this.advanceAfterDeal();
  }

  private advanceAfterDeal(): void {
    this._currentHighestBet = 0;
    const nextTurn = resetBetsForNewRound(this._players, this._dealerButtonIndex);
    this._currentPlayerTurn = nextTurn;
    // When every remaining player is all-in, no one can act — run out the board automatically.
    if (this._currentPlayerTurn === -1) {
      this.advanceGameState();
    }
  }

  public scoreHand(): void {
    this._state = GameState.Showdown;
    resolveShowdown(this._players, this._communityCards);
    this.endHand();
  }

  private endHand(): void {
    this._pot = 0;
    this._state = GameState.Waiting;
    this._players = this._players.filter(p => !p.isDisconnected);
    if (this._players.length > 0) {
      this._dealerButtonIndex = (this._dealerButtonIndex + 1) % this._players.length;
    } else {
      this._dealerButtonIndex = 0;
    }
  }

  public getNextActivePlayerIndex(currentIndex: number): number {
    return getNextActivePlayerIndex(this._players, currentIndex);
  }

  public handlePlayerAction(playerId: string, action: PlayerAction, amount?: number): void {
    const result = applyPlayerAction(
      this._players, this._currentPlayerTurn, this._currentHighestBet,
      playerId, action, amount
    );
    this._pot += result.potIncrease;
    this._currentHighestBet = result.newHighestBet;

    if (isBettingRoundOver(this._players, this._currentHighestBet)) {
      this.advanceGameState();
    } else {
      this._currentPlayerTurn = getNextActivePlayerIndex(this._players, this._currentPlayerTurn);
    }
  }

  private advanceGameState(): void {
    const activePlayers = this._players.filter(p => p.currentAction !== PlayerAction.Fold);
    if (activePlayers.length <= 1) {
      this.scoreHand();
      return;
    }
    if (this._state === GameState.PreFlop) {
      this.dealFlop();
    } else if (this._state === GameState.Flop) {
      this.dealTurn();
    } else if (this._state === GameState.Turn) {
      this.dealRiver();
    } else if (this._state === GameState.River) {
      this.scoreHand();
    }
  }

  public getPublicState(): PublicGameState {
    return serializePublicState(
      this._state,
      this._pot,
      this._communityCards,
      this._players,
      this._currentHighestBet,
      this._dealerButtonIndex,
      this._currentPlayerTurn
    );
  }

  public getPrivateState(playerId: string): PrivateGameState {
    return serializePrivateState(this._players, playerId);
  }
}
