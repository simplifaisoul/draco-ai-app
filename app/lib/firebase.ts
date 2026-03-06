import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Lazy initialization — only runs on the client, prevents SSR/prerender crashes
function getFirebaseApp(): FirebaseApp {
    if (getApps().length === 0) {
        return initializeApp(firebaseConfig);
    }
    return getApp();
}

// Export getters that initialize lazily (safe for SSR)
export function getFirebaseAuth(): Auth {
    return getAuth(getFirebaseApp());
}

export function getFirebaseDb(): Firestore {
    return getFirestore(getFirebaseApp());
}

// Legacy exports for components that import directly
// These will throw during SSR prerendering if accessed, so components
// must only access them inside useEffect or event handlers (client-only)
export const auth = typeof window !== 'undefined' ? getFirebaseAuth() : (null as unknown as Auth);
export const db = typeof window !== 'undefined' ? getFirebaseDb() : (null as unknown as Firestore);
export default typeof window !== 'undefined' ? getFirebaseApp() : (null as unknown as FirebaseApp);
