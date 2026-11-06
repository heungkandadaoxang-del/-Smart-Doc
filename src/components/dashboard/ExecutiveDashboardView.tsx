import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { PeriodFilterBar, DashboardPeriod } from './PeriodFilterBar.js';
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
import {
  FileText,
  FileInput,
  FileOutput,
  FileCheck,
  Clock,
  AlertTriangle,
  Building,
  TrendingUp,
  Shield,
  Layers,
  ArrowRight,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface ExecutiveDashboardViewProps {
  onDrillDown: (criteria: any) => void;
}

const CONFIDENTIALITY_COLORS: Record<string, string> = {
  PUBLIC: '#94a3b8',
  INTERNAL: '#3b82f6',
  CONFIDENTIAL: '#f59e0b',
  HIGHLY_CONFIDENTIAL: '#ef4444',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#94a3b8',
  NORMAL: '#3b82f6',
  URGENT: '#f59e0b',
  VERY_URGENT: '#ef4444',
};

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  onDrillDown,
}) => {
  const { fetchWithAuth, language, t } = useAuth();
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
      let url = `/api/dashboard/executive?period=${selectedPeriod}`;
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

  const kpi = data?.kpi || {
    totalDocs: 0,
    incomingDocs: 0,
    outgoingDocs: 0,
    internalDocs: 0,
    pendingApproval: 0,
    pendingSignature: 0,
    completedDocs: 0,
    overdueDocs: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header & Multi-period Filter */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              {language === 'lo' ? 'Executive KPI Dashboard (ພາບລວມຄະນະອຳນວຍການ)' : 'Executive KPI Analytics'}
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            {language === 'lo'
              ? 'ສະຖິຕິເອກະສານທັງໝົດ 5 ພະແນກຫຼັກ LHSE. ສາມາດຄລິກທີ່ກຣາຟເພື່ອເຈາະລຶກ (Drill-Down) ເຂົ້າເບິ່ງລາຍການເອກະສານ.'
              : 'Enterprise-wide metrics across 5 LHSE departments. Click any chart element to navigate into filtered records.'}
          </p>
        </div>

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
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 8 Live KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Documents */}
        <div
          onClick={() => onDrillDown(createDrillDownProps({ label: 'ທຸກເອກະສານ' }))}
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:border-blue-400 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium group-hover:text-blue-600 transition">
              {language === 'lo' ? 'ເອກະສານທັງໝົດ' : 'Total Documents'}
            </span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {kpi.totalDocs}
          </div>
        </div>

        {/* Incoming */}
        <div
          onClick={() => onDrillDown(createDrillDownProps({ doc_type: 'INCOMING', label: 'ເອກະສານຂາເຂົ້າ' }))}
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:border-blue-400 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium group-hover:text-blue-600 transition">
              {language === 'lo' ? 'ເອກະສານຂາເຂົ້າ' : 'Incoming'}
            </span>
            <FileInput className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {kpi.incomingDocs}
          </div>
        </div>

        {/* Outgoing */}
        <div
          onClick={() => onDrillDown(createDrillDownProps({ doc_type: 'OUTGOING', label: 'ເອກະສານຂາອອກ' }))}
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:border-emerald-400 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium group-hover:text-emerald-600 transition">
              {language === 'lo' ? 'ເອກະສານຂາອອກ' : 'Outgoing'}
            </span>
            <FileOutput className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {kpi.outgoingDocs}
          </div>
        </div>

        {/* Internal */}
        <div
          onClick={() => onDrillDown(createDrillDownProps({ doc_type: 'INTERNAL', label: 'ເອກະສານພາຍໃນ' }))}
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:border-purple-400 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium group-hover:text-purple-600 transition">
              {language === 'lo' ? 'ເອກະສານພາຍໃນ' : 'Internal'}
            </span>
            <Layers className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {kpi.internalDocs}
          </div>
        </div>

        {/* Pending Approval */}
        <div
          onClick={() => onDrillDown(createDrillDownProps({ workflow_status: 'IN_REVIEW', label: 'ລໍຖ້າການອະນຸມັດ' }))}
          className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-sm hover:border-amber-400 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[11px] font-medium">
              {language === 'lo' ? 'ລໍຖ້າອະນຸມັດ' : 'Pending Approval'}
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-900 font-mono tabular-nums">
            {kpi.pendingApproval}
          </div>
        </div>

        {/* Pending Signature */}
        <div
          onClick={() => onDrillDown(createDrillDownProps({ workflow_status: 'APPROVED', label: 'ລໍຖ້າລົງລາຍເຊັນ' }))}
          className="bg-white p-4 rounded-2xl border border-indigo-200 bg-indigo-50/20 shadow-sm hover:border-indigo-400 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-indigo-700 mb-1">
            <span className="text-[11px] font-medium">
              {language === 'lo' ? 'ລໍຖ້າລົງລາຍເຊັນ' : 'Pending Signature'}
            </span>
            <Shield className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-indigo-900 font-mono tabular-nums">
            {kpi.pendingSignature}
          </div>
        </div>

        {/* Completed */}
        <div
          onClick={() => onDrillDown(createDrillDownProps({ workflow_status: 'COMPLETED', label: 'ສຳເລັດສົມບູນ' }))}
          className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-sm hover:border-emerald-400 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-[11px] font-medium">
              {language === 'lo' ? 'ສຳເລັດສົມບູນ' : 'Completed'}
            </span>
            <FileCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-900 font-mono tabular-nums">
            {kpi.completedDocs}
          </div>
        </div>

        {/* Overdue */}
        <div
          onClick={() => onDrillDown(createDrillDownProps({ label: 'ກາຍກຳນົດເວລາ' }))}
          className="bg-white p-4 rounded-2xl border border-red-200 bg-red-50/20 shadow-sm hover:border-red-400 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-red-700 mb-1">
            <span className="text-[11px] font-medium">
              {language === 'lo' ? 'ກາຍກຳນົດ' : 'Overdue'}
            </span>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-900 font-mono tabular-nums">
            {kpi.overdueDocs}
          </div>
        </div>
      </div>


      {/* Row 1 Charts: Bar Chart (Throughput by Department) & Line Chart (Velocity Trend) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Bar Chart: Department Volume */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <span>{language === 'lo' ? 'ປະລິມານເອກະສານແຕ່ລະພະແນກ (Bar Chart)' : 'Volume by Department'}</span>
              </h2>
              <span className="text-[11px] text-slate-400">
                {language === 'lo' ? 'ຄລິກທີ່ແທ່ງເພື່ອກັ່ນຕອງເອກະສານ' : 'Click a bar to filter records'}
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
              5 Depts
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.charts?.deptVolume || []}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload[0]) {
                    const row = e.activePayload[0].payload;
                    onDrillDown(createDrillDownProps({ dept_code: row.code, label: `${row.code} - ${row.name_lo}` }));
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="code" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val: any, name: any) => [val, name]}
                  contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="incoming" name="ຂາເຂົ້າ (In)" fill="#3b82f6" radius={[4, 4, 0, 0]} cursor="pointer" />
                <Bar dataKey="outgoing" name="ຂາອອກ (Out)" fill="#10b981" radius={[4, 4, 0, 0]} cursor="pointer" />
                <Bar dataKey="internal" name="ພາຍໃນ (Int)" fill="#8b5cf6" radius={[4, 4, 0, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Line Chart: Velocity Trend */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {language === 'lo' ? 'ທ່າອ່ຽງການລົງທະບຽນ & ອະນຸມັດ (Line Chart)' : 'Registration & Approval Velocity'}
              </h2>
              <span className="text-[11px] text-slate-400">
                {language === 'lo' ? 'ຈຳນວນເອກະສານທີ່ສ້າງ ທຽບກັບ ທີ່ອະນຸມັດສຳເລັດ' : 'Registered vs. Approved trend'}
              </span>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data?.charts?.velocityTrend || []}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload[0]) {
                    const row = e.activePayload[0].payload;
                    onDrillDown(createDrillDownProps({ label: `ວັນທີ ${row.date_label}` }));
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date_label" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line
                  type="monotone"
                  dataKey="total_registered"
                  name="ລົງທະບຽນ (Registered)"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#2563eb' }}
                  activeDot={{ r: 6 }}
                  cursor="pointer"
                />
                <Line
                  type="monotone"
                  dataKey="approved_count"
                  name="ອະນຸມັດແລ້ວ (Approved)"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#10b981' }}
                  activeDot={{ r: 6 }}
                  cursor="pointer"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2 Charts: Donut Pie Charts & Stacked Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3. Donut Pie Chart: Confidentiality Distribution */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="pb-3 border-b border-slate-100 mb-4">
            <h2 className="text-sm font-bold text-slate-900">
              {language === 'lo' ? 'ການແຈກຢາຍຊັ້ນຄວາມລັບ (Pie / Donut)' : 'Confidentiality Levels'}
            </h2>
            <span className="text-[11px] text-slate-400">
              {language === 'lo' ? 'Public, Internal, Confidential, Highly Confidential' : 'Distribution by security classification'}
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.charts?.confidentiality || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="count"
                  nameKey="confidentiality"
                  cursor="pointer"
                  onClick={(entry: any) => {
                    onDrillDown(createDrillDownProps({
                      confidentiality: entry.confidentiality,
                      label: `ຊັ້ນຄວາມລັບ ${entry.confidentiality}`,
                    }));
                  }}
                >
                  {(data?.charts?.confidentiality || []).map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CONFIDENTIALITY_COLORS[entry.confidentiality] || '#3b82f6'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Donut Pie Chart: Priority Distribution */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="pb-3 border-b border-slate-100 mb-4">
            <h2 className="text-sm font-bold text-slate-900">
              {language === 'lo' ? 'ລະດັບຄວາມຮີບດ່ວນ (Priority Pie)' : 'Priority Distribution'}
            </h2>
            <span className="text-[11px] text-slate-400">
              {language === 'lo' ? 'Normal, Urgent, Very Urgent' : 'Document urgency classification'}
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.charts?.priority || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="count"
                  nameKey="priority"
                  cursor="pointer"
                  onClick={(entry: any) => {
                    onDrillDown(createDrillDownProps({
                      priority: entry.priority,
                      label: `ຄວາມຮີບດ່ວນ ${entry.priority}`,
                    }));
                  }}
                >
                  {(data?.charts?.priority || []).map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PRIORITY_COLORS[entry.priority] || '#3b82f6'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5. Stacked Bar Chart: Status Pipeline per Department */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="pb-3 border-b border-slate-100 mb-4">
            <h2 className="text-sm font-bold text-slate-900">
              {language === 'lo' ? 'ສະຖານະຂັ້ນຕອນ (Stacked Bar)' : 'Status Pipeline per Dept'}
            </h2>
            <span className="text-[11px] text-slate-400">
              {language === 'lo' ? 'Registered, Review, Approved, Completed' : 'Workflow distribution per department'}
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.charts?.deptStatus || []}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload[0]) {
                    const row = e.activePayload[0].payload;
                    onDrillDown(createDrillDownProps({ dept_code: row.code, label: `ສະຖານະ ${row.code}` }));
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="code" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="in_review" name="ກວດສອບ" stackId="a" fill="#f59e0b" cursor="pointer" />
                <Bar dataKey="approved" name="ອະນຸມັດ" stackId="a" fill="#3b82f6" cursor="pointer" />
                <Bar dataKey="completed" name="ສຳເລັດ" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
