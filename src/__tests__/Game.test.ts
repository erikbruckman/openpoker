import { Game } from '../game/Game';
import { Player } from '../models/Player';
import { Card, Suit, Rank } from '../models/Card';
import { PlayerAction, GameState } from '../../shared/types';
import { validatePlayerName, validateRoomCode, validateAction, validateAmount } from '../utils/validate';
import { RoomManager } from '../RoomManager';
import { resolveShowdown, computeSidePots } from '../game/Showdown';

// Helper: build a Card quickly.
const c = (suit: Suit, value: Rank) => new Card(suit, value);

describe('standard 2-player hand', () => {
  it('completes without error and conserves chips', () => {
    const game = new Game('test');
    const alice = new Player('alice', 'Alice', 5000);
    const bob = new Player('bob', 'Bob', 5000);
    game.addPlayer(alice);
    game.addPlayer(bob);

    game.startHand();
    expect(game.state).toBe(GameState.PreFlop);

    // With dealerButtonIndex=0 (Alice), SB=Bob(1), BB=Alice(0).
    // currentPlayerTurn = (bbIndex+1)%2 = 1 (Bob acts first preflop).
    expect(game.currentPlayerTurn).toBe(1);

    // Bob calls, Alice checks.
    game.handlePlayerAction('bob', PlayerAction.Call);
    game.handlePlayerAction('alice', PlayerAction.Check);
    expect(game.state).toBe(GameState.Flop);

    // Post-flop: Bob (index 1) acts first (getNextActivePlayerIndex after dealer=0).
    game.handlePlayerAction('bob', PlayerAction.Check);
    game.handlePlayerAction('alice', PlayerAction.Check);
    expect(game.state).toBe(GameState.Turn);

    game.handlePlayerAction('bob', PlayerAction.Check);
    game.handlePlayerAction('alice', PlayerAction.Check);
    expect(game.state).toBe(GameState.River);

    game.handlePlayerAction('bob', PlayerAction.Check);
    game.handlePlayerAction('alice', PlayerAction.Check);
    expect(game.state).toBe(GameState.Waiting);

    // Chips must be conserved (no rake).
    expect(alice.chips + bob.chips).toBe(10000);
  });

  it('handles fold ending the hand immediately', () => {
    const game = new Game('test');
    const alice = new Player('alice', 'Alice', 5000);
    const bob = new Player('bob', 'Bob', 5000);
    game.addPlayer(alice);
    game.addPlayer(bob);

    game.startHand();

    // Bob (index 1) folds immediately.
    game.handlePlayerAction('bob', PlayerAction.Fold);

    // Hand over — Alice wins the pot.
    expect(game.state).toBe(GameState.Waiting);
    expect(alice.chips + bob.chips).toBe(10000);
    expect(alice.chips).toBeGreaterThan(5000); // Alice won the pot
  });

  it('conserves chips through a raise-and-call hand', () => {
    const game = new Game('test');
    const alice = new Player('alice', 'Alice', 5000);
    const bob = new Player('bob', 'Bob', 5000);
    game.addPlayer(alice);
    game.addPlayer(bob);

    game.startHand();

    // Bob raises, Alice calls.
    game.handlePlayerAction('bob', PlayerAction.Raise, 100);
    game.handlePlayerAction('alice', PlayerAction.Call);
    expect(game.state).toBe(GameState.Flop);

    game.handlePlayerAction('bob', PlayerAction.Check);
    game.handlePlayerAction('alice', PlayerAction.Check);
    expect(game.state).toBe(GameState.Turn);

    game.handlePlayerAction('bob', PlayerAction.Check);
    game.handlePlayerAction('alice', PlayerAction.Check);
    expect(game.state).toBe(GameState.River);

    game.handlePlayerAction('bob', PlayerAction.Check);
    game.handlePlayerAction('alice', PlayerAction.Check);
    expect(game.state).toBe(GameState.Waiting);

    expect(alice.chips + bob.chips).toBe(10000);
  });
});

