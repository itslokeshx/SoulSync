import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAnalytics, Analytics, isSupported } from "firebase/analytics";

export const firebaseConfig = {
  apiKey: "AIzaSyDoarTioqVF-zGVZ8gGwynCesUqqz6am_w",
  authDomain: "soulsync-1fbf9.firebaseapp.com",
  projectId: "soulsync-1fbf9",
  storageBucket: "soulsync-1fbf9.firebasestorage.app",
  messagingSenderId: "41763631282",
  appId: "1:41763631282:web:68cafce5397329da6559ab",
  measurementId: "G-58YV8NX245"
};

let appInstance: FirebaseApp | null = null;
let analyticsInstance: Analytics | null = null;
let analyticsPromise: Promise<Analytics | null> | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  try {
    if (!appInstance) {
      appInstance = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    }
    return appInstance;
  } catch (err) {
    return null;
  }
}

export async function getWebAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null;
  if (analyticsInstance) return analyticsInstance;
  if (analyticsPromise) return analyticsPromise;

  analyticsPromise = (async () => {
    try {
      const supported = await isSupported();
      if (!supported) return null;
      const firebaseApp = getFirebaseApp();
      if (!firebaseApp) return null;
      analyticsInstance = getAnalytics(firebaseApp);
      return analyticsInstance;
    } catch (err) {
      return null;
    }
  })();

  return analyticsPromise;
}
