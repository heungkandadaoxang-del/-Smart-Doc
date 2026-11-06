import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { MFASetupResponse, LoginHistory } from '../../types/index.js';
import { alertService } from '../../services/swal.js';
import {
  ShieldCheck,
  KeyRound,
  QrCode,
  Smartphone,
  Lock,
  History,
  CheckCircle,
  Copy,
  RefreshCw,
} from 'lucide-react';

export const AccountSecurityView: React.FC = () => {
  const { user, fetchWithAuth, changePassword, language, t } = useAuth();
  
  // Password change form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  // MFA Setup state
  const [mfaData, setMfaData] = useState<MFASetupResponse | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);

  // Login history
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);

  const loadHistory = async () => {
    try {
      const res = await fetchWithAuth('/api/auth/login-history');
      const data = await res.json();
      if (data.success) {
        setLoginHistory(data.history);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      alertService.error(
        language === 'lo' ? 'ລະຫັດຜ່ານສັ້ນເກີນໄປ' : 'Password too short',
        language === 'lo' ? 'ລະຫັດຜ່ານໃໝ່ຕ້ອງມີຢ່າງໜ້ອຍ 8 ຕົວອັກສອນ' : 'Password must be at least 8 characters'
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      alertService.error(
        language === 'lo' ? 'ລະຫັດຜ່ານບໍ່ກົງກັນ' : 'Passwords do not match',
        language === 'lo' ? 'ກະລຸນາກວດສອບການຢືນຢັນລະຫັດຜ່ານໃໝ່' : 'Please check confirm password'
      );
      return;
    }

    setPassLoading(true);
    const res = await changePassword(currentPassword, newPassword);
    setPassLoading(false);

    if (res.success) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleStartMfaSetup = async () => {
    setMfaLoading(true);
    try {
      const res = await fetchWithAuth('/api/auth/mfa/setup');
      const data = await res.json();
      if (data.success) {
        setMfaData(data);
      } else {
        alertService.error('Error', data.message);
      }
    } catch (e: any) {
      alertService.error('Error', e.message);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleEnableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpVerifyCode || totpVerifyCode.length !== 6) {
      alertService.error(
        language === 'lo' ? 'ລະຫັດບໍ່ຄົບ' : 'Invalid Code',
        language === 'lo' ? 'ກະລຸນາປ້ອນລະຫັດ 6 ຫຼັກ' : 'Please enter 6 digits'
      );
      return;
    }

    setMfaLoading(true);
    try {
      const res = await fetchWithAuth('/api/auth/mfa/enable', {
        method: 'POST',
        body: JSON.stringify({ code: totpVerifyCode }),
      });
      const data = await res.json();
      if (data.success) {
        await alertService.success(
          language === 'lo' ? 'ເປີດໃຊ້ MFA ສຳເລັດ' : 'MFA Enabled',
          data.message
        );
        setMfaData(null);
        window.location.reload();
      } else {
        alertService.error('Error', data.message);
      }
    } catch (e: any) {
      alertService.error('Error', e.message);
    } finally {
      setMfaLoading(false);
    }
  };

  const copySecret = () => {
    if (mfaData?.secret) {
      navigator.clipboard.writeText(mfaData.secret);
      alertService.toast('success', language === 'lo' ? 'ຄັດລອກລະຫັດລັບແລ້ວ' : 'Secret copied');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <div className="flex items-center space-x-2 mb-1">
          <span className="p-2 rounded-xl bg-blue-50 text-blue-700">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <h1 className="text-xl font-bold text-slate-900">
            {language === 'lo' ? 'ສູນຄວາມປອດໄພ & ການຢືນຢັນຕົວຕົນ (MFA)' : 'Account Security & MFA'}
          </h1>
        </div>
        <p className="text-xs text-slate-500">
          {language === 'lo'
            ? 'ຄຸ້ມຄອງລະຫັດຜ່ານ, ການຢືນຢັນສອງຂັ້ນຕອນ (Two-Factor Authentication), ແລະ ກວດສອບປະຫວັດການເຂົ້າລະບົບ'
            : 'Manage password, TOTP two-factor authentication, and review login history.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MFA Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  {language === 'lo' ? 'ການຢືນຢັນສອງຂັ້ນຕອນ (MFA / 2FA)' : 'Two-Factor Authentication'}
                </h2>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  user?.mfa_enabled
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-100 text-amber-700 border border-amber-200'
                }`}
              >
                {user?.mfa_enabled ? (language === 'lo' ? 'ເປີດໃຊ້ງານແລ້ວ' : 'Enabled') : (language === 'lo' ? 'ຍັງບໍ່ໄດ້ເປີດ' : 'Disabled')}
              </span>
            </div>

            {user?.mfa_enabled ? (
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 text-xs text-emerald-800 space-y-2">
                <div className="flex items-center space-x-2 font-bold">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>
                    {language === 'lo'
                      ? 'ບັນຊີຂອງທ່ານໄດ້ຮັບການປົກປ້ອງດ້ວຍ Google Authenticator'
                      : 'Account is protected by Google Authenticator'}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {language === 'lo'
                    ? 'ທຸກຄັ້ງທີ່ເຂົ້າສູ່ລະບົບ ທ່ານຈະຕ້ອງປ້ອນລະຫັດ 6 ຫຼັກຈາກແອັບ Authenticator ຂອງທ່ານ.'
                    : 'Every sign-in requires entering a dynamic 6-digit TOTP code.'}
                </p>
              </div>
            ) : mfaData ? (
              <div className="space-y-4 text-xs">
                <p className="text-slate-600">
                  {language === 'lo'
                    ? '1. ສະແກນ QR Code ນີ້ດ້ວຍແອັບ Google Authenticator ຫຼື Microsoft Authenticator:'
                    : '1. Scan this QR code with Google Authenticator:'}
                </p>

                <div className="flex justify-center p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <img src={mfaData.qrCodeUrl} alt="MFA QR Code" className="w-44 h-44 rounded-lg" />
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">
                    {language === 'lo' ? 'ຫຼື ປ້ອນລະຫັດລັບດ້ວຍມື (Manual Key):' : 'Or enter manual secret key:'}
                  </span>
                  <div className="flex items-center space-x-2 bg-slate-100 p-2 rounded-lg font-mono text-[11px]">
                    <span className="flex-1 font-bold">{mfaData.manualCode}</span>
                    <button
                      type="button"
                      onClick={copySecret}
                      className="text-blue-600 hover:text-blue-700 font-sans text-xs font-semibold"
                    >
                      {language === 'lo' ? 'ຄັດລອກ' : 'Copy'}
                    </button>
                  </div>
                </div>

                <form onSubmit={handleEnableMfa} className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {language === 'lo' ? '2. ປ້ອນລະຫັດ 6 ຫຼັກທີ່ສະແດງໃນແອັບເພື່ອຢືນຢັນ:' : '2. Enter 6-digit code from app:'}
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={totpVerifyCode}
                      onChange={e => setTotpVerifyCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full text-center text-lg font-mono tracking-widest px-3 py-2 rounded-xl border border-blue-500 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <div className="flex space-x-2">
                    <button
                      type="submit"
                      disabled={mfaLoading}
                      className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition"
                    >
                      {language === 'lo' ? 'ຢືນຢັນ & ເປີດໃຊ້ງານ MFA' : 'Verify & Enable MFA'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMfaData(null)}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-600 hover:bg-slate-50 transition"
                    >
                      {t.cancel}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-600">
                <p>
                  {language === 'lo'
                    ? 'ເພີ່ມລະດັບຄວາມປອດໄພໃຫ້ບັນຊີຂອງທ່ານ ໂດຍການຮຽກຮ້ອງລະຫັດຢືນຢັນຜ່ານ Google Authenticator / Microsoft Authenticator.'
                    : 'Add an extra layer of security to your account with RFC 6238 TOTP authentication.'}
                </p>
                <button
                  onClick={handleStartMfaSetup}
                  disabled={mfaLoading}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center space-x-2 transition"
                >
                  <QrCode className="w-4 h-4" />
                  <span>{language === 'lo' ? 'ເລີ່ມຕັ້ງຄ່າ MFA ດຽວນີ້' : 'Setup Two-Factor Authentication'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 mb-4">
            <KeyRound className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">
              {language === 'lo' ? 'ປ່ຽນລະຫັດຜ່ານ (Change Password)' : 'Change Password'}
            </h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {language === 'lo' ? 'ລະຫັດຜ່ານປັດຈຸບັນ (Current Password)' : 'Current Password'}
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {language === 'lo' ? 'ລະຫັດຜ່ານໃໝ່ (New Password, min 8 chars)' : 'New Password (min 8 chars)'}
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {language === 'lo' ? 'ຢືນຢັນລະຫັດຜ່ານໃໝ່ (Confirm New Password)' : 'Confirm New Password'}
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={passLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition flex items-center justify-center space-x-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{passLoading ? 'Saving...' : (language === 'lo' ? 'ບັນທຶກລະຫັດຜ່ານໃໝ່' : 'Update Password')}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Login History */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 mb-4">
          <History className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900">
            {language === 'lo' ? 'ປະຫວັດການເຂົ້າສູ່ລະບົບ (Recent Login History)' : 'Recent Login History'}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                <th className="py-2.5 px-4">{t.time}</th>
                <th className="py-2.5 px-4">{t.status}</th>
                <th className="py-2.5 px-4">{t.ipAddress}</th>
                <th className="py-2.5 px-4">{language === 'lo' ? 'ອຸປະກອນ / Browser' : 'User Agent'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loginHistory.map(item => (
                <tr key={item.id}>
                  <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                    {new Date(item.created_at).toLocaleString('en-GB', {
                      timeZone: 'Asia/Vientiane',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.status === 'SUCCESS'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                    {item.ip_address || '127.0.0.1'}
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-[11px] truncate max-w-xs">
                    {item.user_agent}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
