import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { User } from "../types/user";
import * as api from "../api/backend";
import { loadNativeToken } from "../api/backend";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (googleCredential: string) => Promise<{ isNewUser: boolean }>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => ({ isNewUser: false }),
  logout: async () => {},
  updateUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check existing session on mount (load native token first)
  useEffect(() => {
    async function init() {
      try {
        await loadNativeToken();
        const u = await api.getMe();
        setUser(u);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const login = useCallback(async (googleCredential: string) => {
    const { user: loggedInUser, isNewUser } =
      await api.loginWithGoogle(googleCredential);
    setUser(loggedInUser);
    return { isNewUser };
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    // Clear dashboard cache so fresh data loads on next login
    try {
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith("ss_dashboard_")) sessionStorage.removeItem(key);
      }
    } catch {}
  }, []);

  const updateUser = useCallback((u: User) => setUser(u), []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    updateUser,
  };

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </GoogleOAuthProvider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
