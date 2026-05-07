import React from 'react';
import type { ConnectionStatus } from '../hooks/useSocket';
import styles from './ConnectionBanner.module.css';

interface ConnectionBannerProps {
  status: ConnectionStatus;
  onRetry: () => void;
}

const MESSAGES: Record<Exclude<ConnectionStatus, 'connected'>, string> = {
  connecting: 'Connecting to server…',
  reconnecting: 'Connection lost. Reconnecting…',
  disconnected: 'Could not reach the server.',
};

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({ status, onRetry }) => {
  if (status === 'connected') return null;

  return (
    <div className={`${styles.banner} ${styles[status]}`}>
      {(status === 'connecting' || status === 'reconnecting') && (
        <span className={styles.spinner} />
      )}
      <span>{MESSAGES[status]}</span>
      {status === 'disconnected' && (
        <button className={styles.retryButton} onClick={onRetry}>Retry</button>
      )}
    </div>
  );
};

interface ErrorToastProps {
  message: string;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({ message }) => (
  <div className={styles.toast}>{message}</div>
);
