import { createHash, timingSafeEqual } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { adminApp } from "@/lib/firebase-admin";

/**
 * Exchanges a PIN for a Firebase custom token carrying the role
 * ("editor" can add/edit, "viewer" is read-only).
 *
 * The token also carries a `key` derived from the current PIN. Firestore
 * rules compare it with config/access, so changing a PIN in Vercel signs
 * out every device that used the old one (on the next unlock by anyone).
 */

const MAX_FAILS = 8;
const WINDOW_MS = 15 * 60_000;

const sha = (s: string) => createHash("sha256").update(s).digest();

function same(a: string, b: string) {
  return timingSafeEqual(sha(a), sha(b));
}

function keyFor(role: string, pin: string, project: string) {
  return sha(`${role}:${pin}:${project}`).toString("hex").slice(0, 24);
}

export async function POST(request: Request) {
  const editorPin = process.env.EDITOR_PIN?.trim();
  const viewerPin = process.env.VIEWER_PIN?.trim();
  if (!editorPin || !viewerPin || !process.env.FIREBASE_SERVICE_ACCOUNT) {
    return Response.json(
      { error: "Server is missing EDITOR_PIN, VIEWER_PIN or FIREBASE_SERVICE_ACCOUNT" },
      { status: 500 },
    );
  }

  let pin = "";
  try {
    const body = await request.json();
    pin = String(body?.pin ?? "").trim();
  } catch {}
  if (!pin || pin.length > 32) return Response.json({ error: "Enter your PIN" }, { status: 401 });

  const app = adminApp();
  const db = getFirestore(app);
  const project = String(app.options.projectId);

  // ---- simple brute-force protection, per client IP ----
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limitRef = db.collection("_unlockAttempts").doc(sha(ip).toString("hex").slice(0, 32));
  const limit = (await limitRef.get()).data() as { fails: number; since: number } | undefined;
  const now = Date.now();
  const recent = limit && now - limit.since < WINDOW_MS ? limit : null;
  if (recent && recent.fails >= MAX_FAILS) {
    const mins = Math.ceil((recent.since + WINDOW_MS - now) / 60_000);
    return Response.json(
      { error: `Too many wrong tries. Try again in ${mins} min.` },
      { status: 429 },
    );
  }

  const role = same(pin, editorPin) ? "editor" : same(pin, viewerPin) ? "viewer" : null;

  if (!role) {
    await limitRef.set({ fails: (recent?.fails ?? 0) + 1, since: recent?.since ?? now });
    await new Promise((r) => setTimeout(r, 400));
    return Response.json({ error: "That PIN didn't match" }, { status: 401 });
  }
  if (limit) await limitRef.delete();

  // Keep config/access in sync with the PINs currently set on the server.
  const access = {
    editor: keyFor("editor", editorPin, project),
    viewer: keyFor("viewer", viewerPin, project),
  };
  const accessRef = db.doc("config/access");
  const current = (await accessRef.get()).data();
  if (current?.editor !== access.editor || current?.viewer !== access.viewer) {
    await accessRef.set(access);
  }

  const token = await getAuth(app).createCustomToken(role, { role, key: access[role] });
  return Response.json({ token, role });
}
