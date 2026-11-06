import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { AuditLog } from '../../types/index.js';
import { alertService } from '../../services/swal.js';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Activity,
  AlertTriangle,
  Lock,
  User,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const { user, fetchWithAuth, language, t } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [actionSearch, setActionSearch] = useState('');

  const isSuperAdmin = user?.roles.includes('SUPER_ADMIN');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const [logsRes, metricsRes] = await Promise.all([
        fetchWithAuth(`/api/audit?status=${statusFilter}&action=${actionSearch}&limit=100`),
        fetchWithAuth('/api/audit/summary'),
      ]);
      const logsData = await logsRes.json();
      const metricsData = await metricsRes.json();

      if (logsData.success) {
        setLogs(logsData.logs);
      }
      if (metricsData.success) {
        setMetrics(metricsData.metrics);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-700">
              <Activity className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">{t.auditTitle}</h1>
          </div>
          <p className="text-xs text-slate-500">
            {t.auditDesc}
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-600' : ''}`} />
        </button>
      </div>

      {/* Metrics Row */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <span className="text-[11px] text-slate-400 font-medium block mb-1">
              {language === 'lo' ? 'ການເຄື່ອນໄຫວທັງໝົດ' : 'Total Audit Events'}
            </span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {metrics.totalActions}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <span className="text-[11px] text-red-500 font-medium block mb-1">
              {language === 'lo' ? 'ການລະເມີດສິດ/ຖືກຕັນ' : 'Denied / Blocked'}
            </span>
            <div className="text-2xl font-bold text-red-600 font-mono">
              {metrics.deniedAttempts}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <span className="text-[11px] text-slate-400 font-medium block mb-1">
              {language === 'lo' ? 'ເຂົ້າລະບົບມື້ນີ້' : "Today's Logins"}
            </span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {metrics.loginsToday}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <span className="text-[11px] text-emerald-600 font-medium block mb-1">
              {language === 'lo' ? 'ເຊດຊັນທີ່ໃຊ້ງານຢູ່' : 'Active Sessions'}
            </span>
            <div className="text-2xl font-bold text-emerald-600 font-mono">
              {metrics.activeSessions}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={actionSearch}
            onChange={e => setActionSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadLogs()}
            placeholder={language === 'lo' ? 'ຄົ້ນຫາ Action (ກົດ Enter)...' : 'Search Action (press Enter)...'}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-600 focus:outline-none"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
          >
            <option value="">{language === 'lo' ? 'ທຸກສະຖານະ' : 'All Statuses'}</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="DENIED">DENIED (Security Breach)</option>
            <option value="ERROR">ERROR</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">{t.time}</th>
                <th className="py-3 px-4">{t.actor}</th>
                <th className="py-3 px-4">{t.action}</th>
                <th className="py-3 px-4">{t.target}</th>
                <th className="py-3 px-4">{t.result}</th>
                <th className="py-3 px-4">{t.ipAddress}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    {language === 'lo' ? 'ບໍ່ມີບັນທຶກຄວາມປອດໄພ' : 'No audit records found'}
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('en-GB', {
                        timeZone: 'Asia/Vientiane',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block truncate max-w-[180px]">
                        {log.actor_email}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                      {log.action}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {log.entity_type} {log.entity_id ? `(${log.entity_id.substring(0, 16)})` : ''}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : log.status === 'DENIED'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {log.status === 'SUCCESS' ? (
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-500" />
                        )}
                        <span>{log.status}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
