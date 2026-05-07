import React, { useState } from 'react';
import { GameState, PlayerAction } from '../../../shared/types';
import type { PublicGameState, PrivateGameState } from '../../../shared/types';
import { PlayingCard } from './PlayingCard';
import styles from './PokerTable.module.css';

interface PokerTableProps {
  gameState: PublicGameState | null;
  privateState: PrivateGameState | null;
  playerId: string | null;
  startHand: () => void;
  takeAction: (action: PlayerAction, amount?: number) => void;
}

const BET_DECREMENTS = [-500, -100, -50] as const;
const BET_INCREMENTS = [50, 100, 500] as const;

export const PokerTable: React.FC<PokerTableProps> = ({
  gameState,
  privateState,
  playerId,
  startHand,
  takeAction,
}) => {
  const [betAmount, setBetAmount] = useState(0);

  if (!gameState) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner} />
          <span className={styles.loadingText}>Connecting to table…</span>
        </div>
      </div>
    );
  }

  const myPlayer = gameState.players.find(p => p.id === playerId) ?? null;
  const maxBet = myPlayer?.chips ?? 0;
  const isBetValid = betAmount >= 1 && betAmount <= maxBet && Number.isInteger(betAmount);

  const adjustBet = (delta: number) => {
    setBetAmount(prev => Math.min(maxBet, Math.max(0, prev + delta)));
  };

  const handleBetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setBetAmount(isNaN(val) ? 0 : Math.min(maxBet, Math.max(0, val)));
  };

  const isHandActive = gameState.state !== GameState.Waiting && gameState.state !== GameState.Showdown;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={`glass-panel ${styles.headerBadge}`}>
          Room: <strong>{new URLSearchParams(window.location.search).get('room') ?? '—'}</strong>
        </div>
        <div className={`glass-panel ${styles.headerBadge}`}>
          State: <span className={styles.gameStateName}>{gameState.state}</span>
        </div>
      </div>

      {/* Main Table */}
      <div className={styles.tableArea}>
        {/* Center: pot + community cards */}
        <div className={styles.tableCenter}>
          <div className={styles.pot}>Pot: ${gameState.pot}</div>
          <div className={styles.communityCards}>
            {gameState.communityCards.map((card, i) => (
              <PlayingCard key={i} suit={card.suit} value={card.value} />
            ))}
          </div>
          {gameState.state === GameState.Waiting && (
            <div className={styles.waitingMessage}>Waiting for players…</div>
          )}
        </div>

        {/* Players */}
        {gameState.players.map((player, index) => {
          const angle = (index / gameState.players.length) * Math.PI * 2;
          const top = 50 - Math.cos(angle) * 30;
          const left = 50 + Math.sin(angle) * 40;

          const isMyTurn = gameState.currentPlayerTurn === index;
          const isMe = player.id === playerId;
          const isFolded = player.currentAction === PlayerAction.Fold;

          const actionClass =
            player.currentAction === PlayerAction.Raise ? styles.actionRaise :
            player.currentAction === PlayerAction.Check ? styles.actionCheck :
            styles.actionCall;

          return (
            <div
              key={player.id}
              className={[
                'glass-panel',
                styles.player,
                isMyTurn ? styles.playerActive : '',
                isFolded ? styles.playerFolded : '',
              ].join(' ')}
              style={{ top: `${top}%`, left: `${left}%` }}
            >
              <div className={styles.playerName}>
                {player.name}
                {isMe && <span className={styles.meLabel}>(Me)</span>}
                {player.currentAction !== PlayerAction.None && !isFolded && (
                  <span className={`${styles.actionBadge} ${actionClass}`}>
                    {player.currentAction}
                  </span>
                )}
              </div>
              <div className={styles.playerChips}>${player.chips}</div>
              {player.currentBet > 0 && (
                <div className={styles.playerBet}>Bet: ${player.currentBet}</div>
              )}
              <div className={styles.playerCards}>
                {player.currentHand.map((card, i) => (
                  <PlayingCard key={i} suit={card.suit} value={card.value} hidden={card.suit === 'hidden'} />
                ))}
              </div>
            </div>
          );
        })}

        {/* Dealer button indicator */}
        {gameState.players[gameState.dealerButtonIndex] && (() => {
          const idx = gameState.dealerButtonIndex;
          const angle = (idx / gameState.players.length) * Math.PI * 2;
          const top = 50 - Math.cos(angle) * 30;
          const left = 50 + Math.sin(angle) * 40;
          return (
            <div
              style={{
                position: 'absolute',
                top: `calc(${top}% - 28px)`,
                left: `calc(${left}% + 28px)`,
                width: '22px',
                height: '22px',
                background: 'white',
                color: '#0f172a',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.6rem',
                fontWeight: 'bold',
                zIndex: 20,
                transform: 'translate(-50%, -50%)',
              }}
            >D</div>
          );
        })()}
      </div>

      {/* Action Controls */}
      <div className={`glass-panel ${styles.controls}`}>
        {!isHandActive ? (
          <button className={`btn-primary ${styles.dealButton}`} onClick={startHand}>
            Deal Next Hand
          </button>
        ) : (
          <>
            <div className={styles.actionButtons}>
              <button className="btn-danger" onClick={() => takeAction(PlayerAction.Fold)}>Fold</button>
              <button className="btn-primary" onClick={() => takeAction(PlayerAction.Call)}>Call / Check</button>
            </div>

            <div className={styles.betControls}>
              <div className={styles.betAdjustGroup}>
                {BET_DECREMENTS.map(d => (
                  <button
                    key={d}
                    className={styles.betAdjustButton}
                    onClick={() => adjustBet(d)}
                    disabled={betAmount + d < 0}
                  >{d}</button>
                ))}
              </div>

              <input
                type="number"
                className={`input-field ${styles.betInput}`}
                value={betAmount}
                min={0}
                max={maxBet}
                onChange={handleBetChange}
              />

              <div className={styles.betAdjustGroup}>
                {BET_INCREMENTS.map(d => (
                  <button
                    key={d}
                    className={styles.betAdjustButton}
                    onClick={() => adjustBet(d)}
                    disabled={betAmount + d > maxBet}
                  >+{d}</button>
                ))}
              </div>

              <button
                className="btn-success"
                onClick={() => takeAction(PlayerAction.Raise, betAmount)}
                disabled={!isBetValid}
              >
                Raise
              </button>
            </div>
          </>
        )}
      </div>

      {/* Private hole cards overlay */}
      {privateState && privateState.hand.length > 0 && (
        <div className={styles.privateHand}>
          {privateState.hand.map((card, i) => (
            <div key={i} className={styles.privateCard}>
              <PlayingCard suit={card.suit} value={card.value} />
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
