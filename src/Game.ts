import { Card } from './models/Card';
import { Deck } from './models/Deck';
import { Player } from './models/Player';
import { HandEvaluator, HandResult } from './utils/HandEvaluator';
import { PlayerAction, GameState, PublicGameState, PrivateGameState } from '../shared/types';
import { GAME_CONFIG } from './config/gameConfig';

export class Game {
  public players: Player[] = [];
  public deck: Deck;
  public communityCards: Card[] = [];
  public pot: number = 0;

  public state: GameState = GameState.Waiting;
  public dealerButtonIndex: number = 0;
  public smallBlind: number = GAME_CONFIG.smallBlind;
  public bigBlind: number = GAME_CONFIG.bigBlind;

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

  public startHand(): void {
    if (this.players.length < GAME_CONFIG.minPlayers) {
      throw new Error('Not enough players to start a hand.');
    }

    this.state = GameState.PreFlop;
    this.pot = 0;
    this.communityCards = [];
    this.currentHighestBet = 0;

    for (const player of this.players) {
      player.resetForNewHand();
    }

    this.deck.initialize();
    this.deck.shuffle();

    const sbIndex = (this.dealerButtonIndex + 1) % this.players.length;
    const bbIndex = (this.dealerButtonIndex + 2) % this.players.length;

    this.pot += this.players[sbIndex].bet(this.smallBlind);
    this.pot += this.players[bbIndex].bet(this.bigBlind);
    this.currentHighestBet = this.bigBlind;

    for (let i = 0; i < 2; i++) {
      for (const player of this.players) {
        const card = this.deck.draw();
        if (card) player.receiveCards([card]);
      }
    }

    this.currentPlayerTurn = (bbIndex + 1) % this.players.length;

    for (const p of this.players) {
      p.currentAction = PlayerAction.None;
    }
  }

  public dealFlop(): void {
    if (this.state !== GameState.PreFlop) throw new Error('Cannot deal flop right now.');
    this.deck.draw(); // burn
    for (let i = 0; i < 3; i++) {
      const card = this.deck.draw();
      if (card) this.communityCards.push(card);
    }
    this.state = GameState.Flop;
    this.resetBetsForNewRound();
  }

  public dealTurn(): void {
    if (this.state !== GameState.Flop) throw new Error('Cannot deal turn right now.');
    this.deck.draw(); // burn
    const card = this.deck.draw();
    if (card) this.communityCards.push(card);
    this.state = GameState.Turn;
    this.resetBetsForNewRound();
  }

  public dealRiver(): void {
    if (this.state !== GameState.Turn) throw new Error('Cannot deal river right now.');
    this.deck.draw(); // burn
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
    this.currentPlayerTurn = this.getNextActivePlayerIndex(this.dealerButtonIndex);

    // When every remaining player is all-in, no one can act — run out the board automatically.
    if (this.currentPlayerTurn === -1) {
      this.advanceGameState();
    }
  }

  public scoreHand(): void {
    this.state = GameState.Showdown;

    const activePlayers = this.players.filter(p => p.currentAction !== PlayerAction.Fold);

    if (activePlayers.length === 1) {
      activePlayers[0].chips += this.pot;
      this.endHand();
      return;
    }

    const playerResults: { player: Player; result: HandResult }[] = activePlayers.map(player => ({
      player,
      result: HandEvaluator.evaluate([...player.currentHand, ...this.communityCards]),
    }));

    for (const sidePot of this.computeSidePots()) {
      const eligibleResults = playerResults.filter(r =>
        sidePot.eligible.some(e => e.id === r.player.id)
      );
      eligibleResults.sort((a, b) => HandEvaluator.compare(b.result, a.result));

      const winners = [eligibleResults[0].player];
      const bestResult = eligibleResults[0].result;

      for (let i = 1; i < eligibleResults.length; i++) {
        if (HandEvaluator.compare(bestResult, eligibleResults[i].result) === 0) {
          winners.push(eligibleResults[i].player);
        } else {
          break;
        }
      }

      const splitAmount = Math.floor(sidePot.amount / winners.length);
      const remainder = sidePot.amount % winners.length;
      for (const winner of winners) {
        winner.chips += splitAmount;
      }
      // Odd chip goes to the first eligible winner (closest to dealer's left in the array).
      winners[0].chips += remainder;
    }

    this.endHand();
  }

