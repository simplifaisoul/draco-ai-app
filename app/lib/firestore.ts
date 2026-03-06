import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp,
    writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

export interface FirestoreMessage {
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
    thought?: string;
    isThinking?: boolean;
    reasoning_content?: string;
}

export interface FirestoreChatSession {
    id: string;
    title: string;
    messages: FirestoreMessage[];
    createdAt: number;
    updatedAt: number;
}

/** Get the sessions collection ref for a user */
function sessionsRef(userId: string) {
    return collection(db, "users", userId, "sessions");
}

/** Save or update a chat session */
export async function saveChatSession(userId: string, session: FirestoreChatSession): Promise<void> {
    const docRef = doc(db, "users", userId, "sessions", session.id);
    await setDoc(docRef, {
        ...session,
        updatedAt: Date.now(),
        _serverTimestamp: serverTimestamp(),
    });
}

/** Get all chat sessions for a user, sorted by most recent */
export async function getChatSessions(userId: string): Promise<FirestoreChatSession[]> {
    const q = query(sessionsRef(userId), orderBy("updatedAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as FirestoreChatSession[];
}

/** Get a single chat session */
export async function getChatSession(userId: string, sessionId: string): Promise<FirestoreChatSession | null> {
    const docRef = doc(db, "users", userId, "sessions", sessionId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as FirestoreChatSession;
}

/** Delete a single chat session */
export async function deleteChatSession(userId: string, sessionId: string): Promise<void> {
    const docRef = doc(db, "users", userId, "sessions", sessionId);
    await deleteDoc(docRef);
}

/** Delete all chat sessions for a user */
export async function clearAllSessions(userId: string): Promise<void> {
    const snapshot = await getDocs(sessionsRef(userId));
    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
}

/** Update just the title of a session */
export async function updateSessionTitle(userId: string, sessionId: string, title: string): Promise<void> {
    const docRef = doc(db, "users", userId, "sessions", sessionId);
    await setDoc(docRef, { title, updatedAt: Date.now() }, { merge: true });
}
