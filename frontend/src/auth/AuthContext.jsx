import { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest, saveToken, readToken, clearToken } from '../api/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(function () {
    async function loadCurrentUser() {
      if (!readToken()) {
        setChecking(false);
        return;
      }
      try {
        const data = await apiRequest('/auth/me');
        setUser(data.user);
      } catch {
        clearToken();
      }
      setChecking(false);
    }
    loadCurrentUser();
  }, []);

  async function login(email, password) {
    const data = await apiRequest('/auth/login', { method: 'POST', body: { email: email, password: password } });
    saveToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      clearToken();
      setUser(null);
    }
  }

  const value = { user: user, checking: checking, login: login, logout: logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
