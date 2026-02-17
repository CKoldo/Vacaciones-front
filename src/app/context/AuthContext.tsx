import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@/app/types';
import { apiFetch, parseJwt } from '@/app/api';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const payload = parseJwt(token);
      if (payload) {
        setUser({ id: payload.id, username: payload.username, password: '', role: payload.role });
      }
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res: any = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (res && res.token) {
        localStorage.setItem('token', res.token);
        const payload = parseJwt(res.token);
        if (payload) {
          const u: User = { id: payload.id, username: payload.username, password: '', role: payload.role };
          setUser(u);
        }
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
