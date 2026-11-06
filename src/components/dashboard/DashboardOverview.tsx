import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import {
  FileText,
  FileInput,
  FileOutput,
  FileCheck,
  Clock,
  CheckCircle,
  Building,
  Users,
  ShieldCheck,
  TrendingUp,
  Activity,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user, fetchWithAuth, language, t } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    try {
      const res = await fetchWithAuth('/api/dashboard/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <span>{language === 'lo' ? 'ລະບົບ E-Doc ໄລຍະ 1 (Phase 1 Baseline)' : 'LHSE E-Doc Phase 1 Baseline'}</span>
              <span>•</span>
              <span>{language === 'lo' ? 'ເຂດເວລາ ວຽງຈັນ (UTC+7)' : 'Asia/Vientiane (UTC+7)'}</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              {language === 'lo'
                ? `ຍິນດີຕ້ອນຮັບ, ${user?.full_name_lo}`
                : `Welcome, ${user?.full_name_en || user?.full_name_lo}`}
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              {language === 'lo'
                ? `ທ່ານເຂົ້າສູ່ລະບົບໃນຖານະ: ${user?.roles.join(', ')} ປະຈຳ ${user?.dept_name_lo || 'ສຳນັກງານໃຫຍ່ LHSE'}. ລະບົບມີການແຍກສິດທິລະຫວ່າງພະແນກ ແລະ ບັນທຶກ Audit Trail ຢ່າງເຄັ່ງຄັດ.`
                : `Role: ${user?.roles.join(', ')} | Department: ${user?.dept_name_en || 'LHSE Central'}. Department isolation and audit integrity are strictly enforced.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigate('executive-dashboard')}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow flex items-center space-x-2 cursor-pointer"
            >
              <TrendingUp className="w-4 h-4" />
              <span>{language === 'lo' ? 'ເປີດ Executive Dashboard' : 'Executive Dashboard'}</span>
            </button>
            <button
              onClick={() => onNavigate('org-tree')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition flex items-center space-x-2 cursor-pointer"
            >
              <Layers className="w-4 h-4 text-blue-400" />
              <span>{language === 'lo' ? 'ໂຄງຮ່າງ 3 ຂັ້ນ' : '3-Tier Structure'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Cards (Live from D1 Database) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block mb-0.5">
              {language === 'lo' ? 'ຜູ້ໃຊ້ງານໃນລະບົບ' : 'Active Users'}
            </span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {stats?.totalUsers || 1}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block mb-0.5">
              {language === 'lo' ? 'ຈຳນວນພະແນກ LHSE' : 'LHSE Departments'}
            </span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {stats?.totalDepts || 5}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block mb-0.5">
              {language === 'lo' ? 'ບັນທຶກຄວາມປອດໄພ' : 'Audit Logs'}
            </span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {stats?.totalAuditEvents || 0}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block mb-0.5">
              {language === 'lo' ? 'ເອກະສານທັງໝົດ (Phase 3)' : 'Total Documents'}
            </span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {stats?.totalDocs || 0}
            </div>
          </div>
        </div>
      </div>

      {/* 5 Department Structure & Quick Action Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center space-x-2">
              <Building className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">
                {language === 'lo' ? '5 ພະແນກຫຼັກ ແລະ ຜູ້ຄຸ້ມຄອງ LHSE' : '5 Core Departments & Admins'}
              </h2>
            </div>
            <button
              onClick={() => onNavigate('departments')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1"
            >
              <span>{language === 'lo' ? 'ເບິ່ງລາຍລະອຽດ' : 'View All'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {stats?.deptDistribution?.map((d: any) => (
              <div
                key={d.code}
                className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs hover:border-slate-300 transition"
              >
                <div className="flex items-center space-x-3">
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-900 text-white">
                    {d.code}
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900 block">
                      {language === 'lo' ? d.name_lo : d.name_en}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-4 text-slate-500 font-mono text-[11px]">
                  <span>{d.user_count} ພະນັກງານ</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Phase Roadmap Progress */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 mb-4">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">
                {language === 'lo' ? 'ແຜນງານ 7 ໄລຍະ (LHSE Roadmap)' : 'Development Phases'}
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between font-medium">
                <div>
                  <strong className="block">Phase 1: Auth & User Management</strong>
                  <span className="text-[10px] text-emerald-700">D1 DB, RBAC, 5 Dept Admins, Isolation</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                  Active / Passed
                </span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between font-medium">
                <div>
                  <strong className="block">Phase 2: Org Structure & KPI Dashboards</strong>
                  <span className="text-[10px] text-emerald-700">3-Tier Hierarchy, Recharts & Drill-down</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                  Active / Passed
                </span>
              </div>

              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 flex items-center justify-between">
                <div>
                  <span className="font-semibold block">Phase 3: Document Registration & Storage</span>
                  <span className="text-[10px] text-slate-400">Cloudflare R2 private file storage</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Upcoming</span>
              </div>

              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 flex items-center justify-between">
                <div>
                  <span className="font-semibold block">Phase 4-7: Workflow, QR, Sign & Reports</span>
                  <span className="text-[10px] text-slate-400">Approval chain & mobile scanner</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Planned</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
