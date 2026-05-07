import { Card } from './Card';
import { PlayerAction } from '../../shared/types';

export class Player {
  public currentHand: Card[] = [];
  public chips: number;
  public currentBet: number = 0;
  public currentAction: PlayerAction = PlayerAction.None;
  public socketId: string = '';
  public isDisconnected: boolean = false;

  constructor(public id: string, public name: string, initialChips: number = 1000) {
    this.chips = initialChips;
  }

  /**
   * Resets the player's state for a new hand.
   */
  public resetForNewHand(): void {
    this.currentHand = [];
    this.currentBet = 0;
    this.currentAction = PlayerAction.None;
  }

  /**
   * Receives cards to add to the hand.
   */
  public receiveCards(cards: Card[]): void {
    this.currentHand.push(...cards);
  }

  /**
   * Bets a certain amount of chips.
   * Returns the actual amount bet (in case player has fewer chips than requested).
   */
  public bet(amount: number): number {
    const actualBet = Math.min(this.chips, amount);
    this.chips -= actualBet;
    this.currentBet += actualBet;
    return actualBet;
  }

  /**
   * Folds the current hand.
   */
  public fold(): void {
    this.currentAction = PlayerAction.Fold;
  }
}
