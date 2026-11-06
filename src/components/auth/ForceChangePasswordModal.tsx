import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { ShieldAlert, KeyRound, CheckCircle } from 'lucide-react';
import { alertService } from '../../services/swal.js';

export const ForceChangePasswordModal: React.FC = () => {
  const { user, changePassword, language, t } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 8) {
      alertService.error(
        language === 'lo' ? 'ລະຫັດຜ່ານສັ້ນເກີນໄປ' : 'Password too short',
        language === 'lo' ? 'ລະຫັດຜ່ານໃໝ່ຕ້ອງມີຢ່າງໜ້ອຍ 8 ຕົວອັກສອນ' : 'Password must be at least 8 characters'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      alertService.error(
        language === 'lo' ? 'ລະຫັດຜ່ານບໍ່ກົງກັນ' : 'Passwords do not match',
        language === 'lo' ? 'ກະລຸນາກວດສອບການຢືນຢັນລະຫັດຜ່ານໃໝ່' : 'Please verify new password confirmation'
      );
      return;
    }

    setLoading(true);
    const res = await changePassword('', newPassword);
    setLoading(false);

    if (!res.success) {
      alertService.error(
        language === 'lo' ? 'ບໍ່ສາມາດປ່ຽນລະຫັດໄດ້' : 'Failed to update',
        res.error
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {language === 'lo' ? 'ບັງຄັບປ່ຽນລະຫັດຜ່ານເລີ່ມຕົ້ນ' : 'Mandatory Password Change'}
            </h2>
            <p className="text-xs text-slate-500">
              {language === 'lo' ? 'ລະຫັດຜ່ານຊົ່ວຄາວຕ້ອງຖືກປ່ຽນກ່ອນເລີ່ມໃຊ້ງານ' : 'Temporary bootstrap credentials must be updated'}
            </p>
          </div>
        </div>

        <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-5">
          <p className="font-semibold mb-1">
            {language === 'lo' ? 'ນະໂຍບາຍຄວາມປອດໄພ LHSE:' : 'LHSE Cybersecurity Policy:'}
          </p>
          <p>
            {language === 'lo'
              ? 'ບັນຊີຂອງທ່ານ (' + user?.email + ') ໄດ້ຮັບການກຳນົດລະຫັດຜ່ານຊົ່ວຄາວ. ເພື່ອຄວາມປອດໄພສູງສຸດ ກະລຸນາກຳນົດລະຫັດຜ່ານໃໝ່ທີ່ມີຄວາມຍາວຢ່າງໜ້ອຍ 8 ຕົວອັກສອນ.'
              : 'Your account (' + user?.email + ') is using a temporary bootstrap password. Please set a new secure password.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {language === 'lo' ? 'ລະຫັດຜ່ານໃໝ່ (New Password)' : 'New Password'}
            </label>
            <div className="relative">
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {language === 'lo' ? 'ຢືນຢັນລະຫັດຜ່ານໃໝ່ (Confirm Password)' : 'Confirm Password'}
            </label>
            <div className="relative">
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
              <CheckCircle className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm transition shadow flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>{loading ? (language === 'lo' ? 'ກຳລັງບັນທຶກ...' : 'Saving...') : (language === 'lo' ? 'ຕັ້ງລະຫັດຜ່ານໃໝ່ & ເລີ່ມໃຊ້ງານ' : 'Set New Password & Continue')}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
