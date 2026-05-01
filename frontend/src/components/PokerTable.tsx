import React, { useState } from 'react';
import { GameState, PlayerAction } from '../hooks/usePokerEngine';
import type { PublicGameState, PrivateGameState } from '../hooks/usePokerEngine';
import { PlayingCard } from './PlayingCard';

interface PokerTableProps {
  gameState: PublicGameState | null;
  privateState: PrivateGameState | null;
  isConnected: boolean;
  playerId: string | null;
  startHand: () => void;
  takeAction: (action: 'fold' | 'call' | 'raise', amount?: number) => void;
}

export const PokerTable: React.FC<PokerTableProps> = ({ gameState, privateState, isConnected, playerId, startHand, takeAction }) => {
  const [betAmount, setBetAmount] = useState(0);

  if (!gameState) return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>Loading table state...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '20px' }}>

      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div className="glass-panel" style={{ padding: '8px 16px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Status:</span>{' '}
          <span style={{ color: isConnected ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 'bold' }}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="glass-panel" style={{ padding: '8px 16px', fontWeight: 'bold' }}>
          State: <span style={{ color: 'var(--accent-blue)' }}>{gameState.state}</span>
        </div>
      </div>

      {/* Main Table Area */}
      <div style={{
        flex: 1,
        backgroundColor: 'var(--bg-table)',
        borderRadius: '100px',
        border: '8px solid rgba(255,255,255,0.05)',
        boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5), 0 20px 50px rgba(0,0,0,0.3)',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '40px 0'
      }}>

        {/* Pot & Community Cards */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '16px', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent-green)' }}>
            Pot: ${gameState.pot}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', minHeight: '84px' }}>
            {gameState.communityCards.map((card, i) => (
              <PlayingCard key={i} suit={card.suit} value={card.value} />
            ))}
          </div>
        </div>

        {/* Players */}
        {gameState.players.map((player, index) => {
          // Simplistic positioning around the table
          const angle = (index / gameState.players.length) * Math.PI * 2;
          const radiusX = 40; // percentage
          const radiusY = 30; // percentage
          const top = 50 - Math.cos(angle) * radiusY;
          const left = 50 + Math.sin(angle) * radiusX;

          const isMyTurn = gameState.currentPlayerTurn === index;
          const isMe = player.id === playerId;

          return (
            <div key={player.id} className="glass-panel" style={{
              position: 'absolute',
              top: `${top}%`,
              left: `${left}%`,
              transform: 'translate(-50%, -50%)',
              padding: '12px',
              border: isMyTurn ? '2px solid var(--accent-blue)' : '1px solid var(--glass-border)',
              backgroundColor: player.currentAction === PlayerAction.Fold ? 'rgba(0,0,0,0.5)' : 'var(--glass-bg)',
              transition: 'all 0.3s',
              zIndex: 10
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {player.name} {isMe && <span style={{ color: 'var(--accent-blue)', fontSize: '0.8rem' }}>(Me)</span>}
                {player.currentAction !== PlayerAction.None && player.currentAction !== PlayerAction.Fold && (
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: player.currentAction === PlayerAction.Raise ? 'var(--accent-red)' :
                                     player.currentAction === PlayerAction.Check ? 'var(--accent-green)' :
                                     'var(--accent-blue)',
                    color: 'white',
                    fontWeight: 'normal'
                  }}>
                    {player.currentAction}
                  </span>
                )}
              </div>
              <div style={{ color: 'var(--accent-green)', fontSize: '0.9rem', marginBottom: '8px' }}>${player.chips}</div>
              {player.currentBet > 0 && (
                <div style={{ position: 'absolute', top: '-25px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
                  Bet: ${player.currentBet}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                {player.currentHand.map((card, i) => (
                  <PlayingCard key={i} suit={card.suit} value={card.value} hidden={card.suit === 'hidden'} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Controls */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

        {/* Only show "Start Hand" if waiting or showdown */}
        {(gameState.state === GameState.Waiting || gameState.state === GameState.Showdown) ? (
          <button className="btn-primary" onClick={startHand} style={{ width: '100%' }}>
            Deal Next Hand
          </button>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-danger" onClick={() => takeAction('fold')}>Fold</button>
              <button className="btn-primary" onClick={() => takeAction('call')}>Call / Check</button>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="number"
                className="input-field"
                style={{ width: '100px' }}
                value={betAmount}
                onChange={(e) => setBetAmount(Number(e.target.value))}
                placeholder="Amount"
              />
              <button className="btn-success" onClick={() => takeAction('raise', betAmount)}>Raise</button>
            </div>
          </>
        )}

      </div>

      {/* Private Hand Display (For the local player) */}
      {privateState && privateState.hand.length > 0 && (
        <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '10px', pointerEvents: 'none' }}>
          {privateState.hand.map((card, i) => (
            <div key={i} style={{ transform: 'scale(1.5) translateY(-20px)' }}>
              <PlayingCard suit={card.suit} value={card.value} />
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
