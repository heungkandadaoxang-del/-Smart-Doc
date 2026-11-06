import { Router, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { runIncrementalBackup, verifyDisasterRecoveryRestore } from '../services/backup.js';

export const backupRouter = Router();

// 1. POST /api/backup/run - Trigger incremental D1 & R2 backup and DR verification
backupRouter.post('/run', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  if (!actor.roles.includes('SUPER_ADMIN')) {
    res.status(403).json({
      success: false,
      error: 'SUPER_ADMIN_REQUIRED',
      message: 'ສະເພາະ Super Admin ເທົ່ານັ້ນທີ່ສາມາດດຳເນີນການ Backup ຖານຂໍ້ມູນ',
    });
    return;
  }

  try {
    const result = await runIncrementalBackup('MANUAL_TRIGGER', actor.email, actor.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'BACKUP_FAILED',
      message: err.message,
    });
  }
});

// 2. GET /api/backup/status - Latest backup status and disaster recovery readiness
backupRouter.get('/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  // Check latest backup log from audit_logs
  const latestBackupLog = db.prepare(`
    SELECT * FROM audit_logs
    WHERE action = 'DISASTER_RECOVERY_BACKUP'
    ORDER BY created_at DESC
    LIMIT 1
  `).get() as any;

  const latestRestoreLog = db.prepare(`
    SELECT * FROM audit_logs
    WHERE action = 'DISASTER_RECOVERY_RESTORE_TEST'
    ORDER BY created_at DESC
    LIMIT 1
  `).get() as any;

  const totalBackupRuns = (db.prepare(`
    SELECT COUNT(*) as c FROM audit_logs WHERE action = 'DISASTER_RECOVERY_BACKUP'
  `).get() as any)?.c || 0;

  let parsedBackupDetails: any = null;
  if (latestBackupLog && latestBackupLog.details) {
    try {
      parsedBackupDetails = JSON.parse(latestBackupLog.details);
    } catch (e) {}
  }

  let parsedRestoreDetails: any = null;
  if (latestRestoreLog && latestRestoreLog.details) {
    try {
      parsedRestoreDetails = JSON.parse(latestRestoreLog.details);
    } catch (e) {}
  }

  res.json({
    success: true,
    disasterRecoveryReadiness: latestBackupLog?.status === 'SUCCESS' ? 'VERIFIED' : 'PENDING_FIRST_BACKUP',
    lastBackupAt: latestBackupLog?.created_at || null,
    lastBackupId: latestBackupLog?.entity_id || null,
    totalBackupRuns,
    latestBackupDetails: parsedBackupDetails,
    latestRestoreTest: parsedRestoreDetails,
  });
});

// 3. POST /api/backup/verify-restore - Dry-run disaster recovery sandbox restore verification
backupRouter.post('/verify-restore', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  if (!actor.roles.includes('SUPER_ADMIN')) {
    res.status(403).json({
      success: false,
      error: 'SUPER_ADMIN_REQUIRED',
      message: 'ສະເພາະ Super Admin ເທົ່ານັ້ນທີ່ສາມາດດຳເນີນການກວດສອບການກູ້ຄືນຖານຂໍ້ມູນ',
    });
    return;
  }

  const { backupId } = req.body;

  try {
    const result = verifyDisasterRecoveryRestore(backupId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'RESTORE_VERIFICATION_FAILED',
      message: err.message,
    });
  }
});

// 4. GET /api/backup/history - List backup audit entries
backupRouter.get('/history', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const logs = db.prepare(`
    SELECT * FROM audit_logs
    WHERE action IN ('DISASTER_RECOVERY_BACKUP', 'DISASTER_RECOVERY_RESTORE_TEST')
    ORDER BY created_at DESC
    LIMIT 20
  `).all();

  const formatted = logs.map((l: any) => {
    let details: any = null;
    try { details = JSON.parse(l.details); } catch (e) {}
    return {
      ...l,
      parsedDetails: details,
    };
  });

  res.json({
    success: true,
    history: formatted,
  });
});
