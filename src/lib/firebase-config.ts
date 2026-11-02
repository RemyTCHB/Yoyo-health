/**
 * Public Firebase web config for the Yoyo Health project. These values are
 * not secrets (they identify the project; access is controlled by
 * firestore.rules). NEXT_PUBLIC_FIREBASE_* env vars override them, and
 * NEXT_PUBLIC_FIREBASE_DEMO=1 forces demo mode for local tinkering.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAlMMZ3_Fx992inol0dhztHq9PzG2eOmSA",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "yoyoo-health.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "yoyoo-health",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:95359111024:web:1e4ceac579b50aaecc89b5",
};

export const forceDemo = process.env.NEXT_PUBLIC_FIREBASE_DEMO === "1";
