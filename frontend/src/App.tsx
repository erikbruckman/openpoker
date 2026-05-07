import { JoinScreen } from './components/JoinScreen';
import { PokerTable } from './components/PokerTable';
import { ConnectionBanner, ErrorToast } from './components/ConnectionBanner';
import { usePokerEngine } from './hooks/usePokerEngine';

function App() {
  const { status, hasJoinedRoom, gameState, privateState, error, playerId, joinRoom, startHand, takeAction, reconnect } = usePokerEngine();

  return (
    <div style={{ width: '100%', minHeight: '100vh' }}>
      <ConnectionBanner status={status} onRetry={reconnect} />
      {error && <ErrorToast message={error} />}

      {!hasJoinedRoom ? (
        <JoinScreen onJoin={joinRoom} />
      ) : (
        <PokerTable
          gameState={gameState}
          privateState={privateState}
          playerId={playerId}
          startHand={startHand}
          takeAction={takeAction}
        />
      )}
    </div>
  );
}

export default App;
