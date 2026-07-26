export type SessionLossReason = 'unauthorized' | 'logout';
export type SessionLossListener = (reason: SessionLossReason) => void;

const listeners = new Set<SessionLossListener>();

export function subscribeToSessionLoss(
  listener: SessionLossListener,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishSessionLoss(reason: SessionLossReason): void {
  for (const listener of listeners) {
    listener(reason);
  }
}
