import React from 'react';

interface PlayingCardProps {
  suit: string;
  value: number; // 2-14 (14 is Ace)
  hidden?: boolean;
}

export const PlayingCard: React.FC<PlayingCardProps> = ({ suit, value, hidden = false }) => {
  if (hidden || suit === 'hidden') {
    return (
      <div 
        className="glass-panel animate-deal"
        style={{
          width: '60px',
          height: '84px',
          backgroundColor: '#1e293b',
          border: '2px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 4px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div style={{
          width: '80%',
          height: '80%',
          border: '1px dashed rgba(255,255,255,0.2)',
          borderRadius: '4px'
        }} />
      </div>
    );
  }

  const getRankString = (val: number) => {
    switch(val) {
      case 11: return 'J';
      case 12: return 'Q';
      case 13: return 'K';
      case 14: return 'A';
      default: return val.toString();
    }
  };

  const getSuitSymbolAndColor = (s: string) => {
    switch(s.toLowerCase()) {
      case 'hearts': return { symbol: '♥', color: '#ef4444' };
      case 'diamonds': return { symbol: '♦', color: '#ef4444' };
      case 'clubs': return { symbol: '♣', color: '#1e293b' }; // nearly black for clubs/spades on white card
      case 'spades': return { symbol: '♠', color: '#1e293b' };
      default: return { symbol: '?', color: '#000' };
    }
  };

  const rankStr = getRankString(value);
  const { symbol, color } = getSuitSymbolAndColor(suit);

  return (
    <div 
      className="animate-deal"
      style={{
        width: '60px',
        height: '84px',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        margin: '0 4px',
        padding: '4px 6px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
        color: color,
        fontWeight: 'bold',
        position: 'relative'
      }}
    >
      <div style={{ fontSize: '14px', lineHeight: '1' }}>
        <div>{rankStr}</div>
        <div style={{ fontSize: '12px' }}>{symbol}</div>
      </div>
      <div style={{ 
        position: 'absolute', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        fontSize: '24px',
        opacity: 0.8
      }}>
        {symbol}
      </div>
      <div style={{ fontSize: '14px', lineHeight: '1', transform: 'rotate(180deg)' }}>
        <div>{rankStr}</div>
        <div style={{ fontSize: '12px' }}>{symbol}</div>
      </div>
    </div>
  );
};
