import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { UserProfile } from "../types";
import { api, getStoredApiKey, setStoredApiKey, getStoredBaseUrl, setStoredBaseUrl } from "../services/api";

interface AuthContextType {
  apiKey: string;
  baseUrl: string;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setKey: (key: string) => Promise<boolean>;
  setUrl: (url: string) => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [apiKey, setApiKeyState] = useState<string>(getStoredApiKey());
  const [baseUrl, setBaseUrlState] = useState<string>(getStoredBaseUrl());
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentUser = useCallback(async () => {
    const currentKey = getStoredApiKey();
    if (!currentKey) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const profile = await api.getCurrentUser();
      setUser(profile);
    } catch (err: any) {
      console.warn("Auth check failed:", err.message);
      setError(err.message || "Failed to authenticate with current key.");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const setKey = async (newKey: string): Promise<boolean> => {
    setStoredApiKey(newKey);
    setApiKeyState(newKey);
    setIsLoading(true);
    setError(null);
    try {
      const profile = await api.getCurrentUser();
      setUser(profile);
      setIsLoading(false);
      return true;
    } catch (err: any) {
      setError(err.message || "Invalid API Key");
      setIsLoading(false);
      return false;
    }
  };

  const setUrl = (newUrl: string) => {
    setStoredBaseUrl(newUrl);
    setBaseUrlState(newUrl);
    fetchCurrentUser();
  };

  const logout = () => {
    setStoredApiKey("");
    setApiKeyState("");
    setUser(null);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        apiKey,
        baseUrl,
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        setKey,
        setUrl,
        logout,
        refresh: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
