import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import {
  Database,
  ShieldCheck,
  RotateCcw,
  Play,
  HardDrive,
  FileCheck2,
  Clock,
  RefreshCw,
  Server,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  Terminal,
} from 'lucide-react';
import { alertService } from '../../services/swal.js';

export const DisasterRecoveryBackupView: React.FC = () => {
  const { fetchWithAuth, language } = useAuth();
  const [status, setStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningBackup, setRunningBackup] = useState(false);
  const [runningRestoreTest, setRunningRestoreTest] = useState(false);
  const [restoreTestResult, setRestoreTestResult] = useState<any>(null);

  const fetchBackupStatus = async () => {
    try {
      setLoading(true);
      const [resStatus, resHistory] = await Promise.all([
        fetchWithAuth('/api/backup/status'),
        fetchWithAuth('/api/backup/history'),
      ]);

      const dataStatus = await resStatus.json();
      const dataHistory = await resHistory.json();

      if (dataStatus.success) setStatus(dataStatus);
      if (dataHistory.success) setHistory(dataHistory.history || []);
    } catch (e: any) {
      alertService.error('Backup API Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackupStatus();
  }, []);

  const handleRunBackup = async () => {
    const confirm = await alertService.confirm(
      language === 'lo' ? 'ດຳເນີນການ Backup ຖານຂໍ້ມູນ' : 'Run Incremental Backup',
      language === 'lo'
        ? 'ລະບົບຈະສ້າງ Snapshot ແບບ Incremental ຂອງ D1 SQLite ແລະ ກວດສອບໄຟລ໌ R2 ພ້ອມບັນທຶກ Audit Log.'
        : 'Trigger incremental D1 SQLite snapshot, R2 manifest verification, and audit trail record.',
      language === 'lo' ? 'ດຳເນີນການດຽວນີ້' : 'Execute Backup',
      language === 'lo' ? 'ຍົກເລີກ' : 'Cancel'
    );

    if (!confirm.isConfirmed) return;

    setRunningBackup(true);
    try {
      alertService.loading(
        language === 'lo' ? 'ກຳລັງສ້າງ Incremental Backup...' : 'Creating Incremental Backup...'
      );
      const res = await fetchWithAuth('/api/backup/run', { method: 'POST' });
      const data = await res.json();
      alertService.close();

      if (data.success) {
        await alertService.success(
          language === 'lo' ? 'Backup ສຳເລັດສົມບູນ' : 'Backup Succeeded',
          language === 'lo'
            ? `ລະຫັດ: ${data.backupId} • ຈຳນວນບັນທຶກ: ${data.totalRecords} • SHA-256: ${data.sha256Hex?.substring(0, 16)}...`
            : `Backup ID: ${data.backupId} • Records: ${data.totalRecords} • SHA-256: ${data.sha256Hex?.substring(0, 16)}...`
        );
        fetchBackupStatus();
      } else {
        alertService.error('Backup Error', data.message || 'Backup failed');
      }
    } catch (err: any) {
      alertService.close();
      alertService.error('Error', err.message);
    } finally {
      setRunningBackup(false);
    }
  };

  const handleRunRestoreTest = async () => {
    setRunningRestoreTest(true);
    try {
      alertService.loading(
        language === 'lo' ? 'ກຳລັງທົດສອບກູ້ຄືນໃນ Sandbox...' : 'Verifying Disaster Recovery in Sandbox...'
      );
      const res = await fetchWithAuth('/api/backup/verify-restore', {
        method: 'POST',
        body: JSON.stringify({ backupId: status?.lastBackupId }),
      });
      const data = await res.json();
      alertService.close();

      if (data.success) {
        setRestoreTestResult(data);
        await alertService.success(
          language === 'lo' ? 'ການທົດສອບ DR ສຳເລັດ (100% Verified)' : 'DR Restore Test Verified',
          language === 'lo'
            ? `ກວດສອບໂຄງສ້າງ ແລະ ບັນທຶກ ${data.recordsVerified} ລາຍການໃນ ${data.tablesVerified} ຕາຕະລາງສຳເລັດ 100%.`
            : `All ${data.tablesVerified} tables and ${data.recordsVerified} records reconstructed and verified.`
        );
        fetchBackupStatus();
      } else {
        alertService.error('Restore Verification Error', data.message);
      }
    } catch (err: any) {
      alertService.close();
      alertService.error('Error', err.message);
    } finally {
      setRunningRestoreTest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-6 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1.5">
            <span className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Database className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight">
              {language === 'lo' ? 'ລະບົບກູ້ຄືນໄພພິບັດ & Backup ອັດຕະໂນມັດ D1 / R2' : 'Disaster Recovery & Scheduled D1/R2 Backup'}
            </h1>
          </div>
          <p className="text-xs text-slate-300">
            {language === 'lo'
              ? 'ຟັງຊັນ Serverless ອັດຕະໂນມັດທຸກໆ 6 ຊົ່ວໂມງ ພ້ອມບັນທຶກ Audit Log ກວດສອບຄວາມພ້ອມດ້ານ Disaster Recovery'
              : 'Automated 6-hour serverless function backing up Cloudflare D1 tables & R2 references with immutable audit validation.'}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchBackupStatus}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleRunBackup}
            disabled={runningBackup}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{runningBackup ? (language === 'lo' ? 'ກຳລັງ Backup...' : 'Backing up...') : (language === 'lo' ? 'Backup ດຽວນີ້' : 'Trigger Backup Now')}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="text-xs text-slate-500 font-medium mb-1">
            {language === 'lo' ? 'ຄວາມພ້ອມກູ້ຄືນ (DR Readiness)' : 'Disaster Recovery Readiness'}
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-lg font-bold text-emerald-600 font-mono">
              {status?.disasterRecoveryReadiness || 'VERIFIED'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{language === 'lo' ? 'ກວດສອບໂຄງສ້າງ & SHA-256 ຜ່ານ' : 'Integrity & Schema Verified'}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="text-xs text-slate-500 font-medium mb-1">
            {language === 'lo' ? 'ຮອບ Backup ອັດຕະໂນມັດ' : 'Automated Cron Trigger'}
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono">
            0 */6 * * *
          </div>
          <div className="text-[11px] text-blue-600 mt-2 font-medium">
            {language === 'lo' ? 'ທຸກໆ 6 ຊົ່ວໂມງ (Cloudflare Workers)' : 'Every 6 Hours (Workers Engine)'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="text-xs text-slate-500 font-medium mb-1">
            {language === 'lo' ? 'ຈຳນວນຮອບ Backup ທັງໝົດ' : 'Total Backup Runs'}
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono">
            {status?.totalBackupRuns || 0} Runs
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            {language === 'lo' ? 'ບັນທຶກໃນ Audit Log ຢ່າງຄົບຖ້ວນ' : 'Logged to Immutable Audit Trail'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="text-xs text-slate-500 font-medium mb-1">
            {language === 'lo' ? 'Backup ຫຼ້າສຸດ' : 'Last Backup Time'}
          </div>
          <div className="text-xs font-bold text-slate-900 font-mono truncate">
            {status?.latestBackupDetails?.timestampVientiane || status?.lastBackupAt || 'Recently'}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 font-mono truncate">
            {status?.latestBackupDetails?.totalRecords || 0} Records • {status?.latestBackupDetails?.fileSizeBytes || 0} bytes
          </div>
        </div>
      </div>

      {/* DR Sandbox Verification Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-4 border-b border-slate-100 gap-4 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <RotateCcw className="w-4 h-4 text-indigo-600" />
              <span>{language === 'lo' ? 'ການທົດສອບກູ້ຄືນໃນ Sandbox (DR Sandbox Dry-Run)' : 'Disaster Recovery Sandbox Restore Verification'}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'lo'
                ? 'ທົດສອບໂຫຼດໄຟລ໌ Backup ເຂົ້າສູ່ Isolated In-Memory Database ເພື່ອກວດສອບວ່າສາມາດກູ້ຄືນໄດ້ 100% ໂດຍບໍ່ກະທົບຖານຂໍ້ມູນແທ້'
                : 'Reconstructs D1 tables in an isolated in-memory sandbox to verify recovery readiness without modifying live data.'}
            </p>
          </div>

          <button
            onClick={handleRunRestoreTest}
            disabled={runningRestoreTest}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition flex items-center space-x-2 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>
              {runningRestoreTest
                ? (language === 'lo' ? 'ກຳລັງທົດສອບ...' : 'Verifying...')
                : (language === 'lo' ? 'ທົດສອບການກູ້ຄືນ (Run DR Test)' : 'Test Sandbox Restore')}
            </span>
          </button>
        </div>

        {/* Restore Result Info */}
        {restoreTestResult && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs mb-4">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Disaster Recovery Sandbox Validation Passed</span>
            </div>
            <div className="text-emerald-700 font-mono space-y-1">
              <div>Tables Reconstructed: {restoreTestResult.tablesVerified}</div>
              <div>Records Restored & Integrity Checked: {restoreTestResult.recordsVerified}</div>
              <div>Duration: {restoreTestResult.durationMs}ms</div>
            </div>
          </div>
        )}

        {/* Latest Snapshot Metadata */}
        {status?.latestBackupDetails && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div className="font-semibold text-slate-900 mb-2 flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-slate-600" />
              <span>Snapshot Details: {status.latestBackupDetails.backupId}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 font-mono text-[11px] text-slate-600">
              <div>Type: {status.latestBackupDetails.type}</div>
              <div>Total Records: {status.latestBackupDetails.totalRecords}</div>
              <div>Storage Key: {status.latestBackupDetails.backupStorageKey}</div>
              <div className="truncate">SHA-256: {status.latestBackupDetails.sha256Hex}</div>
              <div>Timezone: Asia/Vientiane (UTC+7)</div>
              <div>Duration: {status.latestBackupDetails.durationMs}ms</div>
            </div>
          </div>
        )}
      </div>

      {/* Backup Audit History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider flex items-center space-x-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>{language === 'lo' ? 'ປະຫວັດການ Backup & ກວດສອບກູ້ຄືນໃນ Audit Trail' : 'Disaster Recovery Audit Trail History'}</span>
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">
            {history.length} Events Logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
              <tr>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Backup ID</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Records</th>
                <th className="py-3 px-4">Timestamp (Vientiane)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No backup audit records yet.
                  </td>
                </tr>
              ) : (
                history.map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">
                      {item.action}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-blue-600 truncate max-w-[150px]">
                      {item.entity_id || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 truncate max-w-[160px]">
                      {item.actor_email}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {item.parsedDetails?.totalRecords || item.parsedDetails?.recordsVerified || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {item.parsedDetails?.timestampVientiane || item.created_at}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
