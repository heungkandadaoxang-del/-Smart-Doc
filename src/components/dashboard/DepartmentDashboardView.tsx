import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { PeriodFilterBar, DashboardPeriod } from './PeriodFilterBar.js';
import {
  Building,
  Users,
  FileText,
  Clock,
  CheckCircle,
  Shield,
  FileCheck,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Calendar,
} from 'lucide-react';

interface DepartmentDashboardViewProps {
  onDrillDown: (criteria: any) => void;
}

export const DepartmentDashboardView: React.FC<DepartmentDashboardViewProps> = ({
  onDrillDown,
}) => {
  const { user, fetchWithAuth, language, t } = useAuth();
  const [period, setPeriod] = useState<DashboardPeriod>('quarterly');
  const [startDate, setStartDate] = useState<string>('2026-10-01');
  const [endDate, setEndDate] = useState<string>('2026-11-06');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async (
    selectedPeriod: DashboardPeriod = period,
    start: string = startDate,
    end: string = endDate
  ) => {
    setLoading(true);
    try {
      let url = `/api/dashboard/department?period=${selectedPeriod}`;
      if (selectedPeriod === 'custom' && start && end) {
        url += `&startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`;
      }
      const res = await fetchWithAuth(url);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(period, startDate, endDate);
  }, [period]);

  const handlePeriodChange = (newPeriod: DashboardPeriod) => {
    setPeriod(newPeriod);
    if (newPeriod !== 'custom') {
      loadData(newPeriod, startDate, endDate);
    }
  };

  const handleCustomRangeApply = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setPeriod('custom');
    loadData('custom', start, end);
  };

  const createDrillDownProps = (extra: any) => ({
    ...extra,
    period,
    startDate: period === 'custom' ? startDate : undefined,
    endDate: period === 'custom' ? endDate : undefined,
  });

  const dept = data?.department;
  const kpi = data?.kpi || { totalDocs: 0, inReview: 0, approved: 0, signed: 0 };
  const recentDocs = data?.recentDocs || [];
  const staff = data?.staff || [];

  return (
    <div className="space-y-6">
      {/* Department Header */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-950 rounded-2xl p-6 text-white shadow-xl border border-slate-800 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center justify-center shrink-0">
            <Building className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight">
                {language === 'lo' ? dept?.name_lo : dept?.name_en}
              </h1>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-500 text-white">
                {dept?.code}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {language === 'lo' ? 'ຫົວໜ້າພະແນກຜູ້ຮັບຜິດຊອບ:' : 'Department Head:'}{' '}
              <strong className="text-white">{dept?.designated_admin_name}</strong>
              <span className="mx-2">·</span>
              <span>{language === 'lo' ? 'ການແຍກສິດທິພະແນກເຮັດວຽກປົກກະຕິ (Isolated)' : 'Department Isolation Active'}</span>
            </p>
          </div>
        </div>

        {/* Multi-period dropdown and custom date range filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full xl:w-auto justify-end">
          <PeriodFilterBar
            currentPeriod={period}
            startDate={startDate}
            endDate={endDate}
            onPeriodChange={handlePeriodChange}
            onCustomRangeApply={handleCustomRangeApply}
          />
          <button
            onClick={() => loadData(period, startDate, endDate)}
            title="Refresh"
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 Department KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          onClick={() => onDrillDown(createDrillDownProps({ dept_id: dept?.id, label: `${dept?.code} - ທຸກເອກະສານ` }))}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-blue-400 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">{language === 'lo' ? 'ເອກະສານພະແນກ' : 'Dept Documents'}</span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">{kpi.totalDocs}</div>
        </div>

        <div
          onClick={() => onDrillDown(createDrillDownProps({ dept_id: dept?.id, workflow_status: 'IN_REVIEW', label: `${dept?.code} - ລໍຖ້າກວດສອບ` }))}
          className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-sm hover:border-amber-400 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[11px] font-semibold">{language === 'lo' ? 'ກຳລັງກວດສອບ' : 'In Review Queue'}</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-900 font-mono tabular-nums">{kpi.inReview}</div>
        </div>

        <div
          onClick={() => onDrillDown(createDrillDownProps({ dept_id: dept?.id, workflow_status: 'APPROVED', label: `${dept?.code} - ອະນຸມັດແລ້ວ` }))}
          className="bg-white p-5 rounded-2xl border border-indigo-200 bg-indigo-50/20 shadow-sm hover:border-indigo-400 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-indigo-700 mb-1">
            <span className="text-[11px] font-semibold">{language === 'lo' ? 'ອະນຸມັດແລ້ວ' : 'Approved Queue'}</span>
            <CheckCircle className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-indigo-900 font-mono tabular-nums">{kpi.approved}</div>
        </div>

        <div
          onClick={() => onDrillDown(createDrillDownProps({ dept_id: dept?.id, workflow_status: 'SIGNED', label: `${dept?.code} - ສຳເລັດ` }))}
          className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-sm hover:border-emerald-400 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-[11px] font-semibold">{language === 'lo' ? 'ເຊັນແລ້ວ/ສຳເລັດ' : 'Signed / Complete'}</span>
            <FileCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-900 font-mono tabular-nums">{kpi.signed}</div>
        </div>
      </div>

      {/* Department Staff & Recent Documents split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Documents Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>{language === 'lo' ? 'ເອກະສານເຄື່ອນໄຫວຫຼ້າສຸດຂອງພະແນກ' : 'Recent Department Documents'}</span>
            </h2>
            <button
              onClick={() => onDrillDown(createDrillDownProps({ dept_id: dept?.id, label: dept?.code }))}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1 cursor-pointer"
            >
              <span>{language === 'lo' ? 'ເບິ່ງທັງໝົດ' : 'View All'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">ເລກທີ (Reg No)</th>
                  <th className="py-2.5 px-3">ຫົວຂໍ້ (Title)</th>
                  <th className="py-2.5 px-3">ສະຖານະ (Status)</th>
                  <th className="py-2.5 px-3">ວັນທີ (Date)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentDocs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      {language === 'lo' ? 'ບໍ່ມີເອກະສານໃນຊ່ວງເວລານີ້' : 'No documents in this selected period'}
                    </td>
                  </tr>
                ) : (
                  recentDocs.map((doc: any) => (
                    <tr key={doc.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-3 font-mono font-bold text-blue-600">{doc.reg_number}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800 line-clamp-1">{doc.title}</td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {doc.workflow_status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">{doc.doc_date}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Department Staff List */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>{language === 'lo' ? 'ບຸກຄະລາກອນພະແນກ' : 'Department Staff'}</span>
            </h2>
            <span className="text-xs font-mono font-bold text-indigo-600">{staff.length}</span>
          </div>

          <div className="space-y-3">
            {staff.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                {language === 'lo' ? 'ຍັງບໍ່ມີພະນັກງານ' : 'No staff assigned yet'}
              </p>
            ) : (
              staff.map((s: any) => (
                <div key={s.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 text-xs flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs shrink-0">
                    {s.full_name_lo.substring(0, 1)}
                  </div>
                  <div className="overflow-hidden flex-1">
                    <div className="font-semibold text-slate-900 truncate">
                      {language === 'lo' ? s.full_name_lo : s.full_name_en}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {s.position_title_lo || s.email}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
