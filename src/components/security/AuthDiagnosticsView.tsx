import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Key,
  Lock,
  User,
  Globe,
  Clock,
  Laptop,
  Terminal,
  Zap,
  RotateCcw,
  Search,
  Filter,
  Check,
  AlertOctagon,
  Copy,
} from 'lucide-react';
import { alertService } from '../../services/swal.js';

interface DiagnosticsData {
  success: boolean;
  timestamp: string;
  serverTime: string;
  timezone: string;
  metrics: {
    totalAttempts: number;
    successCount: number;
    failedPasswordCount: number;
    failedMfaCount: number;
    currentlyLockedAccounts: number;
  };
  targetAccounts: Array<{
    id: string;
    email: string;
    full_name_lo: string;
    status: string;
    failed_login_attempts: number;
    locked_until: string | null;
    must_change_password: number;
    mfa_enabled: number;
    last_login_at: string | null;
    dept_name_lo: string | null;
    dept_code: string | null;
    active_sessions: number;
  }>;
  recentAttempts: Array<{
    id: string;
    user_id: string | null;
    email: string;
    ip_address: string;
    user_agent: string;
    status: string;
    failure_reason: string | null;
    created_at: string;
  }>;
  authAuditLogs: Array<{
    id: string;
    actor_email: string;
    action: string;
    status: string;
    details: string;
    ip_address: string;
    created_at: string;
  }>;
  bootstrapStatus: {
    hasTemporaryBootstrapNotice: boolean;
    superAdminEmail: string;
    temporaryPasswordConfigured: string;
  };
}

