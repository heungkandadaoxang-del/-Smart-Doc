import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { User, Department, RoleCode } from '../../types/index.js';
import { alertService } from '../../services/swal.js';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Building,
  Key,
  Lock,
  Unlock,
  CheckCircle,
  AlertCircle,
  Clock,
  Search,
  Filter,
  UserCheck,
  Send,
  RefreshCw,
  Mail,
  Phone,
  Shield,
  Layers,
} from 'lucide-react';

export const UserManagementView: React.FC = () => {
  const { user, fetchWithAuth, language, t } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [targetDeptForActivation, setTargetDeptForActivation] = useState<Department | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    full_name_lo: '',
    full_name_en: '',
    dept_id: '',
    phone: '',
    role_code: 'DEPT_STAFF',
  });

  const [activationForm, setActivationForm] = useState({
    official_email: '',
    full_name_en: '',
    initial_password: '',
    phone: '',
  });

  const isSuperAdmin = user?.roles.includes('SUPER_ADMIN');
  const isDeptAdmin = user?.roles.includes('DEPT_ADMIN');

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch departments
      const deptsRes = await fetchWithAuth('/api/departments');
      const deptsData = await deptsRes.json();
      if (deptsData.success) {
        setDepartments(deptsData.departments);
      }

      // 2. Fetch users
      let url = '/api/users';
      if (selectedDeptFilter !== 'ALL' && isSuperAdmin) {
        url += `?dept_id=${selectedDeptFilter}`;
      }
      const usersRes = await fetchWithAuth(url);
      const usersData = await usersRes.json();
      if (usersData.success) {
        setUsers(usersData.users);
      } else {
        alertService.error('Error', usersData.message);
      }
    } catch (err: any) {
      alertService.error('Failed to load data', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDeptFilter]);

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      alertService.loading(language === 'lo' ? 'ກຳລັງສ້າງຜູ້ໃຊ້...' : 'Creating user...');
      const targetDeptId = isSuperAdmin ? createForm.dept_id : user?.dept_id;

      const res = await fetchWithAuth('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          ...createForm,
          dept_id: targetDeptId,
        }),
      });
      const data = await res.json();
      alertService.close();

      if (!res.ok || !data.success) {
        alertService.error(language === 'lo' ? 'ເກີດຂໍ້ຜິດພາດ' : 'Error', data.message);
        return;
      }

      await alertService.success(
        language === 'lo' ? 'ສ້າງຜູ້ໃຊ້ສຳເລັດ' : 'User Created',
        language === 'lo' ? 'ບັນຊີຜູ້ໃຊ້ງານຖືກສ້າງຂຶ້ນຮຽບຮ້ອຍແລ້ວ' : 'User account has been successfully created'
      );
      setShowCreateModal(false);
      setCreateForm({
        email: '',
        password: '',
        full_name_lo: '',
        full_name_en: '',
        dept_id: '',
        phone: '',
        role_code: 'DEPT_STAFF',
      });
      loadData();
    } catch (err: any) {
      alertService.close();
      alertService.error('Error', err.message);
    }
  };

  // Handle Activate Dept Admin
  const handleOpenActivateModal = (dept: Department) => {
    setTargetDeptForActivation(dept);
    setActivationForm({
      official_email: `${dept.code.toLowerCase()}.admin@lhse.gov.la`,
      full_name_en: dept.designated_admin_name,
      initial_password: `LHSE@${dept.code}2026!`,
      phone: '+856 20 ',
    });
    setShowActivateModal(true);
  };

  const handleActivateDeptAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeptForActivation) return;

    try {
      alertService.loading(language === 'lo' ? 'ກຳລັງເປີດນຳໃຊ້ບັນຊີຫົວໜ້າ...' : 'Activating department admin...');
      const res = await fetchWithAuth('/api/users/activate-dept-admin', {
        method: 'POST',
        body: JSON.stringify({
          dept_id: targetDeptForActivation.id,
          ...activationForm,
        }),
      });
      const data = await res.json();
      alertService.close();

      if (!res.ok || !data.success) {
        alertService.error(language === 'lo' ? 'ເກີດຂໍ້ຜິດພາດ' : 'Error', data.message);
        return;
      }

      await alertService.success(
        language === 'lo' ? 'ເປີດໃຊ້ງານສຳເລັດ' : 'Admin Activated',
        data.message
      );
      setShowActivateModal(false);
      setTargetDeptForActivation(null);
      loadData();
    } catch (err: any) {
      alertService.close();
      alertService.error('Error', err.message);
    }
  };

  // Handle Suspend/Reactivate
  const handleToggleStatus = async (targetUser: User) => {
    const isSuspending = targetUser.status === 'ACTIVE';
    const actionText = isSuspending ? (language === 'lo' ? 'ໂຈະການໃຊ້ງານ' : 'Suspend') : (language === 'lo' ? 'ເປີດໃຊ້ງານຄືນ' : 'Reactivate');

    const confirm = await alertService.confirm(
      `${actionText} ບັນຊີ`,
      language === 'lo'
        ? `ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການ ${actionText} ບັນຊີຂອງ "${targetUser.full_name_lo}" (${targetUser.email})?`
        : `Are you sure you want to ${actionText} account "${targetUser.full_name_en || targetUser.full_name_lo}"?`,
      actionText,
      language === 'lo' ? 'ຍົກເລີກ' : 'Cancel',
      isSuspending
    );

    if (confirm.isConfirmed) {
      try {
        alertService.loading(language === 'lo' ? 'ກຳລັງດຳເນີນການ...' : 'Processing...');
        const res = await fetchWithAuth(`/api/users/${targetUser.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: isSuspending ? 'SUSPENDED' : 'ACTIVE' }),
        });
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

  // Handle Reset Password
  const handleResetPassword = async (targetUser: User) => {
    const tempPassword = `LHSE#Reset${Math.floor(1000 + Math.random() * 9000)}!`;
    const confirm = await alertService.confirm(
      language === 'lo' ? 'ຣີເຊັດລະຫັດຜ່ານ' : 'Reset Password',
      language === 'lo'
        ? `ລະຫັດຜ່ານໃໝ່ຈະຖືກກຳນົດເປັນ: "${tempPassword}" ແລະ ຜູ້ໃຊ້ຈະຕ້ອງປ່ຽນລະຫັດເມື່ອເຂົ້າສູ່ລະບົບ.`
        : `New temporary password will be set to: "${tempPassword}". User will be forced to change it.`,
      language === 'lo' ? 'ຣີເຊັດລະຫັດ' : 'Reset Now',
      language === 'lo' ? 'ຍົກເລີກ' : 'Cancel'
    );

    if (confirm.isConfirmed) {
      try {
        alertService.loading(language === 'lo' ? 'ກຳລັງຣີເຊັດ...' : 'Resetting...');
        const res = await fetchWithAuth(`/api/users/${targetUser.id}/reset-password`, {
          method: 'POST',
          body: JSON.stringify({ newPassword: tempPassword }),
        });
        const data = await res.json();
        alertService.close();

        if (data.success) {
          await alertService.success(
            language === 'lo' ? 'ຣີເຊັດສຳເລັດ' : 'Password Reset',
            language === 'lo'
              ? `ລະຫັດຜ່ານໃໝ່: ${tempPassword}\nກະລຸນາແຈ້ງລະຫັດນີ້ໃຫ້ຜູ້ໃຊ້ງານ.`
              : `Temporary password: ${tempPassword}\nPlease convey this credential securely to the user.`
          );
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

  // Filter users by search
  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.full_name_lo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.full_name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.dept_name_lo && u.dept_name_lo.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">{t.userManagementTitle}</h1>
          </div>
          <p className="text-xs text-slate-500">
            {t.userManagementSubtitle}
          </p>
        </div>

        {/* Isolation Scoping Banner */}
        {!isSuperAdmin && (
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
            <Shield className="w-4 h-4 text-amber-600" />
            <span>
              {language === 'lo'
                ? `ຂອບເຂດສິດທິ: ${user?.dept_name_lo || 'ພະແນກຂອງທ່ານ'} (ແຍກສິດທິຢ່າງເຂັ້ມງວດ)`
                : `Scoped: ${user?.dept_name_en || 'Your Department'} (Isolation Active)`}
            </span>
          </div>
        )}

        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            title={t.refresh}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm flex items-center space-x-2 transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t.addUserButton}</span>
          </button>
        </div>
      </div>

      {/* 5 LHSE Department Admin Status Cards (Super Admin Oversight) */}
      {isSuperAdmin && (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-md border border-slate-700/60">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Building className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-bold tracking-tight">
                {language === 'lo'
                  ? 'ສະຖານະບັນຊີຫົວໜ້າ 5 ພະແນກຫຼັກ LHSE (Designated Department Admins)'
                  : '5 LHSE Designated Department Admins & Activation Status'}
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {departments.filter(d => d.admin_email).length} / 5 {language === 'lo' ? 'ເປີດໃຊ້ງານແລ້ວ' : 'Activated'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {departments.map(dept => {
              const isActivated = !!dept.admin_email;
              return (
                <div
                  key={dept.id}
                  className={`rounded-xl p-3.5 border transition ${
                    isActivated
                      ? 'bg-slate-800/80 border-slate-700'
                      : 'bg-amber-950/20 border-amber-600/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-950/80 text-blue-300">
                      {dept.code}
                    </span>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        isActivated
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {isActivated ? (language === 'lo' ? 'ເປີດໃຊ້ງານແລ້ວ' : 'Active') : (language === 'lo' ? 'ລໍຖ້າເຊີນ' : 'Pending Invite')}
                    </span>
                  </div>

                  <h3 className="text-xs font-semibold text-slate-200 line-clamp-1" title={dept.name_lo}>
                    {language === 'lo' ? dept.name_lo : dept.name_en}
                  </h3>

                  <div className="mt-2 pt-2 border-t border-slate-700/60 text-[11px] text-slate-300">
                    <div className="flex items-center space-x-1.5 text-slate-400">
                      <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                      <span>{language === 'lo' ? 'ຜູ້ຮັບຜິດຊອບ:' : 'Designated:'}</span>
                      <strong className="text-slate-200">{dept.designated_admin_name}</strong>
                    </div>

                    {isActivated ? (
                      <div className="mt-1 flex items-center space-x-1 text-emerald-400 truncate text-[10px]">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">{dept.admin_email}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleOpenActivateModal(dept)}
                        className="mt-2 w-full py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-[10px] flex items-center justify-center space-x-1 transition"
                      >
                        <Send className="w-3 h-3" />
                        <span>{language === 'lo' ? 'ກຳນົດອີເມວ & ເປີດບັນຊີ' : 'Invite & Activate'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t.search}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        {isSuperAdmin && (
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedDeptFilter}
              onChange={e => setSelectedDeptFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">{t.allDepartments}</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {language === 'lo' ? d.name_lo : d.name_en} ({d.code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">{language === 'lo' ? 'ພະນັກງານ' : 'User'}</th>
                <th className="py-3 px-4">{t.department}</th>
                <th className="py-3 px-4">{t.role}</th>
                <th className="py-3 px-4">{t.status}</th>
                <th className="py-3 px-4">{t.lastLogin}</th>
                <th className="py-3 px-4 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    {language === 'lo' ? 'ບໍ່ພົບລາຍຊື່ຜູ້ໃຊ້ງານ' : 'No users found'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => {
                  const isAdminRole = u.roles.includes('SUPER_ADMIN') || u.roles.includes('DEPT_ADMIN');
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                            {u.full_name_lo.substring(0, 1) || 'U'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {language === 'lo' ? u.full_name_lo : u.full_name_en}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-700">
                          {u.dept_name_lo ? (language === 'lo' ? u.dept_name_lo : u.dept_name_en) : '- ອົງກອນສູນກາງ -'}
                        </span>
                        {u.dept_code && (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                            {u.dept_code}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map(r => (
                            <span
                              key={r}
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                r === 'SUPER_ADMIN'
                                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                  : r === 'DEPT_ADMIN'
                                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center space-x-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500'
                            }`}
                          />
                          <span>{u.status === 'ACTIVE' ? t.active : t.suspended}</span>
                        </span>
                        {u.must_change_password && (
                          <span className="block text-[9px] text-amber-600 mt-0.5 font-medium">
                            • {language === 'lo' ? 'ລໍຖ້າປ່ຽນລະຫັດ' : 'Must Change Pass'}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleString('en-GB', {
                              timeZone: 'Asia/Vientiane',
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '- ຍັງບໍ່ເຄີຍ -'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleResetPassword(u)}
                            title={t.resetPassword}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          {u.email !== 'nokohn@gmail.com' && (
                            <button
                              onClick={() => handleToggleStatus(u)}
                              title={u.status === 'ACTIVE' ? t.suspendUser : t.reactivateUser}
                              className={`p-1.5 rounded-lg border transition ${
                                u.status === 'ACTIVE'
                                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                                  : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {u.status === 'ACTIVE' ? (
                                <Lock className="w-3.5 h-3.5" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create User */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-base text-slate-900">
                {language === 'lo' ? 'ເພີ່ມພະນັກງານໃໝ່' : 'Create New User Account'}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t.fullNameLo} *</label>
                  <input
                    type="text"
                    required
                    value={createForm.full_name_lo}
                    onChange={e => setCreateForm({ ...createForm, full_name_lo: e.target.value })}
                    placeholder="ທ້າວ ສົມສັກ"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t.fullNameEn}</label>
                  <input
                    type="text"
                    value={createForm.full_name_en}
                    onChange={e => setCreateForm({ ...createForm, full_name_en: e.target.value })}
                    placeholder="Mr. Somsak"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t.emailLabel} *</label>
                  <input
                    type="email"
                    required
                    value={createForm.email}
                    onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="somsak@lhse.gov.la"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t.passwordLabel} *</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={createForm.password}
                    onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Min 8 characters"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t.department}</label>
                  <select
                    value={createForm.dept_id}
                    onChange={e => setCreateForm({ ...createForm, dept_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
                  >
                    <option value="">- ບໍ່ສັງກັດພະແນກ (ອົງກອນສູນກາງ) -</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {language === 'lo' ? d.name_lo : d.name_en} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t.role}</label>
                  <select
                    value={createForm.role_code}
                    onChange={e => setCreateForm({ ...createForm, role_code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
                  >
                    <option value="DEPT_STAFF">{t.roleDeptStaff}</option>
                    <option value="APPROVER">{t.roleApprover}</option>
                    <option value="EXECUTIVE_VIEWER">{t.roleExecutiveViewer}</option>
                    {isSuperAdmin && <option value="DEPT_ADMIN">{t.roleDeptAdmin}</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t.phone}</label>
                  <input
                    type="text"
                    value={createForm.phone}
                    onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
                    placeholder="+856 20 5555 1234"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs text-slate-600 hover:bg-slate-50 transition"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  {t.create}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Activate Designated Department Admin */}
      {showActivateModal && targetDeptForActivation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {language === 'lo' ? 'ເປີດນຳໃຊ້ບັນຊີຫົວໜ້າພະແນກ' : 'Activate Department Admin'}
                </h3>
                <p className="text-xs text-blue-600 font-medium">
                  {targetDeptForActivation.name_lo} ({targetDeptForActivation.code})
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs mb-4">
              <span className="text-slate-500 block mb-0.5">
                {language === 'lo' ? 'ບຸກຄົນທີ່ໄດ້ຮັບມອບໝາຍຕາມມະຕິ LHSE:' : 'Designated Leader:'}
              </span>
              <strong className="text-slate-900 text-sm">
                {targetDeptForActivation.designated_admin_name}
              </strong>
            </div>

            <form onSubmit={handleActivateDeptAdmin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'lo' ? 'ອີເມວທາງການ (Official LHSE Email) *' : 'Official Email *'}
                </label>
                <input
                  type="email"
                  required
                  value={activationForm.official_email}
                  onChange={e => setActivationForm({ ...activationForm, official_email: e.target.value })}
                  placeholder="name@lhse.gov.la"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'lo' ? 'ລະຫັດຜ່ານເລີ່ມຕົ້ນ *' : 'Initial Password *'}
                  </label>
                  <input
                    type="text"
                    required
                    minLength={8}
                    value={activationForm.initial_password}
                    onChange={e => setActivationForm({ ...activationForm, initial_password: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {language === 'lo' ? 'ຜູ້ໃຊ້ຈະຖືກບັງຄັບໃຫ້ປ່ຽນເມື່ອເຂົ້າລະບົບ' : 'Forced change upon first login'}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t.phone}</label>
                  <input
                    type="text"
                    value={activationForm.phone}
                    onChange={e => setActivationForm({ ...activationForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowActivateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs text-slate-600 hover:bg-slate-50 transition"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition flex items-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{language === 'lo' ? 'ຢືນຢັນການເປີດບັນຊີ' : 'Activate & Assign Admin'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
