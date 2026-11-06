import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import {
  Shield,
  Lock,
  Mail,
  Key,
  Globe,
  Info,
  ShieldCheck,
  CheckCircle2,
  Building2,
  Eye,
  EyeOff,
  Zap,
  Activity,
  Wrench,
} from 'lucide-react';
import { alertService } from '../../services/swal.js';
import { AuthDiagnosticsView } from '../security/AuthDiagnosticsView.js';

export const LoginView: React.FC = () => {
  const { login, quickLogin, language, setLanguage, t } = useAuth();
  const [email, setEmail] = useState('nokohn@gmail.com');
  const [password, setPassword] = useState('LHSE#88C3F50823!9');
  const [showPassword, setShowPassword] = useState(true);
  const [totpCode, setTotpCode] = useState('');
  const [showMfaInput, setShowMfaInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bootstrapInfo, setBootstrapInfo] = useState<any>(null);
  const [showBootstrapModal, setShowBootstrapModal] = useState(false);

  // Check bootstrap status on mount
  useEffect(() => {
    fetch('/api/auth/bootstrap-status')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setBootstrapInfo(data);
          if (data.notice?.temporaryBootstrapPassword) {
            setPassword(data.notice.temporaryBootstrapPassword);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alertService.error(
        language === 'lo' ? 'ກະລຸນາປ້ອນຂໍ້ມູນ' : 'Missing Information',
        language === 'lo' ? 'ກະລຸນາປ້ອນອີເມວ ແລະ ລະຫັດຜ່ານ' : 'Please provide both email and password'
      );
      return;
    }

    setLoading(true);
    const res = await login(email, password, showMfaInput ? totpCode : undefined);
    setLoading(false);

    if (res.mfaRequired) {
      setShowMfaInput(true);
      alertService.toast('info', language === 'lo' ? 'ກະລຸນາປ້ອນລະຫັດ MFA 6 ຫຼັກ' : 'Please enter 6-digit MFA code');
      return;
    }

    if (!res.success) {
      alertService.error(
        language === 'lo' ? 'ເຂົ້າສູ່ລະບົບບໍ່ສຳເລັດ' : 'Login Failed',
        res.error
      );
    }
  };

  const handleQuickSuperAdminLogin = async () => {
    setLoading(true);
    const res = await quickLogin('nokohn@gmail.com');
    setLoading(false);
    if (!res.success) {
      alertService.error(
        language === 'lo' ? 'ເຂົ້າສູ່ລະບົບບໍ່ສຳເລັດ' : 'Login Failed',
        res.error
      );
    }
  };

  const handleUnlockAccount = async () => {
    try {
      const res = await fetch('/api/auth/reset-lockout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        alertService.success(
          language === 'lo' ? 'ປົດລັອກສຳເລັດ' : 'Account Unlocked',
          language === 'lo' ? 'ບັນຊີຖືກປົດລັອກແລ້ວ ສາມາດລອງເຂົ້າສູ່ລະບົບໃໝ່ໄດ້' : 'Account has been unlocked. You may now log in.'
        );
      }
    } catch (e) {
      // ignore
    }
  };

  const handleFillTemporaryPassword = async () => {
    const pwd = bootstrapInfo?.notice?.temporaryBootstrapPassword || 'LHSE#88C3F50823!9';
    setPassword(pwd);
    setEmail('nokohn@gmail.com');
    setShowBootstrapModal(false);
    
    // Auto-unlock in case of prior lockouts
    try {
      await fetch('/api/auth/reset-lockout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nokohn@gmail.com' }),
      });
    } catch (e) {
      // ignore
    }

    alertService.toast('success', language === 'lo' ? 'ໃສ່ລະຫັດຊົ່ວຄາວ & ປົດລັອກຮຽບຮ້ອຍ' : 'Temporary password applied & account unlocked');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center relative overflow-hidden font-sans">
      {/* Background architectural glow */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top right language toggle */}
      <div className="absolute top-6 right-6 flex items-center space-x-2 bg-slate-900/80 border border-slate-800 rounded-full p-1 text-xs z-20">
        <button
          onClick={() => setLanguage('lo')}
          className={`px-3 py-1 rounded-full font-medium transition cursor-pointer ${
            language === 'lo' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          ພາສາລາວ
        </button>
        <button
          onClick={() => setLanguage('en')}
          className={`px-3 py-1 rounded-full font-medium transition cursor-pointer ${
            language === 'en' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          English
        </button>
      </div>

      <div className="max-w-md w-full mx-auto px-6 py-8 relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 shadow-xl shadow-blue-500/20 mb-3 border border-blue-400/30">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            {language === 'lo' ? 'ລັດວິສາຫະກິດຖືຮຸ້ນລາວ' : 'Lao State Enterprise Holding'}
          </h1>
          <p className="text-xs font-semibold text-blue-400 mt-1 uppercase tracking-widest">
            Smart E-Doc-LHSE-V01
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {language === 'lo'
              ? 'ລະບົບບໍລິຫານເອກະສານເອເລັກໂຕຣນິກອັດສະລິຍະ'
              : 'Enterprise Electronic Document Management System'}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2 text-slate-200">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-semibold">
                {language === 'lo' ? 'ການຢືນຢັນຕົວຕົນທີ່ປອດໄພ' : 'Secure Authentication'}
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
              LHSE Enterprise
            </span>
          </div>

          {/* Quick 1-Click Super Admin Sign In Banner */}
          <div className="mb-5 p-3.5 rounded-xl bg-gradient-to-b from-blue-950/80 to-slate-950/90 border border-blue-500/40 text-xs shadow-inner">
            <div className="flex items-center justify-between text-blue-300 font-semibold mb-1">
              <span>{language === 'lo' ? 'ບັນຊີ Super Admin ເລີ່ມຕົ້ນ:' : 'Super Admin Account:'}</span>
              <span className="font-mono text-amber-300 text-xs font-bold select-all">LHSE#88C3F50823!9</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2.5">
              {language === 'lo'
                ? 'ອີເມວ: nokohn@gmail.com | ກົດປຸ່ມສີຟ້າລຸ່ມນີ້ເພື່ອເຂົ້າສູ່ລະບົບທັນທີ'
                : 'Email: nokohn@gmail.com | Click button below for instant 1-click access'}
            </p>
            <button
              type="button"
              onClick={handleQuickSuperAdminLogin}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/30 transition cursor-pointer disabled:opacity-60"
            >
              <Zap className="w-4 h-4 text-amber-300 fill-amber-300 animate-pulse" />
              <span>
                {language === 'lo'
                  ? '⚡ ເຂົ້າສູ່ລະບົບ Super Admin ທັນທີ (1-Click Login)'
                  : '⚡ 1-Click Super Admin Login'}
              </span>
            </button>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-3 text-[11px] text-slate-500 uppercase tracking-wider">
              {language === 'lo' ? 'ຫຼື ປ້ອນຂໍ້ມູນເອງ' : 'Or Sign In Manually'}
            </span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-3.5 mt-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.emailLabel}
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nokohn@gmail.com"
                  className="w-full px-4 py-2.5 pl-10 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  {t.passwordLabel}
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center space-x-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPassword ? (language === 'lo' ? 'ເຊື່ອງລະຫັດ' : 'Hide') : (language === 'lo' ? 'ສະແດງລະຫັດ' : 'Show')}</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-2.5 pl-10 pr-10 rounded-xl bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              </div>
            </div>

            {/* MFA TOTP code if requested */}
            {showMfaInput && (
              <div className="bg-blue-950/40 border border-blue-800/80 rounded-xl p-3.5 mt-2 animate-fadeIn">
                <label className="block text-xs font-semibold text-blue-300 mb-1">
                  {t.mfaPrompt}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full px-4 py-2 pl-10 rounded-lg bg-slate-900 border border-blue-500/50 text-white text-base tracking-widest text-center font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <Key className="w-4 h-4 text-blue-400 absolute left-3 top-2.5" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  {language === 'lo'
                    ? 'ກະລຸນາເປີດແອັບ Google Authenticator ແລ້ວປ້ອນລະຫັດ 6 ຫຼັກ'
                    : 'Open Google Authenticator and enter your current 6-digit code'}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
            >
              <Shield className="w-4 h-4" />
              <span>
                {loading
                  ? (language === 'lo' ? 'ກຳລັງກວດສອບ...' : 'Authenticating...')
                  : (showMfaInput ? (language === 'lo' ? 'ຢືນຢັນລະຫັດ MFA' : 'Verify MFA Code') : t.loginButton)}
              </span>
            </button>
          </form>

          {/* Initial Super Admin Bootstrap helper actions */}
          <div className="mt-4 pt-3.5 border-t border-slate-800 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleFillTemporaryPassword}
              className="py-2 px-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-medium flex items-center justify-center space-x-1.5 transition cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {language === 'lo' ? 'ໃສ່ລະຫັດເລີ່ມຕົ້ນ' : 'Auto-Fill Password'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleUnlockAccount}
              className="py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-medium flex items-center justify-center space-x-1.5 transition cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-blue-400" />
              <span>
                {language === 'lo' ? 'ປົດລັອກບັນຊີ' : 'Unlock Account'}
              </span>
            </button>
          </div>

          <div className="mt-4 text-center text-[11px] text-slate-500">
            {language === 'lo'
              ? 'ລະບົບມີການບັນທຶກ IP Address ແລະ ປະຫວັດການເຂົ້າເຖິງເພື່ອຄວາມປອດໄພ'
              : 'All authentication events and IP addresses are recorded in the security audit ledger.'}
          </div>
        </div>

        {/* Footer address info */}
        <div className="text-center mt-5 text-slate-500 text-xs">
          <p className="font-medium text-slate-400">LHSE • Vientiane Capital, Lao PDR</p>
          <p className="text-[11px] mt-0.5">ຖະໜົນລ້ານຊ້າງ, ບ້ານຫັດສະດີ, ເມືອງຈັນທະບູລີ, ນະຄອນຫຼວງວຽງຈັນ</p>
        </div>
      </div>
    </div>
  );
};
