export type Role = "editor" | "viewer";

export type Arm = "left" | "right";
export type Position = "sitting" | "standing" | "lying";

/** One individual measurement, stored with the moment it was taken. */
export interface Reading {
  sys: number;
  dia: number;
  hr: number;
  /** Epoch milliseconds. */
  at: number;
}

/** A measuring session: usually 3 readings taken back to back, averaged. */
export interface Session {
  id: string;
  /** Epoch ms of the first reading. */
  takenAt: number;
  /** IANA time zone of the person who took the readings. */
  tz: string;
  readings: Reading[];
  avgSys: number;
  avgDia: number;
  avgHr: number;
  arm: Arm | null;
  position: Position | null;
  meds: boolean;
  medsNote: string;
  notes: string;
}

/** What the entry form produces (the store adds id / timestamps). */
export type SessionInput = Omit<Session, "id">;
