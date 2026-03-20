import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      authAPI.getProfile()
        .then((res) => setUser(res.data.user || res.data))
        .catch(() => { localStorage.removeItem('token'); setToken(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    if (res.data.requiresOTP) return { requiresOTP: true };
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    return {};
  };

  const register = async (data) => {
    await authAPI.register(data);
  };

  const verifyOTP = async (email, otp) => {
    const res = await authAPI.verifyOTP({ email, otp });
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    disconnectSocket();
  };

  return (
    <AuthContext.Provider value={{
      user, token, loading, login, register, verifyOTP, logout,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      isShop: user?.role === 'shop',
      isUser: user?.role === 'user',
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
