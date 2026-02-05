// import { Message } from "../components/SceneController"; // Removed broken import

// We'll define a shared type here or import it. 
// For now, let's redefine minimal interface to avoid circular deps if types are in page.tsx
export interface Message {
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
    thought?: string;
    isThinking?: boolean;
    reasoning_content?: string;
}

export interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    createdAt: number;
    updatedAt: number;
}

const STORAGE_KEY = "draco_sessions";
const ACTIVE_KEY = "draco_active_id";

export class HistoryManager {
    static getSessions(): ChatSession[] {
        if (typeof window === "undefined") return [];
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }

    static getSession(id: string): ChatSession | undefined {
        const sessions = this.getSessions();
        return sessions.find(s => s.id === id);
    }

    static saveSession(session: ChatSession): void {
        const sessions = this.getSessions();
        const index = sessions.findIndex(s => s.id === session.id);

        if (index >= 0) {
            sessions[index] = session;
        } else {
            sessions.unshift(session); // Add to top
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }

    static createSession(): ChatSession {
        const newSession: ChatSession = {
            id: crypto.randomUUID(),
            title: "New Chat",
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.saveSession(newSession);
        return newSession;
    }

    static deleteSession(id: string): void {
        const sessions = this.getSessions().filter(s => s.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }

    static clearAll(): void {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(ACTIVE_KEY);
    }

    // Heuristic Update Title
    static updateTitle(id: string, firstMessage: string): void {
        const sessions = this.getSessions();
        const session = sessions.find(s => s.id === id);
        if (session) {
            // Simple truncation
            session.title = firstMessage.length > 30 ? firstMessage.substring(0, 30) + "..." : firstMessage;
            this.saveSession(session);
        }
    }
}
