import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Organization, Department } from '../../types/index.js';
import { alertService } from '../../services/swal.js';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  Edit,
  Save,
  CheckCircle,
  Shield,
  Layers,
  Users,
} from 'lucide-react';

export const OrganizationProfileView: React.FC = () => {
  const { user, fetchWithAuth, language, t } = useAuth();
  const [org, setOrg] = useState<Organization | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Partial<Organization>>({});

  const isSuperAdmin = user?.roles.includes('SUPER_ADMIN');

  const loadOrg = async () => {
    setLoading(true);
    try {
      const [orgRes, deptsRes] = await Promise.all([
        fetchWithAuth('/api/organization'),
        fetchWithAuth('/api/departments'),
      ]);
      const orgData = await orgRes.json();
      const deptsData = await deptsRes.json();

      if (orgData.success) {
        setOrg(orgData.organization);
        setForm(orgData.organization);
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
    loadOrg();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      alertService.loading(language === 'lo' ? 'ກຳລັງບັນທຶກ...' : 'Saving...');
      const res = await fetchWithAuth('/api/organization', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      alertService.close();

      if (data.success) {
        setOrg(data.organization);
        setIsEditing(false);
        await alertService.success(
          language === 'lo' ? 'ບັນທຶກສຳເລັດ' : 'Saved',
          data.message
        );
      } else {
        alertService.error('Error', data.message);
      }
    } catch (err: any) {
      alertService.close();
      alertService.error('Error', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner">
              <Building2 className="w-10 h-10 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  {org?.name_lo || 'ລັດວິສາຫະກິດຖືຮຸ້ນລາວ'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-600/30 text-blue-300 border border-blue-400/30 text-xs font-mono font-bold">
                  LHSE
                </span>
              </div>
              <p className="text-sm text-slate-300 font-medium mt-1">
                {org?.name_en || 'Lao State Enterprise Holding'}
              </p>
              <div className="flex items-center space-x-4 mt-2 text-xs text-slate-400">
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>{org?.timezone || 'Asia/Vientiane'} (UTC+7)</span>
                </span>
                <span>•</span>
                <span>{language === 'lo' ? 'ເລກປະຈຳຕົວຜູ້ເສຍພາສີ:' : 'Tax ID:'} {org?.tax_id || '01-00023489'}</span>
              </div>
            </div>
          </div>

          {isSuperAdmin && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-sm border border-white/20 transition flex items-center space-x-2"
            >
              <Edit className="w-4 h-4" />
              <span>{language === 'lo' ? 'ແກ້ໄຂຂໍ້ມູນອົງກອນ' : 'Edit Profile'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Profile Details & Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100 flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>{language === 'lo' ? 'ຂໍ້ມູນທົ່ວໄປຂອງອົງກອນ' : 'General Organization Details'}</span>
          </h2>

          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'lo' ? 'ຊື່ອົງກອນ (ພາສາລາວ)' : 'Organization Name (Lao)'}
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name_lo || ''}
                    onChange={e => setForm({ ...form, name_lo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'lo' ? 'ຊື່ອົງກອນ (ພາສາອັງກິດ)' : 'Organization Name (English)'}
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name_en || ''}
                    onChange={e => setForm({ ...form, name_en: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'lo' ? 'ທີ່ຢູ່ສຳນັກງານໃຫຍ່ (ພາສາລາວ)' : 'Address (Lao)'}
                </label>
                <textarea
                  rows={2}
                  required
                  value={form.address_lo || ''}
                  onChange={e => setForm({ ...form, address_lo: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'lo' ? 'ທີ່ຢູ່ສຳນັກງານໃຫຍ່ (ພາສາອັງກິດ)' : 'Address (English)'}
                </label>
                <textarea
                  rows={2}
                  value={form.address_en || ''}
                  onChange={e => setForm({ ...form, address_en: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'lo' ? 'ເບີໂທລະສັບ' : 'Phone'}
                  </label>
                  <input
                    type="text"
                    value={form.phone || ''}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'lo' ? 'ອີເມວຕິດຕໍ່' : 'Email'}
                  </label>
                  <input
                    type="email"
                    value={form.email || ''}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'lo' ? 'ເວັບໄຊ' : 'Website'}
                  </label>
                  <input
                    type="text"
                    value={form.website || ''}
                    onChange={e => setForm({ ...form, website: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs text-slate-600 hover:bg-slate-50 transition"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition flex items-center space-x-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{t.save}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block mb-1">
                    {language === 'lo' ? 'ທີ່ຢູ່ສຳນັກງານໃຫຍ່ (ພາສາລາວ):' : 'Official Address (Lao):'}
                  </span>
                  <p className="font-semibold text-slate-800 leading-relaxed">
                    {org?.address_lo}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block mb-1">
                    {language === 'lo' ? 'ທີ່ຢູ່ສຳນັກງານໃຫຍ່ (ພາສາອັງກິດ):' : 'Official Address (English):'}
                  </span>
                  <p className="font-semibold text-slate-800 leading-relaxed font-sans">
                    {org?.address_en}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center space-x-3">
                  <Phone className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <span className="text-slate-400 text-[10px] block">
                      {language === 'lo' ? 'ເບີໂທລະສັບ' : 'Phone'}
                    </span>
                    <span className="font-semibold text-slate-800">{org?.phone}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center space-x-3">
                  <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <span className="text-slate-400 text-[10px] block">
                      {language === 'lo' ? 'ອີເມວ' : 'Email'}
                    </span>
                    <span className="font-semibold text-slate-800 font-mono text-[11px]">{org?.email}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center space-x-3">
                  <Globe className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <span className="text-slate-400 text-[10px] block">
                      {language === 'lo' ? 'ເວັບໄຊ' : 'Website'}
                    </span>
                    <span className="font-semibold text-slate-800 font-mono text-[11px]">{org?.website}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Organizational Structure */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>{language === 'lo' ? 'ໂຄງຮ່າງການຈັດຕັ້ງ (5 ພະແນກ)' : 'Organizational Structure'}</span>
          </h2>

          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-900 text-white text-center">
              <span className="text-[10px] uppercase tracking-widest text-blue-400 font-bold block">
                Executive Directorate
              </span>
              <strong className="text-xs">ຄະນະອຳນວຍການ ລັດວິສາຫະກິດຖືຮຸ້ນລາວ</strong>
            </div>

            <div className="h-4 w-0.5 bg-slate-300 mx-auto" />

            <div className="space-y-2">
              {departments.map((dept, index) => (
                <div
                  key={dept.id}
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-800">{dept.name_lo}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {dept.code} • ຫົວໜ້າ: {dept.designated_admin_name}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
