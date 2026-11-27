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

  async function login(email, password, role) {
    const data = await apiRequest('/auth/login', { method: 'POST', body: { email: email, password: password, role: role } });
    saveToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function register(name, email, password, role) {
    return apiRequest('/auth/register', { method: 'POST', body: { name: name, email: email, password: password, role: role } });
  }

  async function verifyEmail(email, code) {
    const data = await apiRequest('/auth/verify-email', { method: 'POST', body: { email: email, code: code } });
    saveToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function resendCode(email) {
    return apiRequest('/auth/resend-code', { method: 'POST', body: { email: email } });
  }

  async function forgotPassword(email) {
    return apiRequest('/auth/forgot-password', { method: 'POST', body: { email: email } });
  }

  async function resetPassword(email, code, newPassword) {
    return apiRequest('/auth/reset-password', { method: 'POST', body: { email: email, code: code, newPassword: newPassword } });
  }

  async function updateProfile(changes) {
    const data = await apiRequest('/auth/me', { method: 'PATCH', body: changes });
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

  const value = {
    user: user,
    checking: checking,
    login: login,
    register: register,
    verifyEmail: verifyEmail,
    resendCode: resendCode,
    forgotPassword: forgotPassword,
    resetPassword: resetPassword,
    updateProfile: updateProfile,
    logout: logout,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
