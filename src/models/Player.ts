import { Card } from './Card';
import { PlayerAction } from '../../shared/types';

export class Player {
  private _currentHand: Card[] = [];
  private _chips: number;
  private _currentBet: number = 0;
  private _currentAction: PlayerAction = PlayerAction.None;
  private _contributedThisHand: number = 0;

  public socketId: string = '';
  public isDisconnected: boolean = false;

  constructor(public readonly id: string, public name: string, initialChips: number = 1000) {
    this._chips = initialChips;
  }

  get currentHand(): ReadonlyArray<Card> { return this._currentHand; }
  get chips(): number { return this._chips; }
  get currentBet(): number { return this._currentBet; }
  get currentAction(): PlayerAction { return this._currentAction; }
  get contributedThisHand(): number { return this._contributedThisHand; }

  public setAction(action: PlayerAction): void {
    this._currentAction = action;
  }

  public addChips(amount: number): void {
    this._chips += amount;
  }

  public beginBettingRound(): void {
    this._currentBet = 0;
    if (this._currentAction !== PlayerAction.Fold) {
      this._currentAction = PlayerAction.None;
    }
  }

  public resetForNewHand(): void {
    this._currentHand = [];
    this._currentBet = 0;
    this._currentAction = PlayerAction.None;
    this._contributedThisHand = 0;
  }

  public receiveCards(cards: Card[]): void {
    this._currentHand.push(...cards);
  }

  public bet(amount: number): number {
    const actualBet = Math.min(this._chips, amount);
    this._chips -= actualBet;
    this._currentBet += actualBet;
    this._contributedThisHand += actualBet;
    return actualBet;
  }

  public fold(): void {
    this._currentAction = PlayerAction.Fold;
  }
}
