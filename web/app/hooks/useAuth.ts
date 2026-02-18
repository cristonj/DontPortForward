"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { auth } from "../../lib/firebase";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";

interface UseAuthReturn {
  user: User | null;
  authLoading: boolean;
  errorMsg: string;
  handleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const isForcedLogout = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (isForcedLogout.current) {
        isForcedLogout.current = false;
      } else {
        setErrorMsg("");
      }

      if (currentUser && currentUser.email) {
        const envAllowed = process.env.ALLOWED_EMAILS;
        if (envAllowed) {
          const allowed = envAllowed.split(',').map(e => e.trim());
          if (!allowed.includes(currentUser.email)) {
            console.log("Access denied for:", currentUser.email);
            isForcedLogout.current = true;
            await signOut(auth);
            setErrorMsg("Access Denied: Your email is not in the allowed list.");
            setUser(null);
            setAuthLoading(false);
            return;
          }
        }
      }
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in", error);
      setErrorMsg("Login failed. Please check your connection and try again.");
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  }, []);

  return {
    user,
    authLoading,
    errorMsg,
    handleLogin,
    handleLogout,
  };
}
