import { initializeApp } from 'firebase/app';
import { initializeFirestore, getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged as fbOnAuthStateChanged, signOut as fbSignOut } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Use a more robust initialization pattern for named databases
let dbInstance: any;
try {
  // Try initializing with long polling for iframe compatibility
  dbInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  console.warn("Firestore initialization with settings failed, falling back to basic getFirestore", e);
  dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = dbInstance;

// Initialize Firebase Auth (Email/Password)
export const auth = getAuth(app);

// Re-export a friendly wrapper used by App.tsx
export function onAuthStateChanged(cb: (u: any) => void) {
  return fbOnAuthStateChanged(auth, cb);
}

// Keep the previously-used function name for minimal UI edits: prompt and sign in
export async function signInWithGoogle() {
  const email = globalThis.prompt('Email:', 'admin@tool.com');
  const password = globalThis.prompt('Password:', '');
  if (!email || !password) throw new Error('Login cancelled');
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  try { globalThis.localStorage.setItem('isLoggedIn', 'true'); } catch (e) { /* ignore */ }
  return userCredential.user;
}

export function signOut() {
  try { fbSignOut(auth); } catch (e) { /* ignore */ }
  try { globalThis.localStorage.removeItem('isLoggedIn'); } catch (e) { /* ignore */ }
}

// CRITICAL CONSTRAINT: Test connection to Firestore on boot (same as before)
async function testConnection() {
  try {
    const testDoc = doc(db, 'test', 'connection');
    await getDocFromServer(testDoc);
    console.log("Firestore link established.");
  } catch (error: any) {
    if (error?.message?.includes('offline')) {
      console.warn("Firestore: Operating in offline mode.");
    } else if (error?.code === 'permission-denied') {
      console.error("Firestore: Permission denied during connection test. Check rules.");
    } else {
      console.info("Firestore: Initialization check skipped or pending.");
    }
  }
}
testConnection();
