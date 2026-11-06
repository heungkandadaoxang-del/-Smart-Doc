import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { PeriodFilterBar, DashboardPeriod } from '../dashboard/PeriodFilterBar.js';
import {
  FileBarChart,
  Download,
  Calendar,
  Building,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Printer,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { alertService } from '../../services/swal.js';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94a3b8',
  REGISTERED: '#38bdf8',
  IN_REVIEW: '#f59e0b',
  APPROVED: '#3b82f6',
  SIGNED: '#10b981',
  COMPLETED: '#059669',
  ARCHIVED: '#64748b',
  REJECTED: '#ef4444',
};

export const ReportsAnalyticsView: React.FC = () => {
  const { user, fetchWithAuth, language } = useAuth();
  const [period, setPeriod] = useState<DashboardPeriod>('quarterly');
  const [startDate, setStartDate] = useState('2026-10-01');
  const [endDate, setEndDate] = useState('2026-11-06');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadReportData = async (
    selectedPeriod: DashboardPeriod = period,
    start: string = startDate,
    end: string = endDate
  ) => {
    setLoading(true);
    try {
      let url = `/api/reports/summary?period=${selectedPeriod}`;
      if (selectedPeriod === 'custom' && start && end) {
        url += `&startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`;
      }
      const res = await fetchWithAuth(url);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData(period, startDate, endDate);
  }, [period]);

  const handleCustomRangeApply = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setPeriod('custom');
    loadReportData('custom', start, end);
  };

  const handleExportCsv = () => {
    alertService.toast('info', language === 'lo' ? 'ກຳລັງດາວໂຫຼດໄຟລ໌ CSV...' : 'Generating CSV export...');
    const url = `/api/reports/export?format=csv&period=${period}&startDate=${startDate}&endDate=${endDate}`;
    window.location.href = url;
  };

  const handlePrint = () => {
    window.print();
  };

  const kpi = data?.kpi || {
    total: 0,
    incoming: 0,
    outgoing: 0,
    internal: 0,
    completed: 0,
    pending: 0,
    overdue: 0,
    completionRate: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <FileBarChart className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {language === 'lo'
                ? 'ລາຍງານ ແລະ ການວິເຄາະສະຖິຕິ (Reports & Analytics)'
                : 'Enterprise Reports & Analytics'}
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            {language === 'lo'
              ? 'ສະຖິຕິປຽບທຽບ 5 ພະແນກ, ອັດຕາການອະນຸມັດ, ປະສິດທິພາບການເຮັດວຽກ, ແລະ ສົ່ງອອກເປັນ CSV/Excel.'
              : 'Multi-department comparison, throughput velocity, SLA tracking, and official CSV exports.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-end">
          <PeriodFilterBar
            currentPeriod={period}
            startDate={startDate}
            endDate={endDate}
            onPeriodChange={setPeriod}
            onCustomRangeApply={handleCustomRangeApply}
          />

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{language === 'lo' ? 'ສົ່ງອອກ CSV' : 'Export CSV'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            title="Print"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => loadReportData(period, startDate, endDate)}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 Primary KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">{language === 'lo' ? 'ເອກະສານທັງໝົດ' : 'Total Documents'}</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">{kpi.total}</div>
          <div className="text-[10px] text-slate-400 mt-1">
            {kpi.incoming} In • {kpi.outgoing} Out • {kpi.internal} Int
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-[11px] font-semibold">{language === 'lo' ? 'ອັດຕາສຳເລັດ' : 'Completion Rate'}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-900 font-mono">{kpi.completionRate}%</div>
          <div className="text-[10px] text-emerald-700 mt-1">
            {kpi.completed} {language === 'lo' ? 'ສະບັບສຳເລັດແລ້ວ' : 'completed documents'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[11px] font-semibold">{language === 'lo' ? 'ກຳລັງດຳເນີນການ' : 'In Progress Queue'}</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-900 font-mono">{kpi.pending}</div>
          <div className="text-[10px] text-amber-700 mt-1">
            {language === 'lo' ? 'ລໍຖ້າກວດສອບ / ອະນຸມັດ' : 'In review / approval'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-red-200 bg-red-50/20 shadow-xs">
          <div className="flex items-center justify-between text-red-700 mb-1">
            <span className="text-[11px] font-semibold">{language === 'lo' ? 'ກາຍກຳນົດເວລາ' : 'Overdue SLA'}</span>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-900 font-mono">{kpi.overdue}</div>
          <div className="text-[10px] text-red-600 mt-1">
            {language === 'lo' ? 'ກາຍ 14 ວັນທີ່ກຳນົດ' : 'Exceeding 14-day SLA'}
          </div>
        </div>
      </div>

      {/* Row 2: Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Comparison Bar Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="pb-3 border-b border-slate-100 mb-4">
            <h2 className="text-sm font-bold text-slate-900">
              {language === 'lo' ? 'ປຽບທຽບປະລິມານເອກະສານ 5 ພະແນກ (Department Comparison)' : 'Volume by Department'}
            </h2>
            <span className="text-[11px] text-slate-400">
              {language === 'lo' ? 'ຂາເຂົ້າ (Incoming), ຂາອອກ (Outgoing), ພາຍໃນ (Internal)' : 'Throughput breakdown by department'}
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.departmentComparison || []}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="code" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="incoming_docs" name="ຂາເຂົ້າ (In)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outgoing_docs" name="ຂາອອກ (Out)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="internal_docs" name="ພາຍໃນ (Int)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Workflow Status Distribution Donut */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="pb-3 border-b border-slate-100 mb-4">
            <h2 className="text-sm font-bold text-slate-900">
              {language === 'lo' ? 'ການແຈກຢາຍສະຖານະເອກະສານ (Status Pipeline Distribution)' : 'Workflow Pipeline'}
            </h2>
            <span className="text-[11px] text-slate-400">
              {language === 'lo' ? 'Registered, In Review, Approved, Signed, Completed' : 'Distribution across workflow statuses'}
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.statusBreakdown || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="count"
                  nameKey="workflow_status"
                >
                  {(data?.statusBreakdown || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.workflow_status] || '#3b82f6'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Department Comparison Data Table */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 mb-4">
          {language === 'lo' ? 'ຕາຕະລາງລາຍລະອຽດປະສິດທິພາບແຕ່ລະພະແນກ (Department Ledger)' : 'Department Performance Ledger'}
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <th className="py-2.5 px-3">ລະຫັດພະແນກ</th>
                <th className="py-2.5 px-3">ຊື່ພະແນກ (Department Name)</th>
                <th className="py-2.5 px-3 text-center">ເອກະສານທັງໝົດ</th>
                <th className="py-2.5 px-3 text-center">ຂາເຂົ້າ</th>
                <th className="py-2.5 px-3 text-center">ຂາອອກ</th>
                <th className="py-2.5 px-3 text-center">ພາຍໃນ</th>
                <th className="py-2.5 px-3 text-center">ສຳເລັດ</th>
                <th className="py-2.5 px-3 text-center">ກາຍກຳນົດ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {(data?.departmentComparison || []).map((dept: any) => (
                <tr key={dept.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-3 font-bold text-blue-600">{dept.code}</td>
                  <td className="py-3 px-3 font-sans font-semibold text-slate-800">{dept.name_lo}</td>
                  <td className="py-3 px-3 text-center font-bold text-slate-900">{dept.total_docs}</td>
                  <td className="py-3 px-3 text-center text-blue-600">{dept.incoming_docs}</td>
                  <td className="py-3 px-3 text-center text-emerald-600">{dept.outgoing_docs}</td>
                  <td className="py-3 px-3 text-center text-purple-600">{dept.internal_docs}</td>
                  <td className="py-3 px-3 text-center font-bold text-emerald-700">{dept.completed_docs}</td>
                  <td className="py-3 px-3 text-center font-bold text-red-600">{dept.overdue_docs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
