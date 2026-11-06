import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Position, Department } from '../../types/index.js';
import { alertService } from '../../services/swal.js';
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Building,
  CheckCircle,
  RefreshCw,
  Users,
} from 'lucide-react';

export const PositionsManagement: React.FC = () => {
  const { user, fetchWithAuth, language, t } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [form, setForm] = useState({
    code: '',
    title_lo: '',
    title_en: '',
    dept_id: '',
    level: 5,
    max_headcount: 1,
    description_lo: '',
    description_en: '',
  });

  const isSuperAdmin = user?.roles.includes('SUPER_ADMIN');

  const loadData = async () => {
    setLoading(true);
    try {
      const [posRes, deptsRes] = await Promise.all([
        fetchWithAuth(`/api/positions?dept_id=${deptFilter}`),
        fetchWithAuth('/api/departments'),
      ]);
      const posData = await posRes.json();
      const deptsData = await deptsRes.json();

      if (posData.success) {
        setPositions(posData.positions);
      }
      if (deptsData.success) {
        setDepartments(deptsData.departments);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [deptFilter]);

  const handleOpenCreate = () => {
    setEditingPos(null);
    setForm({
      code: '',
      title_lo: '',
      title_en: '',
      dept_id: '',
      level: 5,
      max_headcount: 2,
      description_lo: '',
      description_en: '',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (pos: Position) => {
    setEditingPos(pos);
    setForm({
      code: pos.code,
      title_lo: pos.title_lo,
      title_en: pos.title_en,
      dept_id: pos.dept_id || '',
      level: pos.level,
      max_headcount: pos.max_headcount,
      description_lo: pos.description_lo || '',
      description_en: pos.description_en || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      alertService.loading(language === 'lo' ? 'ກຳລັງບັນທຶກ...' : 'Saving...');
      const url = editingPos ? `/api/positions/${editingPos.id}` : '/api/positions';
      const method = editingPos ? 'PUT' : 'POST';

      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(form),
      });
      const data = await res.json();
      alertService.close();

      if (data.success) {
        await alertService.success(language === 'lo' ? 'ສຳເລັດ' : 'Success', data.message);
        setShowModal(false);
        loadData();
      } else {
        alertService.error('Error', data.message);
      }
    } catch (err: any) {
      alertService.close();
      alertService.error('Error', err.message);
    }
  };

  const handleDelete = async (pos: Position) => {
    const confirm = await alertService.confirm(
      language === 'lo' ? 'ປິດການໃຊ້ງານຕຳແໜ່ງ' : 'Deactivate Position',
      language === 'lo' ? `ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການປິດການໃຊ້ງານຕຳແໜ່ງ "${pos.title_lo}"?` : `Deactivate position ${pos.code}?`,
      language === 'lo' ? 'ປິດການໃຊ້ງານ' : 'Deactivate',
      language === 'lo' ? 'ຍົກເລີກ' : 'Cancel',
      true
    );

    if (confirm.isConfirmed) {
      try {
        alertService.loading('Processing...');
        const res = await fetchWithAuth(`/api/positions/${pos.id}`, { method: 'DELETE' });
        const data = await res.json();
        alertService.close();

        if (data.success) {
          alertService.toast('success', data.message);
          loadData();
        } else {
          alertService.error('Error', data.message);
        }
      } catch (err: any) {
        alertService.close();
        alertService.error('Error', err.message);
      }
    }
  };

  const filtered = positions.filter(p =>
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    p.title_lo.toLowerCase().includes(search.toLowerCase()) ||
    p.title_en.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <Briefcase className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              {language === 'lo' ? 'ຈັດການຕຳແໜ່ງງານ (Positions & Job Descriptions)' : 'Positions & Authority Management'}
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            {language === 'lo'
              ? 'ກຳນົດລະດັບສາຍບັງຄັບບັນຊາ (Level 1-6), ໂຄຕ້າຈຳນວນພະນັກງານ ແລະ ລາຍລະອຽດໜ້າທີ່ຮັບຜິດຊອບ'
              : 'Configure reporting authority levels (1-6), headcount quotas, and departmental bindings.'}
          </p>
        </div>

        {isSuperAdmin && (
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm flex items-center space-x-2 transition"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'lo' ? 'ເພີ່ມຕຳແໜ່ງງານໃໝ່' : 'Create Position'}</span>
          </button>
        )}
      </div>

      {/* Filter and Search */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={language === 'lo' ? 'ຄົ້ນຫາລະຫັດ ຫຼື ຊື່ຕຳແໜ່ງ...' : 'Search position...'}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">{language === 'lo' ? 'ທຸກພະແນກ & ຄະນະອຳນວຍການ' : 'All Departments & Executive'}</option>
            <option value="EXECUTIVE">{language === 'lo' ? 'ສະເພາະຄະນະອຳນວຍການ (Tier 1)' : 'Executive Directorate Only'}</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>
                {d.name_lo} ({d.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Positions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">ລະຫັດ (Code)</th>
                <th className="py-3 px-4">ຊື່ຕຳແໜ່ງງານ (Title)</th>
                <th className="py-3 px-4">ສັງກັດ (Department)</th>
                <th className="py-3 px-4">ລະດັບ (Level)</th>
                <th className="py-3 px-4">ໂຄຕ້າ (Quota)</th>
                {isSuperAdmin && <th className="py-3 px-4 text-right">ຈັດການ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    {language === 'lo' ? 'ບໍ່ພົບຂໍ້ມູນຕຳແໜ່ງ' : 'No positions found'}
                  </td>
                </tr>
              ) : (
                filtered.map(pos => (
                  <tr key={pos.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                      {pos.code}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{pos.title_lo}</div>
                      <div className="text-[10px] text-slate-500 font-sans">{pos.title_en}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {pos.dept_name_lo ? (
                        <span className="font-semibold text-slate-700">{pos.dept_name_lo}</span>
                      ) : (
                        <span className="font-semibold text-blue-700 font-mono text-[10px] bg-blue-50 px-2 py-0.5 rounded">
                          EXECUTIVE
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                        Level {pos.level}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                      <span className="font-bold">{pos.assigned_user_count || 0}</span> / {pos.max_headcount} ທ່ານ
                    </td>
                    {isSuperAdmin && (
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenEdit(pos)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(pos)}
                            className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Position Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-sm text-slate-900">
                {editingPos ? 'ແກ້ໄຂຕຳແໜ່ງງານ' : 'ສ້າງຕຳແໜ່ງງານໃໝ່'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ລະຫັດຕຳແໜ່ງ (Code) *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingPos}
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="HEAD_ADM_FIN"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-blue-600 focus:outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ສັງກັດພະແນກ</label>
                  <select
                    value={form.dept_id}
                    onChange={e => setForm({ ...form, dept_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="">- ຄະນະອຳນວຍການໃຫຍ່ (Executive) -</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name_lo} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ຊື່ຕຳແໜ່ງ (ພາສາລາວ) *</label>
                <input
                  type="text"
                  required
                  value={form.title_lo}
                  onChange={e => setForm({ ...form, title_lo: e.target.value })}
                  placeholder="ຫົວໜ້າພະແນກ..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ຊື່ຕຳແໜ່ງ (ພາສາອັງກິດ) *</label>
                <input
                  type="text"
                  required
                  value={form.title_en}
                  onChange={e => setForm({ ...form, title_en: e.target.value })}
                  placeholder="Head of Department..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ລະດັບສາຍບັງຄັບບັນຊາ (Level 1-6)</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={form.level}
                    onChange={e => setForm({ ...form, level: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ໂຄຕ້າຈຳນວນພະນັກງານ (Quota)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={form.max_headcount}
                    onChange={e => setForm({ ...form, max_headcount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 transition"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition"
                >
                  ບັນທຶກຕຳແໜ່ງ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