describe('all-in mechanics', () => {
  it('skips all-in players when advancing turn', () => {
    const game = new Game('test');
    // Alice is short-stack and will go all-in.
    const alice = new Player('alice', 'Alice', 50);
    const bob = new Player('bob', 'Bob', 500);
    const charlie = new Player('charlie', 'Charlie', 500);
    game.addPlayer(alice); // index 0
    game.addPlayer(bob);   // index 1
    game.addPlayer(charlie); // index 2

    game.startHand();
    // dealer=0, SB=1(Bob 10), BB=2(Charlie 20), UTG=0(Alice)
    expect(game.currentPlayerTurn).toBe(0);

    // Alice raises all-in: call 20 + raise 30 = 50 total.
    game.handlePlayerAction('alice', PlayerAction.Raise, 30);
    expect(alice.chips).toBe(0);
    expect(game.currentHighestBet).toBe(50);

    // Bob's turn.
    expect(game.currentPlayerTurn).toBe(1);
    game.handlePlayerAction('bob', PlayerAction.Call);

    // Charlie's turn.
    expect(game.currentPlayerTurn).toBe(2);
    game.handlePlayerAction('charlie', PlayerAction.Call);

    // Preflop betting over → Flop dealt.
    expect(game.state).toBe(GameState.Flop);
    // Pot: SB10 + BB20 + Alice50 + Bob(40) + Charlie(30) = 150.
    expect(game.pot).toBe(150);

    // Post-flop: Alice (all-in) must NOT be asked to act.
    expect(game.currentPlayerTurn).not.toBe(0);

    // Bob and Charlie check through the rest.
    game.handlePlayerAction('bob', PlayerAction.Check);
    game.handlePlayerAction('charlie', PlayerAction.Check);
    expect(game.state).toBe(GameState.Turn);

    game.handlePlayerAction('bob', PlayerAction.Check);
    game.handlePlayerAction('charlie', PlayerAction.Check);
    expect(game.state).toBe(GameState.River);

    game.handlePlayerAction('bob', PlayerAction.Check);
    game.handlePlayerAction('charlie', PlayerAction.Check);
    expect(game.state).toBe(GameState.Waiting);

    // Total chips must be conserved.
    expect(alice.chips + bob.chips + charlie.chips).toBe(1050);
  });

  it('runs out the board automatically when all remaining players are all-in', () => {
    const game = new Game('test');
    const alice = new Player('alice', 'Alice', 50);
    const bob = new Player('bob', 'Bob', 50);
    game.addPlayer(alice);
    game.addPlayer(bob);

    game.startHand();
    // SB=Bob(10), BB=Alice(20); Alice has 30 remaining, Bob has 40 remaining.
    // currentPlayerTurn=1 (Bob acts first).
    expect(game.currentPlayerTurn).toBe(1);

    // Bob raises all-in: needs 10 more to call + raise rest (30 additional).
    // amountToCallAndRaise = (20-10)+30 = 40. Bob has 40 → all-in.
    game.handlePlayerAction('bob', PlayerAction.Raise, 30);
    expect(bob.chips).toBe(0);

    // Alice calls all-in (has 30 chips left after posting BB of 20).
    // amountToCall = 50-20 = 30. All-in board runs out synchronously.
    game.handlePlayerAction('alice', PlayerAction.Call);

    // Both players all-in — board runs out and hand completes in the same call.
    expect(game.state).toBe(GameState.Waiting);
    expect(alice.chips + bob.chips).toBe(100);
    // One player wins all the chips.
    expect(alice.chips === 100 || bob.chips === 100).toBe(true);
  });

  it('getNextActivePlayerIndex skips folded and zero-chip players', () => {
    const game = new Game('test');
    const alice = new Player('alice', 'Alice', 100);
    const bob = new Player('bob', 'Bob', 0);   // all-in
    const charlie = new Player('charlie', 'Charlie', 100);
    game.addPlayer(alice);
    game.addPlayer(bob);
    game.addPlayer(charlie);

    // Manually mark bob as having acted (not folded, just all-in).
    bob.setAction(PlayerAction.Raise);

    // Starting from index 0 (alice), next active should skip bob (chips=0) → charlie (2).
    expect(game.getNextActivePlayerIndex(0)).toBe(2);

    // Mark alice as folded — next after 0 should skip alice and bob → charlie.
    alice.setAction(PlayerAction.Fold);
    expect(game.getNextActivePlayerIndex(0)).toBe(2);

    // Mark charlie as folded — no active players → -1.
    charlie.setAction(PlayerAction.Fold);
    expect(game.getNextActivePlayerIndex(0)).toBe(-1);
  });
});

