import { firebaseConfig, forceDemo } from "./firebase-config";
import type { Role, Session, SessionInput } from "./types";

export interface Backend {
  mode: "firebase" | "demo";
  /** Resolves with the stored role if this device is already unlocked. */
  restore(): Promise<Role | null>;
  unlock(pin: string): Promise<Role>;
  lock(): Promise<void>;
  /** Live feed of all sessions, newest first. Returns an unsubscribe fn. */
  subscribe(
    onData: (sessions: Session[]) => void,
    onError: (err: Error & { code?: string }) => void,
  ): () => void;
  add(s: SessionInput): Promise<void>;
  update(id: string, s: SessionInput): Promise<void>;
  remove(id: string): Promise<void>;
}

export const firebaseConfigured =
  !forceDemo && Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let backendPromise: Promise<Backend> | null = null;

export function getBackend(): Promise<Backend> {
  if (!backendPromise) {
    backendPromise = firebaseConfigured
      ? import("./backend-firebase").then((m) => m.createFirebaseBackend())
      : import("./backend-demo").then((m) => m.createDemoBackend());
  }
  return backendPromise;
}

export class PinError extends Error {
  constructor(
    message: string,
    public code: "wrong_pin" | "rate_limited" | "server" = "wrong_pin",
  ) {
    super(message);
  }
}
