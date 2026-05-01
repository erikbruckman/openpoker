import React, { useState } from 'react';
import { Play } from 'lucide-react';

interface JoinScreenProps {
  onJoin: (name: string, roomCode: string) => void;
}

export const JoinScreen: React.FC<JoinScreenProps> = ({ onJoin }) => {
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && room.trim()) {
      onJoin(name.trim(), room.trim().toUpperCase());
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
      <div className="glass-panel animate-slide-up" style={{ padding: '40px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '8px', fontSize: '2rem', color: 'var(--accent-blue)' }}>OpenPoker</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Join a room to start playing</p>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <input
              type="text"
              placeholder="Your Name"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="Room Code"
              className="input-field"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              required
              style={{ textTransform: 'uppercase' }}
            />
          </div>
          
          <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
            <Play size={20} /> Join Table
          </button>
        </form>
      </div>
    </div>
  );
};