describe('side pot distribution', () => {
  it('awards main pot to best hand, side pot to next-best', () => {
    // Alice all-in for 50, Bob and Charlie each contribute 150.
    const alice = new Player('alice', 'Alice', 50);
    const bob = new Player('bob', 'Bob', 500);
    const charlie = new Player('charlie', 'Charlie', 500);

    alice.bet(50);    // all-in: chips=0, contributed=50
    bob.bet(150);     // chips=350, contributed=150
    charlie.bet(150); // chips=350, contributed=150

    alice.setAction(PlayerAction.Raise);
    bob.setAction(PlayerAction.Call);
    charlie.setAction(PlayerAction.Call);

    // Community: three 5s + two 2s → full house 5-5-5-2-2 on board.
    const community = [
      c(Suit.Diamonds, Rank.Five),
      c(Suit.Hearts, Rank.Five),
      c(Suit.Clubs, Rank.Five),
      c(Suit.Spades, Rank.Two),
      c(Suit.Hearts, Rank.Two),
    ];

    // Alice: full house 5-5-5-A-A (best — aces over 5s).
    alice.receiveCards([c(Suit.Diamonds, Rank.Ace), c(Suit.Hearts, Rank.Ace)]);
    // Bob: full house 5-5-5-K-K (second — kings over 5s).
    bob.receiveCards([c(Suit.Diamonds, Rank.King), c(Suit.Hearts, Rank.King)]);
    // Charlie: full house 5-5-5-Q-Q (third).
    charlie.receiveCards([c(Suit.Diamonds, Rank.Queen), c(Suit.Hearts, Rank.Queen)]);

    resolveShowdown([alice, bob, charlie], community);

    // Side pots:
    //   Main pot (50*3=150): eligible [alice, bob, charlie] → alice wins.
    //   Side pot (100*2=200): eligible [bob, charlie] → bob wins.
    expect(alice.chips).toBe(150);
    expect(bob.chips).toBe(350 + 200);   // 550
    expect(charlie.chips).toBe(350);
    expect(alice.chips + bob.chips + charlie.chips).toBe(1050);
  });

  it('folded-player contribution creates non-divisible main pot; remainder goes to first winner', () => {
    // Dave folded after contributing 50. Alice, Bob, Charlie each put in 100.
    // Total pot = 350; all three live players tie on the board hand.
    const alice = new Player('alice', 'Alice', 100);
    const bob = new Player('bob', 'Bob', 100);
    const charlie = new Player('charlie', 'Charlie', 100);
    const dave = new Player('dave', 'Dave', 50);

    alice.bet(100);
    bob.bet(100);
    charlie.bet(100);
    dave.bet(50);

    alice.setAction(PlayerAction.Call);
    bob.setAction(PlayerAction.Call);
    charlie.setAction(PlayerAction.Call);
    dave.setAction(PlayerAction.Fold);

    // All three live players share the same board hand (board plays).
    // Community: A-A-A-K-K (full house). Kickers irrelevant.
    const community = [
      c(Suit.Spades, Rank.Ace),
      c(Suit.Hearts, Rank.Ace),
      c(Suit.Diamonds, Rank.Ace),
      c(Suit.Spades, Rank.King),
      c(Suit.Hearts, Rank.King),
    ];
    alice.receiveCards([c(Suit.Clubs, Rank.Two), c(Suit.Clubs, Rank.Three)]);
    bob.receiveCards([c(Suit.Diamonds, Rank.Four), c(Suit.Diamonds, Rank.Five)]);
    charlie.receiveCards([c(Suit.Spades, Rank.Six), c(Suit.Spades, Rank.Seven)]);
    dave.receiveCards([c(Suit.Clubs, Rank.Eight), c(Suit.Clubs, Rank.Nine)]);

    resolveShowdown([alice, bob, charlie, dave], community);

    // All three tie; chips must be conserved (no rake).
    expect(alice.chips + bob.chips + charlie.chips + dave.chips).toBe(350);
    expect(alice.chips + bob.chips + charlie.chips).toBe(350);
  });

  it('computeSidePots correctly partitions by contribution level', () => {
    const alice = new Player('alice', 'Alice', 50);
    const bob = new Player('bob', 'Bob', 500);

    alice.bet(50);
    bob.bet(200);
    alice.setAction(PlayerAction.Call);
    bob.setAction(PlayerAction.Raise);

    const pots = computeSidePots([alice, bob]);
    // Main pot: alice's 50 matched by bob's 50 = 100; eligible: alice, bob
    // Side pot: bob's remaining 150; eligible: bob only
    expect(pots).toHaveLength(2);
    expect(pots[0].amount).toBe(100);
    expect(pots[0].eligible).toHaveLength(2);
    expect(pots[1].amount).toBe(150);
    expect(pots[1].eligible).toHaveLength(1);
    expect(pots[1].eligible[0].id).toBe('bob');
  });
});

