import { Card } from './Card';
import { PlayerAction } from '../../shared/types';

export class Player {
  public currentHand: Card[] = [];
  public chips: number;
  public currentBet: number = 0;
  public currentAction: PlayerAction = PlayerAction.None;
  public socketId: string = '';
  public isDisconnected: boolean = false;
  public contributedThisHand: number = 0;

  constructor(public id: string, public name: string, initialChips: number = 1000) {
    this.chips = initialChips;
  }

  public resetForNewHand(): void {
    this.currentHand = [];
    this.currentBet = 0;
    this.currentAction = PlayerAction.None;
    this.contributedThisHand = 0;
  }

  public receiveCards(cards: Card[]): void {
    this.currentHand.push(...cards);
  }

  public bet(amount: number): number {
    const actualBet = Math.min(this.chips, amount);
    this.chips -= actualBet;
    this.currentBet += actualBet;
    this.contributedThisHand += actualBet;
    return actualBet;
  }

  public fold(): void {
    this.currentAction = PlayerAction.Fold;
  }
}
