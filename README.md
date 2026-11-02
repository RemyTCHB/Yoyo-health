# Yoyo Health ❤️

A private, shared log of **blood pressure** and **heart rate** readings. It works on phones and desktop browsers.

- **One person enters readings** with the *entry PIN*. Each session usually has 3 readings, and each reading is time-stamped and averaged.
- **Anyone else watches live** with the *viewer PIN*. New readings show up on every device within a second.
- **Charts**: heart rate, blood pressure (with shaded ACC/AHA ranges), and heart rate vs blood pressure (scatter with correlation, or aligned timelines).
- **Details per session**: arm, position, medication taken (with a note), and free-text notes.
- **Extras**: averages by time of day, week-over-week change, CSV export for your doctor, dark mode, and "Add to Home Screen" support so it opens like an app.

Stack: Next.js (App Router) · Firebase Firestore (realtime) · Firebase Auth (custom tokens from a PIN) · Recharts · Tailwind CSS. Hosted on Vercel's free tier.

---

## Try it locally (demo mode)

```bash
npm install
NEXT_PUBLIC_FIREBASE_DEMO=1 npm run dev
```

Open http://localhost:3000. PIN **1234** = entry, **0000** = view only. Sample data stays in your browser.

---

## Go live: one-time setup (about 15 minutes)

### 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> → **Create a project** (you can turn Google Analytics off).
2. **Build → Firestore Database → Create database**. Pick **Production mode** and a location near you.
3. **Build → Authentication → Get started.** You don't need to enable any sign-in provider. The app signs people in from the PIN.
4. **Firestore Database → Rules** tab. Replace everything with the contents of [`firestore.rules`](./firestore.rules), then click **Publish**.
5. **⚙ Project settings → General → Your apps → Web (`</>`)**. Register an app called "Yoyo Health" (no hosting needed). The app's public config is already in [`src/lib/firebase-config.ts`](./src/lib/firebase-config.ts). If you use a different Firebase project, update it there.
6. **⚙ Project settings → Service accounts → Generate new private key.** A `.json` file downloads. Keep it secret: anyone who has it gets full access to your database.

### 2. Deploy on Vercel

1. Go to <https://vercel.com/new> and import this GitHub repo.
2. Under **Environment Variables**, add:

   | Name | Value |
   |---|---|
   | `FIREBASE_SERVICE_ACCOUNT` | Open the downloaded JSON file, copy **all** of it, and paste it here |
   | `EDITOR_PIN` | The PIN for the person entering readings, e.g. `482916` |
   | `VIEWER_PIN` | The PIN for family or caregivers who only view |

   PINs must be **4–8 digits** and must be different from each other. Use 6 digits or more if you can.
3. Click **Deploy**. You'll get a URL like `https://yoyo-health.vercel.app`.

### 3. Share it

- Send the URL plus the **viewer PIN** to the people who should see the data.
- On a phone, open the URL in Safari, tap Share → **Add to Home Screen**. In Chrome, use ⋮ → **Install app**. The device stays unlocked until you tap the 🔒 icon.

### Changing a PIN or removing someone's access

Change `EDITOR_PIN` or `VIEWER_PIN` in Vercel → Settings → Environment Variables, then **Redeploy**. Every device that used the old PIN is locked out once someone unlocks with the new PIN.

---

## How security works

- PINs are checked **only on the server** (`/api/unlock`). The browser never sees them.
- A correct PIN returns a Firebase token tagged with a role: `editor` or `viewer`.
- [`firestore.rules`](./firestore.rules) only allows `editor` tokens to write, and checks every value. For example, systolic must be 60–260 and each session can have at most 6 readings.
- After 8 wrong PIN attempts from the same network, unlocking is blocked for 15 minutes.
- Search engines are told not to index the site.

---

## How the data is stored

Collection `sessions`, one document per measuring session:

```jsonc
{
  "takenAt": Timestamp,          // time of the first reading
  "tz": "Europe/London",         // time zone of the person who took it
  "readings": [{ "sys": 128, "dia": 84, "hr": 71, "at": Timestamp }, ...],
  "avgSys": 124.7, "avgDia": 82, "avgHr": 69.3,
  "arm": "left" | "right" | null,
  "position": "sitting" | "standing" | "lying" | null,
  "meds": true, "medsNote": "Amlodipine 5mg",
  "notes": "After coffee",
  "createdAt": Timestamp, "updatedAt": Timestamp
}
```

Times are always shown in the time zone where the reading was taken. If a viewer is in a different zone, the zone is labelled (e.g. "8:02 AM GMT+1").

---

## Project layout

```
src/app/api/unlock/route.ts  PIN → Firebase custom token (server)
src/lib/backend-firebase.ts  live Firestore data + auth (browser)
src/lib/backend-demo.ts      demo mode (localStorage)
src/lib/stats.ts             averages, BP categories, correlation, CSV
src/components/              screens: LockScreen, Dashboard, ChartsView, HistoryView, SessionForm
firestore.rules              database security rules
```

*For personal tracking, not medical advice.*
