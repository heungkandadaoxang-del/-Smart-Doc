import { Router, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const auditRouter = Router();

// List audit logs
auditRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');
  const isDeptAdmin = actor.roles.includes('DEPT_ADMIN');

  if (!isSuperAdmin && !isDeptAdmin) {
    res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'ທ່ານບໍ່ມີສິດເບິ່ງບັນທຶກຄວາມປອດໄພ (Insufficient permissions)',
    });
    return;
  }

  const { status, action, limit = '100', offset = '0' } = req.query;

  let query = `
    SELECT al.*, d.name_lo as dept_name_lo, d.code as dept_code
    FROM audit_logs al
    LEFT JOIN departments d ON al.dept_id = d.id
  `;
  const params: any[] = [];
  const whereClauses: string[] = [];

  // Scoping: Department Admin only sees logs from their own department
  if (!isSuperAdmin) {
    whereClauses.push('al.dept_id = ?');
    params.push(actor.dept_id);
  }

  if (status) {
    whereClauses.push('al.status = ?');
    params.push(status);
  }

  if (action) {
    whereClauses.push('al.action LIKE ?');
    params.push(`%${action}%`);
  }

  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }

  query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit) || 100, Number(offset) || 0);

  const logs = db.prepare(query).all(...params);

  // Total count for pagination
  let countQuery = 'SELECT COUNT(*) as total FROM audit_logs al';
  if (whereClauses.length > 0) {
    countQuery += ' WHERE ' + whereClauses.join(' AND ');
  }
  const totalCount = (db.prepare(countQuery).get(...params.slice(0, -2)) as any)?.total || 0;

  res.json({
    success: true,
    logs,
    total: totalCount,
    departmentScoped: !isSuperAdmin,
  });
});

// Summary metrics for Security Dashboard
auditRouter.get('/summary', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');

  let baseWhere = isSuperAdmin ? '' : `WHERE dept_id = '${actor.dept_id}'`;

  const totalActions = (db.prepare(`SELECT COUNT(*) as count FROM audit_logs ${baseWhere}`).get() as any)?.count || 0;
  const deniedAttempts = (db.prepare(`SELECT COUNT(*) as count FROM audit_logs ${baseWhere ? baseWhere + ' AND' : 'WHERE'} status = 'DENIED'`).get() as any)?.count || 0;
  const loginsToday = (db.prepare(`SELECT COUNT(*) as count FROM login_history WHERE date(created_at) = date('now')`).get() as any)?.count || 0;
  const activeSessions = (db.prepare(`SELECT COUNT(*) as count FROM sessions WHERE expires_at > datetime('now')`).get() as any)?.count || 0;

  res.json({
    success: true,
    metrics: {
      totalActions,
      deniedAttempts,
      loginsToday,
      activeSessions,
    },
  });
});
