import { useCallback, useEffect, useMemo, useState } from 'react';
import { loginUser, registerUser, verify2faCode } from '../services/authService';
import { normalizeAuthResponse } from '../utils/authResponse';
import AuthContext from './auth-context';

const readStoredUser = () => {
  try {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(readStoredUser);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const storeSession = useCallback((authPayload) => {
    const normalized = normalizeAuthResponse(authPayload);

    if (normalized.token) {
      localStorage.setItem('token', normalized.token);
    } else {
      localStorage.removeItem('token');
    }

    if (normalized.user) {
      localStorage.setItem('user', JSON.stringify(normalized.user));
    } else {
      localStorage.removeItem('user');
    }

    setToken(normalized.token);
    setUser(normalized.user);
    return normalized;
  }, []);

  const login = useCallback(
    async (credentials) => {
      setIsAuthLoading(true);
      try {
        const payload = await loginUser(credentials);
        // If 2FA is required, don't store session yet, just return the payload
        if (payload.requires_2fa) {
          return payload;
        }
        return storeSession(payload);
      } finally {
        setIsAuthLoading(false);
      }
    },
    [storeSession],
  );
  
  const verify2fa = useCallback(
    async (data) => {
      setIsAuthLoading(true);
      try {
        const payload = await verify2faCode(data);
        return storeSession(payload);
      } finally {
        setIsAuthLoading(false);
      }
    },
    [storeSession],
  );

  const register = useCallback(
    async (userData) => {
      setIsAuthLoading(true);
      try {
        const payload = await registerUser(userData);
        return storeSession(payload);
      } finally {
        setIsAuthLoading(false);
      }
    },
    [storeSession],
  );

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    window.addEventListener('fixsquad:unauthorized', logout);
    return () => window.removeEventListener('fixsquad:unauthorized', logout);
  }, [logout]);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token || user),
      isAuthLoading,
      login,
      verify2fa,
      register,
      logout,
    }),
    [isAuthLoading, login, verify2fa, logout, register, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
