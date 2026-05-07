import React from 'react';
import styles from './PlayingCard.module.css';

interface PlayingCardProps {
  suit: string;
  value: number;
  hidden?: boolean;
}

const RANK_STRINGS: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

function getRankString(val: number): string {
  return RANK_STRINGS[val] ?? val.toString();
}

function getSuitDisplay(s: string): { symbol: string; color: string } {
  switch (s.toLowerCase()) {
    case 'hearts':   return { symbol: '♥', color: '#ef4444' };
    case 'diamonds': return { symbol: '♦', color: '#ef4444' };
    case 'clubs':    return { symbol: '♣', color: '#1e293b' };
    case 'spades':   return { symbol: '♠', color: '#1e293b' };
    default:         return { symbol: '?', color: '#000' };
  }
}

export const PlayingCard: React.FC<PlayingCardProps> = ({ suit, value, hidden = false }) => {
  if (hidden || suit === 'hidden') {
    return (
      <div className={`${styles.cardBack} animate-deal`}>
        <div className={styles.cardBackInner} />
      </div>
    );
  }

  const rankStr = getRankString(value);
  const { symbol, color } = getSuitDisplay(suit);

  return (
    <div className={`${styles.card} animate-deal`} style={{ color }}>
      <div className={styles.corner}>
        <div>{rankStr}</div>
        <div className={styles.cornerSuit}>{symbol}</div>
      </div>
      <div className={styles.centerSuit}>{symbol}</div>
      <div className={`${styles.corner} ${styles.cornerBottom}`}>
        <div>{rankStr}</div>
        <div className={styles.cornerSuit}>{symbol}</div>
      </div>
    </div>
  );
};
