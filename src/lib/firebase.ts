import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';

const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

const missing = requiredEnvVars.filter((key) => !import.meta.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Missing required Firebase env var(s): ${missing.join(', ')}. ` +
      `Add them to your .env file (see .env.example).`
  );
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

// Reuse the existing app across Vite HMR module re-evaluations; otherwise
// `initializeApp` throws "app/duplicate-app".
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// `initializeFirestore` throws "firestore/already-initialized" when the
// module is re-evaluated on HMR. Fall back to `getFirestore`, which returns
// the existing instance. Also enable auto-detect long-polling so users
// behind strict corporate proxies / flaky mobile networks still work.
export const db: Firestore = (() => {
  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    return getFirestore(app);
  }
})();

// Optional: connect to Firebase Emulator Suite in local dev.
// Set VITE_USE_EMULATOR=true in .env.local to enable.
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  const host = (import.meta.env.VITE_EMULATOR_HOST as string) || 'localhost';
  try {
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
  } catch (err) {
    // On HMR re-evaluation the emulator connection is already established;
    // swallowing this avoids a noisy warning and preserves the existing
    // connection.
    if (import.meta.env.DEV) {
      console.warn('Failed to connect to Firebase Emulator:', err);
    }
  }
}

export default app;