import { initializeApp, getApps } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  initializeFirestore,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import { PinError, type Backend } from "./store";
import type { Role, Session, SessionInput } from "./types";

import { firebaseConfig as config } from "./firebase-config";

function toDoc(s: SessionInput) {
  return {
    takenAt: Timestamp.fromMillis(s.takenAt),
    tz: s.tz,
    readings: s.readings.map((r) => ({
      sys: Math.round(r.sys),
      dia: Math.round(r.dia),
      hr: Math.round(r.hr),
      at: Timestamp.fromMillis(r.at),
    })),
    avgSys: s.avgSys,
    avgDia: s.avgDia,
    avgHr: s.avgHr,
    arm: s.arm,
    position: s.position,
    meds: s.meds,
    medsNote: s.medsNote.slice(0, 500),
    notes: s.notes.slice(0, 2000),
  };
}

const ms = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : Number(v) || 0);

function fromDoc(id: string, d: DocumentData): Session {
  return {
    id,
    takenAt: ms(d.takenAt),
    tz: d.tz ?? "UTC",
    readings: (d.readings ?? []).map((r: DocumentData) => ({
      sys: r.sys,
      dia: r.dia,
      hr: r.hr,
      at: ms(r.at),
    })),
    avgSys: d.avgSys,
    avgDia: d.avgDia,
    avgHr: d.avgHr,
    arm: d.arm ?? null,
    position: d.position ?? null,
    meds: !!d.meds,
    medsNote: d.medsNote ?? "",
    notes: d.notes ?? "",
  };
}

async function roleOf(user: User | null): Promise<Role | null> {
  if (!user) return null;
  const t = await user.getIdTokenResult();
  const r = t.claims.role;
  return r === "editor" || r === "viewer" ? r : null;
}

export function createFirebaseBackend(): Backend {
  const app = getApps()[0] ?? initializeApp(config);
  const auth = getAuth(app);
  let db: Firestore;
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    db = initializeFirestore(app, {});
  }
  // Local testing only: NEXT_PUBLIC_FIREBASE_EMULATOR=1 talks to `firebase emulators:start`.
  if (process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1") {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8089);
  }
  const sessions = collection(db, "sessions");

  return {
    mode: "firebase",

    restore: () =>
      new Promise((resolve) => {
        const off = onAuthStateChanged(auth, async (u) => {
          off();
          resolve(await roleOf(u).catch(() => null));
        });
      }),

    async unlock(pin) {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) throw new PinError(body.error ?? "Too many tries", "rate_limited");
      if (res.status === 401) throw new PinError(body.error ?? "Wrong PIN", "wrong_pin");
      if (!res.ok || !body.token) throw new PinError(body.error ?? "Server error", "server");
      const cred = await signInWithCustomToken(auth, body.token);
      const role = await roleOf(cred.user);
      if (!role) throw new PinError("Server error", "server");
      return role;
    },

    lock: () => signOut(auth),

    subscribe(onData, onError) {
      return onSnapshot(
        query(sessions, orderBy("takenAt", "desc")),
        (snap) => onData(snap.docs.map((d) => fromDoc(d.id, d.data()))),
        (err) => onError(err),
      );
    },

    async add(s) {
      await addDoc(sessions, {
        ...toDoc(s),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },

    async update(id, s) {
      await updateDoc(doc(sessions, id), { ...toDoc(s), updatedAt: serverTimestamp() });
    },

    async remove(id) {
      await deleteDoc(doc(sessions, id));
    },
  };
}
