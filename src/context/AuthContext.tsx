import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, RoleCode } from '../types/index.js';
import { translations, Language } from '../i18n/index.js';
import { alertService } from '../services/swal.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  mustChangePassword: boolean;
  language: Language;
  t: typeof translations['lo'];
  setLanguage: (lang: Language) => void;
  login: (email: string, password: string, totpCode?: string) => Promise<{ success: boolean; mfaRequired?: boolean; error?: string }>;
  quickLogin: (email?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('lhse_session_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
  const [language, setLanguageState] = useState<Language>(
    (localStorage.getItem('lhse_language') as Language) || 'lo'
  );

  const t = translations[language];

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('lhse_language', lang);
  };

  const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    headers.set('Content-Type', 'application/json');

    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      // Session expired
      localStorage.removeItem('lhse_session_token');
      setToken(null);
      setUser(null);
    }
    return res;
  };

  const refreshUser = async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetchWithAuth('/api/auth/me');
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        setMustChangePassword(Boolean(data.user.must_change_password));
      } else {
        setUser(null);
        setToken(null);
        localStorage.removeItem('lhse_session_token');
      }
    } catch (e) {
      console.error('Failed to load user profile', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [token]);

  const login = async (email: string, password: string, totpCode?: string) => {
    try {
      alertService.loading(language === 'lo' ? 'ກຳລັງກວດສອບ...' : 'Authenticating...', '');
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, totpCode }),
      });
      const data = await res.json();
      alertService.close();

      if (!res.ok || !data.success) {
        return { success: false, error: data.message || 'Login failed' };
      }

      if (data.mfaRequired) {
        return { success: true, mfaRequired: true };
      }

      if (data.token) {
        setToken(data.token);
        localStorage.setItem('lhse_session_token', data.token);
        setUser(data.user);
        setMustChangePassword(Boolean(data.mustChangePassword));
        alertService.toast('success', language === 'lo' ? 'ເຂົ້າສູ່ລະບົບສຳເລັດ' : 'Login successful');
        return { success: true };
      }

      return { success: false, error: 'Unexpected login response' };
    } catch (err: any) {
      alertService.close();
      return { success: false, error: err.message || 'Connection error' };
    }
  };

  const quickLogin = async (email: string = 'nokohn@gmail.com') => {
    try {
      alertService.loading(language === 'lo' ? 'ກຳລັງເຂົ້າສູ່ລະບົບ...' : 'Signing in...', '');
      const res = await fetch('/api/auth/quick-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      alertService.close();

      if (!res.ok || !data.success) {
        return { success: false, error: data.message || 'Quick login failed' };
      }

      if (data.token) {
        setToken(data.token);
        localStorage.setItem('lhse_session_token', data.token);
        setUser(data.user);
        setMustChangePassword(Boolean(data.mustChangePassword));
        alertService.toast('success', language === 'lo' ? 'ເຂົ້າສູ່ລະບົບສຳເລັດ' : 'Login successful');
        return { success: true };
      }

      return { success: false, error: 'Unexpected login response' };
    } catch (err: any) {
      alertService.close();
      return { success: false, error: err.message || 'Connection error' };
    }
  };

  const logout = async () => {
    const confirm = await alertService.confirm(
      language === 'lo' ? 'ອອກຈາກລະບົບ' : 'Sign Out',
      language === 'lo' ? 'ທ່ານຕ້ອງການອອກຈາກລະບົບແທ້ບໍ?' : 'Are you sure you want to sign out?',
      language === 'lo' ? 'ອອກຈາກລະບົບ' : 'Sign Out',
      language === 'lo' ? 'ຍົກເລີກ' : 'Cancel'
    );

    if (confirm.isConfirmed) {
      try {
        if (token) {
          await fetchWithAuth('/api/auth/logout', { method: 'POST' });
        }
      } catch (e) {
        // ignore
      }
      localStorage.removeItem('lhse_session_token');
      setToken(null);
      setUser(null);
      setMustChangePassword(false);
      alertService.toast('success', language === 'lo' ? 'ອອກຈາກລະບົບຮຽບຮ້ອຍແລ້ວ' : 'Logged out');
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      alertService.loading(language === 'lo' ? 'ກຳລັງປ່ຽນລະຫັດຜ່ານ...' : 'Updating password...');
      const res = await fetchWithAuth('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      alertService.close();

      if (!res.ok || !data.success) {
        return { success: false, error: data.message || 'Failed to update password' };
      }

      setMustChangePassword(false);
      if (user) {
        setUser({ ...user, must_change_password: false });
      }
      await alertService.success(
        language === 'lo' ? 'ປ່ຽນລະຫັດຜ່ານສຳເລັດ' : 'Password Updated',
        language === 'lo' ? 'ລະຫັດຜ່ານຂອງທ່ານຖືກປັບປຸງຮຽບຮ້ອຍແລ້ວ.' : 'Your password has been successfully updated.'
      );
      return { success: true };
    } catch (err: any) {
      alertService.close();
      return { success: false, error: err.message };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        mustChangePassword,
        language,
        t,
        setLanguage,
        login,
        quickLogin,
        logout,
        changePassword,
        refreshUser,
        fetchWithAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
