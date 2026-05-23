type Listener = () => void;

const listeners = new Set<Listener>();

export const sessionEvents = {
  onSessionExpired(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  emitSessionExpired(): void {
    listeners.forEach((l) => l());
  },
};