export const AuthDiagnosticsView: React.FC<{ onClose?: () => void; isModal?: boolean }> = ({
  onClose,
  isModal = false,
}) => {
  const { language, quickLogin } = useAuth();
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Credential Dry-Run Tester states
  const [testEmail, setTestEmail] = useState('nokohn@gmail.com');
  const [testPassword, setTestPassword] = useState('LHSE#88C3F50823!9');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const fetchDiagnostics = async () => {
    try {
      const res = await fetch('/api/auth/diagnostics');
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (e) {
      console.error('Failed to load diagnostics', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  // Auto-refresh timer every 5 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDiagnostics();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleClearAllLocks = async () => {
    const confirm = await alertService.confirm(
      language === 'lo' ? 'ຢືນຢັນການປົດລັອກທຸກບັນຊີ' : 'Confirm Unlock All Accounts',
      language === 'lo' ? 'ທ່ານຕ້ອງການຣີເຊັດ Failed Attempts ແລະ ປົດລັອກທຸກບັນຊີແທ້ບໍ?' : 'Reset failed login counters and remove all active locks?',
      language === 'lo' ? 'ປົດລັອກທັນທີ' : 'Unlock Now',
      language === 'lo' ? 'ຍົກເລີກ' : 'Cancel'
    );

    if (confirm.isConfirmed) {
      try {
        const res = await fetch('/api/auth/diagnostics/clear-locks', { method: 'POST' });
        const json = await res.json();
        if (json.success) {
          alertService.toast('success', language === 'lo' ? json.messageLo : json.messageEn);
          fetchDiagnostics();
        }
      } catch (e) {
        alertService.error(language === 'lo' ? 'ເກີດຂໍ້ຜິດພາດ' : 'Error', 'Failed to clear locks');
      }
    }
  };

  const handleTestCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/auth/diagnostics/test-credential', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: testPassword }),
      });
      const json = await res.json();
      setTestResult(json);
    } catch (e) {
      alertService.error('Error', 'Test request failed');
    } finally {
      setTesting(false);
    }
  };

  const handleQuickLoginFromDiagnostics = async () => {
    const res = await quickLogin('nokohn@gmail.com');
    if (res.success) {
      if (onClose) onClose();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alertService.toast('success', language === 'lo' ? 'ຄັດລອກແລ້ວ' : 'Copied to clipboard');
  };

  const attempts = data?.recentAttempts || [];
  const filteredAttempts = attempts.filter(att => {
    const matchesStatus = filterStatus === 'ALL' || att.status === filterStatus;
    const matchesSearch =
      att.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      att.ip_address.includes(searchQuery) ||
      (att.failure_reason && att.failure_reason.toLowerCase().includes(searchQuery.toLowerCase())) ||
      att.user_agent.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const superAdminAccount = data?.targetAccounts?.find(a => a.email === 'nokohn@gmail.com');

  return (
    <div className={`space-y-6 font-sans ${isModal ? 'max-h-[85vh] overflow-y-auto px-1' : ''}`}>
      {/* Header bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight">
              {language === 'lo'
                ? 'ລະບົບວິນິດໄສ ແລະ ແກ້ໄຂບັນຫາການເຂົ້າສູ່ລະບົບ (Auth Diagnostics)'
                : 'Server-Side Authentication Diagnostics & Troubleshooting'}
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            {language === 'lo'
              ? 'ສະແດງປະຫວັດການ Login, ສາເຫດທີ່ເຂົ້າລະບົບບໍ່ໄດ້, ສະຖານະ Lockout, ແລະ ເຄື່ອງມື Dry-Run ທົດສອບລະຫັດຜ່ານແບບ Real-time.'
              : 'Inspect live server-side authentication ledger, failure root causes, account lockout states, and credential verification.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 1-Click login shortcut */}
          <button
            type="button"
            onClick={handleQuickLoginFromDiagnostics}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-blue-600/30 transition cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            <span>{language === 'lo' ? 'ເຂົ້າສູ່ລະບົບທັນທີ' : '1-Click Login'}</span>
          </button>

          {/* Unlock All Locks */}
          <button
            type="button"
            onClick={handleClearAllLocks}
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{language === 'lo' ? 'ປົດລັອກທຸກບັນຊີ' : 'Clear All Locks'}</span>
          </button>

          {/* Auto Refresh Toggle */}
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center space-x-1.5 ${
              autoRefresh
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
            <span>{autoRefresh ? (language === 'lo' ? 'ອັບເດດສົດ (5s)' : 'Live Auto (5s)') : (language === 'lo' ? 'ອັບເດດເອງ' : 'Manual')}</span>
          </button>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={fetchDiagnostics}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              {language === 'lo' ? 'ປິດ (Close)' : 'Close'}
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards: Diagnostics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 mb-1">
            {language === 'lo' ? 'ລອງເຂົ້າລະບົບທັງໝົດ' : 'Total Attempts'}
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {data?.metrics.totalAttempts || 0}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <div className="text-[11px] font-semibold text-emerald-700 mb-1 flex items-center justify-between">
            <span>{language === 'lo' ? 'ສຳເລັດ (Success)' : 'Successful Logins'}</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-800">
            {data?.metrics.successCount || 0}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-red-200 bg-red-50/20 shadow-xs">
          <div className="text-[11px] font-semibold text-red-700 mb-1 flex items-center justify-between">
            <span>{language === 'lo' ? 'ລະຫັດຜ່ານຜິດ' : 'Failed Passwords'}</span>
            <XCircle className="w-3.5 h-3.5 text-red-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-red-800">
            {data?.metrics.failedPasswordCount || 0}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <div className="text-[11px] font-semibold text-amber-700 mb-1 flex items-center justify-between">
            <span>{language === 'lo' ? 'MFA ຜິດພາດ' : 'MFA Failures'}</span>
            <Key className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-800">
            {data?.metrics.failedMfaCount || 0}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-indigo-200 bg-indigo-50/20 shadow-xs">
          <div className="text-[11px] font-semibold text-indigo-700 mb-1 flex items-center justify-between">
            <span>{language === 'lo' ? 'ບັນຊີທີ່ຕິດລັອກ' : 'Active Lockouts'}</span>
            <Lock className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-800">
            {data?.metrics.currentlyLockedAccounts || 0}
          </div>
        </div>
      </div>

      {/* Row 2: Super Admin Account Deep-Dive Inspector + Credential Dry-Run Tester */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Status Inspector */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">
                {language === 'lo' ? 'ກວດສອບສະຖານະບັນຊີ Super Admin' : 'Super Admin Account Status'}
              </h2>
            </div>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
              nokohn@gmail.com
            </span>
          </div>

          {superAdminAccount ? (
            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">{language === 'lo' ? 'ສະຖານະບັນຊີ:' : 'Account Status:'}</span>
                <span className="px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-emerald-100 text-emerald-800">
                  {superAdminAccount.status}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">{language === 'lo' ? 'ຈຳນວນຄັ້ງທີ່ປ້ອນຜິດສະສົມ (Failed Counter):' : 'Failed Attempts Counter:'}</span>
                <div className="flex items-center space-x-2">
                  <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                    superAdminAccount.failed_login_attempts >= 4
                      ? 'bg-red-100 text-red-700'
                      : superAdminAccount.failed_login_attempts > 0
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {superAdminAccount.failed_login_attempts} / 5
                  </span>
                  {superAdminAccount.failed_login_attempts > 0 && (
                    <span className="text-[10px] text-amber-600 font-medium">
                      ({5 - superAdminAccount.failed_login_attempts} remaining before lockout)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">{language === 'lo' ? 'ສະຖານະການລັອກ (Lockout Status):' : 'Lockout Status:'}</span>
                {superAdminAccount.locked_until && new Date(superAdminAccount.locked_until).getTime() > Date.now() ? (
                  <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold text-xs flex items-center space-x-1">
                    <Lock className="w-3 h-3" />
                    <span>LOCKED until {new Date(superAdminAccount.locked_until).toLocaleTimeString()}</span>
                  </span>
                ) : (
                  <span className="text-emerald-600 font-semibold flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{language === 'lo' ? 'ປົກກະຕິ (ບໍ່ຖືກລັອກ)' : 'Unlocked & Active'}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">{language === 'lo' ? 'ບັງຄັບປ່ຽນລະຫັດຄັ້ງທຳອິດ (Must Change Password):' : 'First-Login Change Flag:'}</span>
                <span className="font-semibold text-slate-800">
                  {superAdminAccount.must_change_password ? 'YES (Active Bootstrap)' : 'NO'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">{language === 'lo' ? 'ການຢືນຢັນ MFA:' : 'Two-Factor MFA:'}</span>
                <span className="font-semibold text-slate-800">
                  {superAdminAccount.mfa_enabled ? 'ENABLED' : 'DISABLED (Initial Setup)'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">{language === 'lo' ? 'Session ທີ່ຍັງໃຊ້ງານຢູ່ (Active Sessions):' : 'Active Sessions:'}</span>
                <span className="font-mono font-bold text-blue-600">
                  {superAdminAccount.active_sessions}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500">{language === 'lo' ? 'ເຂົ້າລະບົບສຳເລັດຫຼ້າສຸດ:' : 'Last Successful Login:'}</span>
                <span className="font-mono text-slate-700 text-[11px]">
                  {superAdminAccount.last_login_at || 'Never'}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-slate-400 py-6 text-center text-xs">
              {language === 'lo' ? 'ບໍ່ພົບຂໍ້ມູນບັນຊີ Super Admin' : 'Super Admin account not found'}
            </div>
          )}
        </div>

        {/* Interactive Credential Dry-Run Tester */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">
                {language === 'lo' ? 'ທົດສອບກວດສອບລະຫັດຜ່ານ (Safe Dry-Run Test)' : 'Safe Credential Dry-Run Tester'}
              </h2>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
              No Penalty
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-3.5">
            {language === 'lo'
              ? 'ທົດສອບວ່າລະຫັດຜ່ານໃດໜຶ່ງຈະຜ່ານການກວດສອບຂອງ Server ບໍ ໂດຍບໍ່ມີການເພີ່ມຄ່າ Failed Attempts ຫຼື ລັອກບັນຊີ.'
              : 'Safely test if a password validates against database hashes or bootstrap fallbacks without risking lockout.'}
          </p>

          <form onSubmit={handleTestCredential} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                {language === 'lo' ? 'ອີເມວທົດສອບ:' : 'Test Email:'}
              </label>
              <input
                type="email"
                required
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-600">
                  {language === 'lo' ? 'ລະຫັດຜ່ານທົດສອບ:' : 'Test Password:'}
                </label>
                <div className="flex items-center space-x-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setTestPassword('LHSE#88C3F50823!9')}
                    className="text-blue-600 hover:underline"
                  >
                    Bootstrap
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setTestPassword('admin123')}
                    className="text-blue-600 hover:underline"
                  >
                    admin123
                  </button>
                </div>
              </div>
              <input
                type="text"
                required
                value={testPassword}
                onChange={e => setTestPassword(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
              />
            </div>

            <button
              type="submit"
              disabled={testing}
              className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-60"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{testing ? 'Testing...' : (language === 'lo' ? 'ທົດສອບລະຫັດຜ່ານ (Dry-Run)' : 'Execute Dry-Run Test')}</span>
            </button>
          </form>

          {/* Test Result Display */}
          {testResult && (
            <div className={`mt-4 p-3.5 rounded-xl border text-xs animate-fadeIn ${
              testResult.valid
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-red-50 border-red-300 text-red-900'
            }`}>
              <div className="flex items-center space-x-2 font-bold mb-1">
                {testResult.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
                <span>
                  {testResult.valid
                    ? (language === 'lo' ? 'ຜົນການທົດສອບ: ຜ່ານສົມບູນ (SUCCESS)' : 'Test Result: AUTHENTICATION SUCCESS')
                    : (language === 'lo' ? 'ຜົນການທົດສອບ: ບໍ່ຜ່ານ (FAIL)' : 'Test Result: AUTHENTICATION FAIL')}
                </span>
              </div>
              <p className="text-[11px] mt-1 text-slate-700">
                {language === 'lo' ? testResult.diagnosticReasonLo : testResult.diagnosticReasonEn}
              </p>
              {testResult.details && (
                <div className="mt-2 pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-1.5 text-[10px] font-mono text-slate-600">
                  <div>Hash Match: {testResult.details.passwordMatchesDirectHash ? 'YES' : 'NO'}</div>
                  <div>Fallback Match: {testResult.details.passwordMatchesBootstrapFallback ? 'YES' : 'NO'}</div>
                  <div>Account Locked: {testResult.details.isCurrentlyLocked ? 'YES' : 'NO'}</div>
                  <div>Status: {testResult.details.accountStatus}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Server-side Login History Audit Table */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>{language === 'lo' ? 'ບັນທຶກປະຫວັດການລອງເຂົ້າສູ່ລະບົບ (Server Login History Ledger)' : 'Recent Server-Side Login Attempts'}</span>
            </h2>
            <span className="text-[11px] text-slate-400">
              {language === 'lo' ? 'ບັນທຶກທຸກ Request ທີ່ເຂົ້າມາ Server ພ້ອມ IP, Browser ແລະ ສາເຫດ' : 'Immutable audit trail of all authentication requests'}
            </span>
          </div>

          {/* Filter and Search Bar */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <input
                type="text"
                placeholder={language === 'lo' ? 'ຄົ້ນຫາ IP, ອີເມວ...' : 'Filter by IP, email...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full sm:w-48 pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>

            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-700 cursor-pointer"
            >
              <option value="ALL">{language === 'lo' ? 'ທຸກສະຖານະ (All)' : 'All Status'}</option>
              <option value="FAILED_PASSWORD">{language === 'lo' ? 'ສະເພາະລະຫັດຜິດ (Failed)' : 'Failed Password Only'}</option>
              <option value="SUCCESS">{language === 'lo' ? 'ສະເພາະທີ່ສຳເລັດ (Success)' : 'Success Only'}</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <th className="py-2.5 px-3">ວັນທີ & ເວລາ (Timestamp)</th>
                <th className="py-2.5 px-3">ອີເມວ (Identity)</th>
                <th className="py-2.5 px-3">ສະຖານະ (Status)</th>
                <th className="py-2.5 px-3">ສາເຫດ / ລາຍລະອຽດ (Diagnostic Reason)</th>
                <th className="py-2.5 px-3">IP Address</th>
                <th className="py-2.5 px-3">User Agent / Client</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAttempts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    {language === 'lo' ? 'ບໍ່ພົບປະຫວັດການເຂົ້າລະບົບຕາມເງື່ອນໄຂ' : 'No matching login attempts found'}
                  </td>
                </tr>
              ) : (
                filteredAttempts.map(att => {
                  const isSuccess = att.status === 'SUCCESS';
                  return (
                    <tr key={att.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                        {att.created_at}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {att.email}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isSuccess
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {isSuccess ? 'SUCCESS' : att.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                        {att.failure_reason || (isSuccess ? 'Authentication verified' : '-')}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-blue-600 whitespace-nowrap">
                        {att.ip_address}
                      </td>
                      <td className="py-2.5 px-3 text-[10px] text-slate-500 max-w-xs truncate" title={att.user_agent}>
                        {att.user_agent.includes('Chrome') ? 'Chrome / Windows' : att.user_agent}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
