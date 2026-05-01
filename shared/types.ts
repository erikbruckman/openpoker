export enum Suit {
  Hearts = 'Hearts',
  Diamonds = 'Diamonds',
  Clubs = 'Clubs',
  Spades = 'Spades',
  Hidden = 'hidden', // Used by frontend for facedown cards
}

export enum Rank {
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
  Jack = 11,
  Queen = 12,
  King = 13,
  Ace = 14,
  Hidden = 0, // Used by frontend for facedown cards
}

export interface ICard {
  suit: Suit | string;
  value: Rank | number;
}

export enum GameState {
  Waiting = 'Waiting',
  PreFlop = 'PreFlop',
  Flop = 'Flop',
  Turn = 'Turn',
  River = 'River',
  Showdown = 'Showdown',
}

export enum PlayerAction {
  None = 'None',
  Fold = 'Fold',
  Check = 'Check',
  Call = 'Call',
  Raise = 'Raise',
}

export interface PlayerData {
  id: string;
  name: string;
  chips: number;
  currentBet: number;
  currentAction: PlayerAction;
  currentHand: ICard[];
}

export interface PublicGameState {
  state: GameState;
  pot: number;
  communityCards: ICard[];
  currentHighestBet: number;
  dealerButtonIndex: number;
  currentPlayerTurn: number;
  players: PlayerData[];
}

export interface PrivateGameState {
  hand: ICard[];
}