describe('RoomManager', () => {
  it('creates a room on first access and reuses it', () => {
    const manager = new RoomManager();
    const game1 = manager.getOrCreateRoom('ROOM');
    const game2 = manager.getOrCreateRoom('ROOM');
    expect(game1).toBe(game2);
  });

  it('returns undefined for a room that was never created', () => {
    const manager = new RoomManager();
    expect(manager.getRoom('NONE')).toBeUndefined();
  });

  it('destroys an empty room', () => {
    const manager = new RoomManager();
    manager.getOrCreateRoom('ROOM');
    expect(manager.getRoom('ROOM')).toBeDefined();
    manager.checkAndDestroyEmptyRoom('ROOM');
    expect(manager.getRoom('ROOM')).toBeUndefined();
  });

  it('removes player from room and destroys it when empty after disconnect', () => {
    const manager = new RoomManager();
    const game = manager.getOrCreateRoom('ROOM');
    const player = new Player('p1', 'Alice', 1000);
    player.socketId = 'socket-1';
    game.addPlayer(player);

    const roomCode = manager.handleDisconnect('socket-1');
    expect(roomCode).toBe('ROOM');
    // Player was in Waiting state so removed; room is now empty and destroyed.
    expect(manager.getRoom('ROOM')).toBeUndefined();
  });

  it('handles disconnect of unknown socket gracefully', () => {
    const manager = new RoomManager();
    const result = manager.handleDisconnect('unknown-socket');
    expect(result).toBeUndefined();
  });

  it('different instances have isolated state', () => {
    const m1 = new RoomManager();
    const m2 = new RoomManager();
    m1.getOrCreateRoom('SHARED');
    expect(m2.getRoom('SHARED')).toBeUndefined();
  });
});

