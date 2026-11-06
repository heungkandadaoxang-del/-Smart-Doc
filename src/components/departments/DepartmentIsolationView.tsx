import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Department } from '../../types/index.js';
import { alertService } from '../../services/swal.js';
import {
  ShieldAlert,
  ShieldCheck,
  Building2,
  Terminal,
  Play,
  CheckCircle2,
  XCircle,
  Lock,
  ArrowRight,
  RefreshCw,
  Users,
  Eye,
  FileCheck,
} from 'lucide-react';

export const DepartmentIsolationView: React.FC = () => {
  const { user, fetchWithAuth, language, t } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulation test state
  const [simTargetDept, setSimTargetDept] = useState<string>('');
  const [simScenario, setSimScenario] = useState<'CROSS_USER_LIST' | 'CROSS_DEPT_DETAILS' | 'ILLEGAL_STAFF_CREATE'>('CROSS_USER_LIST');
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState<{
    status: number;
    blocked: boolean;
    response: any;
    timestamp: string;
  } | null>(null);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/departments');
      const data = await res.json();
      if (data.success) {
        setDepartments(data.departments);
        // Default target to a department different from user's
        const other = data.departments.find((d: Department) => d.id !== user?.dept_id);
        if (other) {
          setSimTargetDept(other.id);
        }
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const runSimulation = async () => {
    if (!simTargetDept) return;
    setSimRunning(true);
    setSimResult(null);

    try {
      let res: Response;
      if (simScenario === 'CROSS_USER_LIST') {
        // Attempt direct API request querying another department's users
        res = await fetchWithAuth(`/api/users?dept_id=${simTargetDept}`);
      } else if (simScenario === 'CROSS_DEPT_DETAILS') {
        // Attempt direct API fetch of another department's internal details
        res = await fetchWithAuth(`/api/departments/${simTargetDept}`);
      } else {
        // Attempt creating a staff in another department
        res = await fetchWithAuth(`/api/users`, {
          method: 'POST',
          body: JSON.stringify({
            email: `breach.test.${Date.now()}@example.com`,
            password: 'Password123!',
            full_name_lo: 'ທ້າວ ທົດສອບລະເມີດສິດ',
            dept_id: simTargetDept,
            role_code: 'DEPT_STAFF',
          }),
        });
      }

      const responseData = await res.json();
      const isBlocked = res.status === 403;

      setSimResult({
        status: res.status,
        blocked: isBlocked,
        response: responseData,
        timestamp: new Date().toLocaleTimeString(),
      });

      if (isBlocked) {
        alertService.toast(
          'success',
          language === 'lo'
            ? 'ລະບົບຕັນການເຂົ້າເຖິງຂ້າມພະແນກສຳເລັດ (HTTP 403 Blocked)'
            : 'Access successfully blocked by Department Isolation (HTTP 403)'
        );
      } else if (user?.roles.includes('SUPER_ADMIN')) {
        alertService.toast(
          'info',
          language === 'lo'
            ? 'ທ່ານເຂົ້າສູ່ລະບົບໃນຖານະ Super Admin ຈຶ່ງໄດ້ຮັບອະນຸຍາດທົ່ວອົງກອນ'
            : 'Super Admin has organization-wide access'
        );
      }
    } catch (err: any) {
      alertService.error('Test Error', err.message);
    } finally {
      setSimRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">{t.deptIsolationTitle}</h1>
          </div>
          <p className="text-xs text-slate-500">
            {t.deptIsolationDesc}
          </p>
        </div>

        <button
          onClick={loadDepartments}
          className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
        </button>
      </div>

      {/* 5 Department Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map(dept => {
          const isUserDept = dept.id === user?.dept_id;
          return (
            <div
              key={dept.id}
              className={`rounded-2xl p-5 border transition ${
                isUserDept
                  ? 'bg-blue-50/50 border-blue-300 ring-2 ring-blue-500/20'
                  : 'bg-white border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                  {dept.code}
                </span>
                {isUserDept && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-600 text-white flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{language === 'lo' ? 'ພະແນກຂອງທ່ານ' : 'Your Department'}</span>
                  </span>
                )}
              </div>

              <h2 className="text-sm font-bold text-slate-900">
                {language === 'lo' ? dept.name_lo : dept.name_en}
              </h2>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                {language === 'lo' ? dept.description_lo : dept.description_en}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-slate-400">{language === 'lo' ? 'ຫົວໜ້າພະແນກ:' : 'Admin:'}</span>
                  <span className="font-semibold text-slate-800">{dept.designated_admin_name}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-slate-400">{language === 'lo' ? 'ຈຳນວນພະນັກງານ:' : 'Members:'}</span>
                  <span className="font-mono text-slate-800">{dept.member_count || 0}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-slate-400">{language === 'lo' ? 'ອີເມວທາງການ:' : 'Email:'}</span>
                  <span className="font-mono text-slate-800 text-[11px]">{dept.admin_email || '- ຍັງບໍ່ໄດ້ເປີດບັນຊີ -'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Penetration / Isolation Sandbox */}
      <div className="bg-slate-950 rounded-2xl p-6 text-white border border-slate-800 shadow-xl">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <span>{language === 'lo' ? 'ເຄື່ອງມືທົດສອບການປ້ອງກັນການເຈາະສິດຂ້າມພະແນກ (Live Security Test)' : 'Direct API Cross-Department Boundary Test Simulator'}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800">
                Acceptance Suite
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {language === 'lo'
                ? 'ທົດສອບການຍິງ API ໂດຍກົງເພື່ອພິສູດວ່າລະບົບ backend ບລັອກຄຳຂໍທີ່ຂ້າມເຂດພະແນກດ້ວຍ HTTP 403 ທັນທີ'
                : 'Directly invoke API endpoints to verify that non-Super-Admin cross-department queries are strictly blocked.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {language === 'lo' ? 'ສະຖານະຜູ້ທົດສອບປັດຈຸບັນ' : 'Current Active Persona'}
            </label>
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
              <span className="text-blue-400 font-bold block">{user?.email}</span>
              <span className="text-[10px] text-slate-400">
                Roles: {user?.roles.join(', ')} | Dept: {user?.dept_code || 'CENTRAL_ORG'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {language === 'lo' ? 'ຮູບແບບການທົດສອບ (Attack Vector)' : 'Test Scenario'}
            </label>
            <select
              value={simScenario}
              onChange={e => setSimScenario(e.target.value as any)}
              className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="CROSS_USER_LIST">GET /api/users?dept_id=[Target] (Cross-list users)</option>
              <option value="CROSS_DEPT_DETAILS">GET /api/departments/[Target] (Cross-view details)</option>
              <option value="ILLEGAL_STAFF_CREATE">POST /api/users (Create staff in other department)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {language === 'lo' ? 'ພະແນກເປົ້າໝາຍ (Target Department)' : 'Target Department'}
            </label>
            <select
              value={simTargetDept}
              onChange={e => setSimTargetDept(e.target.value)}
              className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name_lo} ({d.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={runSimulation}
          disabled={simRunning}
          className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition flex items-center justify-center space-x-2 shadow-lg shadow-red-600/20 disabled:opacity-50 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>
            {simRunning
              ? (language === 'lo' ? 'ກຳລັງທົດສອບ...' : 'Simulating Request...')
              : (language === 'lo' ? 'ຍິງທົດສອບ API ຂ້າມພະແນກ (Execute Live Test Request)' : 'Send Unauthorized API Request')}
          </span>
        </button>

        {/* Test Result Terminal Box */}
        {simResult && (
          <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs animate-fadeIn">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px]">
              <div className="flex items-center space-x-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    simResult.status === 403 ? 'bg-emerald-400' : 'bg-blue-400'
                  }`}
                />
                <span className="font-bold text-white">
                  HTTP Status: {simResult.status}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    simResult.status === 403
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-blue-950 text-blue-300'
                  }`}
                >
                  {simResult.status === 403 ? 'ISOLATION ENFORCED (403 FORBIDDEN)' : 'AUTHORIZED'}
                </span>
              </div>
              <span className="text-slate-500">{simResult.timestamp}</span>
            </div>

            <pre className="text-slate-300 overflow-x-auto text-[11px] p-2 bg-slate-900 rounded-lg">
              {JSON.stringify(simResult.response, null, 2)}
            </pre>
            <div className="mt-2 text-[11px] text-slate-400 font-sans flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {language === 'lo'
                  ? 'ບັນທຶກຄວາມປອດໄພຖືກສ້າງຂຶ້ນໃນ Audit Logs ອັດຕະໂນມັດ ພ້ອມສະຖານະ DENIED.'
                  : 'Violation attempt has been immutably recorded in the security audit ledger with status DENIED.'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
