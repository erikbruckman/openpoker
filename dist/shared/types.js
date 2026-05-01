"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerAction = exports.GameState = exports.Rank = exports.Suit = void 0;
var Suit;
(function (Suit) {
    Suit["Hearts"] = "Hearts";
    Suit["Diamonds"] = "Diamonds";
    Suit["Clubs"] = "Clubs";
    Suit["Spades"] = "Spades";
    Suit["Hidden"] = "hidden";
})(Suit || (exports.Suit = Suit = {}));
var Rank;
(function (Rank) {
    Rank[Rank["Two"] = 2] = "Two";
    Rank[Rank["Three"] = 3] = "Three";
    Rank[Rank["Four"] = 4] = "Four";
    Rank[Rank["Five"] = 5] = "Five";
    Rank[Rank["Six"] = 6] = "Six";
    Rank[Rank["Seven"] = 7] = "Seven";
    Rank[Rank["Eight"] = 8] = "Eight";
    Rank[Rank["Nine"] = 9] = "Nine";
    Rank[Rank["Ten"] = 10] = "Ten";
    Rank[Rank["Jack"] = 11] = "Jack";
    Rank[Rank["Queen"] = 12] = "Queen";
    Rank[Rank["King"] = 13] = "King";
    Rank[Rank["Ace"] = 14] = "Ace";
    Rank[Rank["Hidden"] = 0] = "Hidden";
})(Rank || (exports.Rank = Rank = {}));
var GameState;
(function (GameState) {
    GameState["Waiting"] = "Waiting";
    GameState["PreFlop"] = "PreFlop";
    GameState["Flop"] = "Flop";
    GameState["Turn"] = "Turn";
    GameState["River"] = "River";
    GameState["Showdown"] = "Showdown";
})(GameState || (exports.GameState = GameState = {}));
var PlayerAction;
(function (PlayerAction) {
    PlayerAction["None"] = "None";
    PlayerAction["Fold"] = "Fold";
    PlayerAction["Check"] = "Check";
    PlayerAction["Call"] = "Call";
    PlayerAction["Raise"] = "Raise";
})(PlayerAction || (exports.PlayerAction = PlayerAction = {}));
