import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const response = await api.login({ email, password });
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify({
      id: response.userId,
      username: response.username,
      email: response.email,
    }));
    setUser({
      id: response.userId,
      username: response.username,
      email: response.email,
    });
    return response;
  };

  const register = async (username, email, password) => {
    const response = await api.register({ username, email, password });
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify({
      id: response.userId,
      username: response.username,
      email: response.email,
    }));
    setUser({
      id: response.userId,
      username: response.username,
      email: response.email,
    });
    return response;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
