import React from 'react';
import { JoinScreen } from './components/JoinScreen';
import { PokerTable } from './components/PokerTable';
import { usePokerEngine } from './hooks/usePokerEngine';

function App() {
  const engine = usePokerEngine();
  const { hasJoinedRoom, joinRoom, error } = engine;

  const handleJoin = (name: string, room: string) => {
    joinRoom(name, room);
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh' }}>
      {error && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--accent-red)', color: 'white', padding: '12px 24px', borderRadius: '8px', zIndex: 100 }}>
          {error}
        </div>
      )}

      {!hasJoinedRoom ? (
        <JoinScreen onJoin={handleJoin} />
      ) : (
        <PokerTable {...engine} />
      )}
    </div>
  );
}

export default App;
