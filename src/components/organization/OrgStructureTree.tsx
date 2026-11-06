import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Department, Position } from '../../types/index.js';
import {
  Building2,
  Users,
  ChevronDown,
  ChevronRight,
  Shield,
  Layers,
  Award,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export const OrgStructureTree: React.FC = () => {
  const { fetchWithAuth, language } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [deptsRes, posRes] = await Promise.all([
        fetchWithAuth('/api/departments'),
        fetchWithAuth('/api/positions'),
      ]);
      const deptsData = await deptsRes.json();
      const posData = await posRes.json();

      if (deptsData.success) {
        setDepartments(deptsData.departments);
        if (deptsData.departments.length > 0) {
          setSelectedDeptId(deptsData.departments[0].id);
        }
      }
      if (posData.success) {
        setPositions(posData.positions);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const executivePositions = positions.filter(p => !p.dept_id);
  const selectedDeptPositions = positions.filter(p => p.dept_id === selectedDeptId);
  const selectedDept = departments.find(d => d.id === selectedDeptId);

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <Layers className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              {language === 'lo' ? 'ໂຄງຮ່າງການຈັດຕັ້ງ 3 ຂັ້ນ (Three-Tier Hierarchy)' : 'Three-Tier Organizational Structure'}
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            {language === 'lo'
              ? 'Tier 1: ຄະນະອຳນວຍການໃຫຍ່ → Tier 2: 5 ພະແນກຫຼັກ LHSE → Tier 3: ຕຳແໜ່ງງານ ແລະ ໂຄຕ້າບຸກຄະລາກອນ'
              : 'Tier 1: Executive Directorate → Tier 2: 5 Core LHSE Departments → Tier 3: Departmental Positions & Headcount Quotas'}
          </p>
        </div>

        <div className="text-xs font-mono text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
          {positions.length} ຕຳແໜ່ງງານທົ່ວອົງກອນ
        </div>
      </div>

      {/* Tier 1: Executive Directorate Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-lg border border-slate-800">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-400/30 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-400">
                Tier 1 • Top Governance
              </span>
              <h2 className="text-base font-bold text-white">
                {language === 'lo' ? 'ຄະນະອຳນວຍການ ລັດວິສາຫະກິດຖືຮຸ້ນລາວ (Executive Directorate)' : 'LHSE Executive Directorate'}
              </h2>
            </div>
          </div>
          <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
            Level 1 - 2
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {executivePositions.map(pos => (
            <div key={pos.id} className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="font-mono text-[10px] text-blue-300 font-bold">{pos.code}</span>
                <span className="text-[10px] font-mono">Level {pos.level}</span>
              </div>
              <h3 className="font-semibold text-slate-100 text-xs">{pos.title_lo}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">{pos.title_en}</p>
              <div className="mt-2 pt-2 border-t border-slate-700 text-[10px] text-slate-400 flex justify-between">
                <span>{language === 'lo' ? 'ກຳນົດ:' : 'Quota:'} {pos.max_headcount} ທ່ານ</span>
                <span className="text-emerald-400 font-medium">ດຳລົງຕຳແໜ່ງ: {pos.assigned_user_count || 1}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Down Connector */}
      <div className="flex justify-center">
        <div className="h-6 w-0.5 bg-slate-300" />
      </div>

      {/* Tier 2: 5 Core LHSE Departments Selector Strip */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <div className="pb-3 border-b border-slate-100 mb-4">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-600 block mb-0.5">
            Tier 2 • Operational Units
          </span>
          <h2 className="text-base font-bold text-slate-900">
            {language === 'lo' ? '5 ພະແນກຫຼັກ ລັດວິສາຫະກິດຖືຮຸ້ນລາວ (5 Core Departments)' : '5 Core LHSE Departments'}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {departments.map(d => {
            const isSelected = selectedDeptId === d.id;
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDeptId(d.id)}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {d.code}
                  </span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                </div>

                <h3 className="font-semibold text-slate-900 text-xs line-clamp-2">
                  {language === 'lo' ? d.name_lo : d.name_en}
                </h3>
                <div className="mt-2 text-[10px] text-slate-500">
                  <span>ຫົວໜ້າ: </span>
                  <strong className="text-slate-700">{d.designated_admin_name}</strong>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Down Connector */}
      <div className="flex justify-center">
        <div className="h-6 w-0.5 bg-slate-300" />
      </div>

      {/* Tier 3: Positions within Selected Department */}
      {selectedDept && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-600 block mb-0.5">
                Tier 3 • Departmental Positions & Headcounts
              </span>
              <h2 className="text-base font-bold text-slate-900">
                ຕຳແໜ່ງງານພາຍໃນ: {selectedDept.name_lo} ({selectedDept.code})
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-600">
              {selectedDeptPositions.length} ຕຳແໜ່ງ
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {selectedDeptPositions.map(pos => (
              <div key={pos.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 text-xs hover:border-slate-300 transition">
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                  <span className="font-mono text-[10px] font-bold text-blue-600">{pos.code}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                    Level {pos.level}
                  </span>
                </div>

                <h3 className="font-semibold text-slate-900 text-xs mb-0.5">{pos.title_lo}</h3>
                <p className="text-[10px] text-slate-500 mb-3">{pos.title_en}</p>

                <div className="pt-2 border-t border-slate-200/70 text-[11px] flex justify-between items-center text-slate-600">
                  <span>{language === 'lo' ? 'ໂຄຕ້າພະນັກງານ:' : 'Headcount Quota:'}</span>
                  <span className="font-mono font-bold text-slate-900">{pos.max_headcount} ທ່ານ</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
