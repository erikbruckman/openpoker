import React, { useState } from 'react';
import { Play } from 'lucide-react';
import styles from './JoinScreen.module.css';

interface JoinScreenProps {
  onJoin: (name: string, roomCode: string) => void;
}

function validateName(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 1) return 'Name is required.';
  if (trimmed.length > 32) return 'Name must be 32 characters or fewer.';
  return null;
}

function validateRoom(value: string): string | null {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9]{4,8}$/.test(trimmed)) return 'Room code must be 4–8 letters or numbers.';
  return null;
}

export const JoinScreen: React.FC<JoinScreenProps> = ({ onJoin }) => {
  const [name, setName] = useState('');
  const [room, setRoom] = useState(
    () => new URLSearchParams(window.location.search).get('room') ?? ''
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ne = validateName(name);
    const re = validateRoom(room);
    setNameError(ne);
    setRoomError(re);
    if (!ne && !re) {
      onJoin(name.trim(), room.trim().toUpperCase());
    }
  };

  return (
    <div className={styles.container}>
      <div className={`glass-panel animate-slide-up ${styles.panel}`}>
        <h1 className={styles.title}>OpenPoker</h1>
        <p className={styles.subtitle}>Join a room to start playing</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <input
              type="text"
              placeholder="Your Name"
              className="input-field"
              value={name}
              maxLength={32}
              onChange={(e) => { setName(e.target.value); setNameError(null); }}
            />
            {nameError && <span className={styles.fieldError}>{nameError}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <input
              type="text"
              placeholder="Room Code"
              className={`input-field ${styles.roomInput}`}
              value={room}
              maxLength={8}
              onChange={(e) => { setRoom(e.target.value); setRoomError(null); }}
            />
            {roomError && <span className={styles.fieldError}>{roomError}</span>}
          </div>

          <button type="submit" className={`btn-primary ${styles.submitButton}`}>
            <Play size={20} /> Join Table
          </button>
        </form>
      </div>
    </div>
  );
};