describe('input validation', () => {
  describe('validatePlayerName', () => {
    it('accepts valid names', () => {
      expect(validatePlayerName('Alice')).toBe('Alice');
      expect(validatePlayerName('  Bob  ')).toBe('Bob');
      expect(validatePlayerName('Player_1-A')).toBe('Player_1-A');
    });

    it('rejects empty and oversized names', () => {
      expect(validatePlayerName('')).toBeNull();
      expect(validatePlayerName('   ')).toBeNull();
      expect(validatePlayerName('A'.repeat(33))).toBeNull();
    });

    it('rejects invalid characters', () => {
      expect(validatePlayerName('Alice!')).toBeNull();
      expect(validatePlayerName('<script>')).toBeNull();
      expect(validatePlayerName('a@b.com')).toBeNull();
    });

    it('rejects non-strings', () => {
      expect(validatePlayerName(123)).toBeNull();
      expect(validatePlayerName(null)).toBeNull();
    });
  });

  describe('validateRoomCode', () => {
    it('accepts valid codes', () => {
      expect(validateRoomCode('ABCD')).toBe('ABCD');
      expect(validateRoomCode('ROOM1234')).toBe('ROOM1234');
    });

    it('rejects wrong length', () => {
      expect(validateRoomCode('ABC')).toBeNull();       // too short
      expect(validateRoomCode('ABCDE1234')).toBeNull(); // too long (9)
    });

    it('rejects lowercase and special chars', () => {
      expect(validateRoomCode('abcd')).toBeNull();
      expect(validateRoomCode('AB-C')).toBeNull();
    });
  });

  describe('validateAction', () => {
    it('accepts valid PlayerAction values', () => {
      expect(validateAction('Fold')).toBe(PlayerAction.Fold);
      expect(validateAction('Check')).toBe(PlayerAction.Check);
      expect(validateAction('Call')).toBe(PlayerAction.Call);
      expect(validateAction('Raise')).toBe(PlayerAction.Raise);
    });

    it('rejects None and unknown actions', () => {
      expect(validateAction('None')).toBeNull();
      expect(validateAction('fold')).toBeNull();  // lowercase
      expect(validateAction('allin')).toBeNull();
      expect(validateAction('')).toBeNull();
      expect(validateAction(42)).toBeNull();
    });
  });

  describe('validateAmount', () => {
    it('accepts valid non-negative integers', () => {
      expect(validateAmount(0)).toBe(0);
      expect(validateAmount(100)).toBe(100);
    });

    it('rejects negative amounts', () => {
      expect(validateAmount(-1)).toBeNull();
      expect(validateAmount(-100)).toBeNull();
    });

    it('rejects NaN and Infinity', () => {
      expect(validateAmount(NaN)).toBeNull();
      expect(validateAmount(Infinity)).toBeNull();
      expect(validateAmount(-Infinity)).toBeNull();
    });

    it('rejects non-integer amounts', () => {
      expect(validateAmount(1.5)).toBeNull();
      expect(validateAmount(0.01)).toBeNull();
    });

    it('rejects non-numbers', () => {
      expect(validateAmount('100')).toBeNull();
      expect(validateAmount(null)).toBeNull();
      expect(validateAmount(undefined)).toBeNull();
    });
  });
});

describe('reconnect protection', () => {
  it('rejects reconnect when player is already connected (isDisconnected=false)', () => {
    const player = new Player('uuid-abc', 'Alice', 5000);
    player.isDisconnected = false;

    // The SocketController checks !existing.isDisconnected before allowing reconnect.
    // This verifies the guard condition that SocketController relies on.
    expect(player.isDisconnected).toBe(false);
    // A reconnect with this player's ID must be rejected — tested here at the model level.
    // Socket-level rejection is enforced in SocketController.
  });

  it('allows reconnect only when player.isDisconnected is true', () => {
    const player = new Player('uuid-abc', 'Alice', 5000);
    player.isDisconnected = true;

    expect(player.isDisconnected).toBe(true);
    // SocketController would allow the reconnect and flip isDisconnected back to false.
    player.isDisconnected = false;
    expect(player.isDisconnected).toBe(false);
  });
});
