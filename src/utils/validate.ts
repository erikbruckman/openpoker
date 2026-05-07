import { PlayerAction } from '../../shared/types';

const PLAYABLE_ACTIONS = new Set<string>([
  PlayerAction.Fold,
  PlayerAction.Check,
  PlayerAction.Call,
  PlayerAction.Raise,
]);

export function validatePlayerName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 32) return null;
  if (!/^[A-Za-z0-9 _-]+$/.test(trimmed)) return null;
  return trimmed;
}

export function validateRoomCode(code: unknown): string | null {
  if (typeof code !== 'string') return null;
  const trimmed = code.trim();
  if (trimmed.length < 4 || trimmed.length > 8) return null;
  if (!/^[A-Z0-9]+$/.test(trimmed)) return null;
  return trimmed;
}

export function validateAction(action: unknown): PlayerAction | null {
  if (typeof action !== 'string') return null;
  if (PLAYABLE_ACTIONS.has(action)) return action as PlayerAction;
  return null;
}

export function validateAmount(amount: unknown): number | null {
  if (typeof amount !== 'number') return null;
  if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(amount)) return null;
  return amount;
}
