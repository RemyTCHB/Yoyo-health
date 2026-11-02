import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";

let app: App | null = null;

/**
 * Reads the service account from FIREBASE_SERVICE_ACCOUNT, which may be
 * the raw JSON file contents or the same JSON base64-encoded.
 */
export function adminApp(): App {
  if (app) return app;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
  const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const sa = JSON.parse(json);
  app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: sa.project_id,
        clientEmail: sa.client_email,
        privateKey: String(sa.private_key).replace(/\\n/g, "\n"),
      }),
      projectId: sa.project_id,
    });
  return app;
}
