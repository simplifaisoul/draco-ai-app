"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
    User,
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    updateProfile,
} from "firebase/auth";
import { auth } from "./firebase";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
    signOut: () => Promise<void>;
    error: string | null;
    clearError: () => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signInWithGoogle: async () => { },
    signInWithEmail: async () => { },
    signUpWithEmail: async () => { },
    signOut: async () => { },
    error: null,
    clearError: () => { },
});

export const useAuth = () => useContext(AuthContext);

const googleProvider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const clearError = () => setError(null);

    const signInWithGoogle = async () => {
        try {
            setError(null);
            await signInWithPopup(auth, googleProvider);
        } catch (err: any) {
            const msg = getReadableError(err.code);
            setError(msg);
            throw err;
        }
    };

    const signInWithEmail = async (email: string, password: string) => {
        try {
            setError(null);
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err: any) {
            const msg = getReadableError(err.code);
            setError(msg);
            throw err;
        }
    };

    const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
        try {
            setError(null);
            const result = await createUserWithEmailAndPassword(auth, email, password);
            if (displayName) {
                await updateProfile(result.user, { displayName });
            }
        } catch (err: any) {
            const msg = getReadableError(err.code);
            setError(msg);
            throw err;
        }
    };

    const signOut = async () => {
        try {
            setError(null);
            await firebaseSignOut(auth);
        } catch (err: any) {
            setError("Failed to sign out. Please try again.");
            throw err;
        }
    };

    return (
        <AuthContext.Provider
            value={{ user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, error, clearError }}
        >
            {children}
        </AuthContext.Provider>
    );
}

/** Convert Firebase error codes to readable messages */
function getReadableError(code: string): string {
    switch (code) {
        case "auth/email-already-in-use":
            return "An account with this email already exists. Try signing in.";
        case "auth/invalid-email":
            return "Please enter a valid email address.";
        case "auth/user-disabled":
            return "This account has been disabled. Contact support.";
        case "auth/user-not-found":
            return "No account found with this email. Try signing up.";
        case "auth/wrong-password":
            return "Incorrect password. Please try again.";
        case "auth/invalid-credential":
            return "Invalid email or password. Please try again.";
        case "auth/weak-password":
            return "Password must be at least 6 characters.";
        case "auth/too-many-requests":
            return "Too many attempts. Please wait and try again.";
        case "auth/popup-closed-by-user":
            return "Sign-in popup was closed. Please try again.";
        case "auth/popup-blocked":
            return "Sign-in popup was blocked. Please allow popups for this site.";
        default:
            return "Something went wrong. Please try again.";
    }
}