  private computeSidePots(): Array<{ amount: number; eligible: Player[] }> {
    const pots: Array<{ amount: number; eligible: Player[] }> = [];
    const remaining = new Map(this.players.map(p => [p.id, p.contributedThisHand]));
    const folded = new Set(
      this.players.filter(p => p.currentAction === PlayerAction.Fold).map(p => p.id)
    );

    while (true) {
      let minContrib = Infinity;
      for (const contrib of remaining.values()) {
        if (contrib > 0 && contrib < minContrib) minContrib = contrib;
      }
      if (minContrib === Infinity) break;

      let potAmount = 0;
      const eligible: Player[] = [];

      for (const player of this.players) {
        const contrib = remaining.get(player.id)!;
        if (contrib > 0) {
          const take = Math.min(contrib, minContrib);
          potAmount += take;
          remaining.set(player.id, contrib - take);
          if (!folded.has(player.id)) eligible.push(player);
        }
      }

      pots.push({ amount: potAmount, eligible });
    }

    return pots;
  }

  private endHand(): void {
    this.pot = 0;
    this.state = GameState.Waiting;
    this.players = this.players.filter(p => !p.isDisconnected);
    if (this.players.length > 0) {
      this.dealerButtonIndex = (this.dealerButtonIndex + 1) % this.players.length;
    } else {
      this.dealerButtonIndex = 0;
    }
  }

  public getNextActivePlayerIndex(currentIndex: number): number {
    let index = currentIndex;
    let count = 0;
    while (count < this.players.length) {
      index = (index + 1) % this.players.length;
      const player = this.players[index];
      if (player.currentAction !== PlayerAction.Fold && player.chips > 0) {
        return index;
      }
      count++;
    }
    return -1;
  }

  public handlePlayerAction(playerId: string, action: PlayerAction, amount?: number): void {
    const player = this.players[this.currentPlayerTurn];
    if (!player || player.id !== playerId) throw new Error("Not this player's turn.");

    if (action === PlayerAction.Fold) {
      player.currentAction = PlayerAction.Fold;
    } else if (action === PlayerAction.Check) {
      if (this.currentHighestBet !== player.currentBet) {
        throw new Error('Cannot check when there is an outstanding bet.');
      }
      player.currentAction = PlayerAction.Check;
    } else if (action === PlayerAction.Call) {
      const amountToCall = this.currentHighestBet - player.currentBet;
      this.pot += player.bet(amountToCall);
      player.currentAction = amountToCall === 0 ? PlayerAction.Check : PlayerAction.Call;
    } else if (action === PlayerAction.Raise && amount !== undefined && amount > 0) {
      const amountToCallAndRaise = (this.currentHighestBet - player.currentBet) + amount;
      this.pot += player.bet(amountToCallAndRaise);
      const newBet = player.currentBet;
      if (newBet > this.currentHighestBet) {
        this.currentHighestBet = newBet;
        // A raise re-opens betting for everyone who can still act.
        for (const p of this.players) {
          if (p.id !== player.id && p.currentAction !== PlayerAction.Fold && p.chips > 0) {
            p.currentAction = PlayerAction.None;
          }
        }
      }
      player.currentAction = PlayerAction.Raise;
    } else {
      throw new Error('Invalid action or missing raise amount.');
    }

    if (this.isBettingRoundOver()) {
      this.advanceGameState();
    } else {
      this.currentPlayerTurn = this.getNextActivePlayerIndex(this.currentPlayerTurn);
    }
  }

  private isBettingRoundOver(): boolean {
    const activePlayers = this.players.filter(p => p.currentAction !== PlayerAction.Fold);
    if (activePlayers.length <= 1) return true;
    return activePlayers.every(p =>
      p.chips === 0 || // all-in players have no further obligation
      (p.currentAction !== PlayerAction.None && p.currentBet === this.currentHighestBet)
    );
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
        currentHand:
          this.state === GameState.Showdown
            ? p.currentHand
            : p.currentHand.length > 0
            ? [{ suit: 'hidden', value: 0 }, { suit: 'hidden', value: 0 }]
            : [],
      })),
    };
  }

  public getPrivateState(playerId: string): PrivateGameState {
    const player = this.players.find(p => p.id === playerId);
    return { hand: player ? player.currentHand : [] };
  }
}
