"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Models } from "appwrite";
import { account } from "@/lib/appwrite";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: Models.User<Models.Preferences> | null;
  loading: boolean;
  checkSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const checkSession = async () => {
    // 1. Optimistically load from cache for instant offline access
    const cachedUser = localStorage.getItem("overload_user");
    if (cachedUser) {
      setUser(JSON.parse(cachedUser));
      setLoading(false);
    }

    try {
      // 2. Fetch fresh session from Appwrite
      const sessionUser = await account.get();
      setUser(sessionUser);
      localStorage.setItem("overload_user", JSON.stringify(sessionUser));

      // Warm the offline cache in the background if we're online
      if (typeof window !== "undefined" && navigator.onLine) {
        const { offlineSync } = await import("@/lib/offlineSync");
        const { Query } = await import("appwrite");
        const { APPWRITE_CONFIG } = await import("@/lib/appwrite");

        offlineSync.listDocuments(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.routinesCollectionId, [Query.equal("userId", sessionUser.$id), Query.limit(100)]).catch(() => {});
        offlineSync.listDocuments(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.workoutsCollectionId, [Query.equal("userId", sessionUser.$id), Query.orderDesc("$createdAt"), Query.limit(5000)]).catch(() => {});
        offlineSync.listDocuments(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.setsCollectionId, [Query.equal("userId", sessionUser.$id), Query.limit(5000)]).catch(() => {});
      }
    } catch (error) {
      // 3. If it fails (e.g. offline) and we didn't have a cache, clear it.
      // If we DO have a cache, we assume we are offline and keep using the cached user!
      if (!cachedUser) {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const logout = async () => {
    try {
      await account.deleteSession("current");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      localStorage.removeItem("overload_user");
      setUser(null);
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, checkSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
