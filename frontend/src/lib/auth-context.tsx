"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiClient, ApiException } from "@/lib/api-client";
import {
  AuthResponse,
  RegisterResponse,
  StoreProfileDto,
  UserDto,
} from "@/types/api";

export interface LoginResult {
  user: UserDto;
  store: StoreProfileDto | null;
}

interface AuthContextValue {
  user: UserDto | null;
  store: StoreProfileDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isAdmin: boolean;
  isSeller: boolean;
  isBuyer: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (displayName: string, email: string, password: string) => Promise<UserDto>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<UserDto | null>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [store, setStore] = useState<StoreProfileDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  /**
   * Refreshes the session using the HttpOnly refresh token cookie.
   * Safe concurrent execution handled by apiClient.
   */
  const refreshSession = useCallback(async (): Promise<UserDto | null> => {
    try {
      let token = await apiClient.refreshAccessToken();
      if (!token) {
        token = apiClient.getAccessToken();
      }
      if (!token) {
        setUser(null);
        setStore(null);
        return null;
      }

      // Fetch the full user profile
      const currentUser = await apiClient.get<UserDto>("/api/v1/auth/me");

      // Load seller store profile if account is a buyer with a store
      let loadedStore: StoreProfileDto | null = null;
      if (currentUser.role === "Buyer") {
        try {
          loadedStore = await apiClient.get<StoreProfileDto>("/api/v1/seller/store");
        } catch {
          loadedStore = null;
        }
      }

      // Update store and user atomically
      setStore(loadedStore);
      setUser(currentUser);
      return currentUser;
    } catch {
      setUser(null);
      setStore(null);
      apiClient.clearAccessToken();
      return null;
    }
  }, []);

  /**
   * Login with email and password.
   * Returns authenticated UserDto.
   */
  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      setError(null);
      try {
        const response = await apiClient.post<AuthResponse>("/api/v1/auth/login", {
          email,
          password,
        });

        apiClient.setAccessToken(response.accessToken);

        // Fetch seller store if buyer, ensuring isSeller is determined before rendering
        let loadedStore: StoreProfileDto | null = null;
        if (response.user.role === "Buyer") {
          try {
            loadedStore = await apiClient.get<StoreProfileDto>("/api/v1/seller/store");
          } catch {
            loadedStore = null;
          }
        }

        setStore(loadedStore);
        setUser(response.user);

        return { user: response.user, store: loadedStore };
      } catch (err: unknown) {
        const message =
          err instanceof ApiException
            ? err.message
            : "Login failed. Please check your network connection and try again.";
        setError(message);
        throw err;
      }
    },
    []
  );

  /**
   * Register a new buyer account and automatically log in.
   */
  const register = useCallback(
    async (
      displayName: string,
      email: string,
      password: string
    ): Promise<UserDto> => {
      setError(null);
      try {
        await apiClient.post<RegisterResponse>("/api/v1/auth/register", {
          displayName,
          email,
          password,
        });

        // Automatically log in on successful registration
        const authResult = await login(email, password);
        return authResult.user;
      } catch (err: unknown) {
        const message =
          err instanceof ApiException
            ? err.message
            : "Registration failed. Please check your input and try again.";
        setError(message);
        throw err;
      }
    },
    [login]
  );

  /**
   * Terminate active session: revokes refresh token on backend and clears in-memory state.
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiClient.post("/api/v1/auth/logout");
    } catch {
      // Ignore network errors on logout to guarantee clean client state
    } finally {
      apiClient.clearAccessToken();
      setUser(null);
      setStore(null);
      setError(null);
    }
  }, []);

  // Subscribe to background session expirations (e.g. background 401 refresh failure)
  useEffect(() => {
    const unsubscribe = apiClient.onSessionExpired(() => {
      setUser(null);
      setStore(null);
    });
    return unsubscribe;
  }, []);

  // Restore session on initial application mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        await refreshSession();
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [refreshSession]);

  const value = useMemo<AuthContextValue>(() => {
    const isAuthenticated = user !== null;
    const isAdmin = user?.role === "Admin";
    const isSeller = user?.role === "Buyer" && store !== null;
    const isBuyer = user?.role === "Buyer" && store === null;

    return {
      user,
      store,
      isAuthenticated,
      isLoading,
      error,
      isAdmin,
      isSeller,
      isBuyer,
      login,
      register,
      logout,
      refreshSession,
      clearError,
    };
  }, [
    user,
    store,
    isLoading,
    error,
    login,
    register,
    logout,
    refreshSession,
    clearError,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
