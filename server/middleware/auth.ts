import { Request, Response, NextFunction } from 'express';
import { db } from '../db.js';
import { hashToken } from '../auth.js';
import { User, RoleCode } from '../../src/types/index.js';

export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionId?: string;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.headers['x-session-token']) {
      token = String(req.headers['x-session-token']).trim();
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'ກະລຸນາເຂົ້າສູ່ລະບົບກ່ອນດຳເນີນການ (Authentication token missing)',
      });
      return;
    }

    const tokenHash = hashToken(token);
    const session = db.prepare(`
      SELECT s.id, s.user_id, s.mfa_verified, s.expires_at,
             u.id as u_id, u.org_id, u.dept_id, u.position_id, u.email,
             u.full_name_lo, u.full_name_en, u.phone, u.avatar_url,
             u.status, u.must_change_password, u.mfa_enabled, u.last_login_at,
             u.created_at, u.updated_at,
             d.name_lo as dept_name_lo, d.name_en as dept_name_en, d.code as dept_code
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN departments d ON u.dept_id = d.id
      WHERE s.token_hash = ?
    `).get(tokenHash) as any;

    if (!session) {
      res.status(401).json({
        success: false,
        error: 'INVALID_SESSION',
        message: 'ເຊດຊັນບໍ່ຖືກຕ້ອງ ຫຼື ໝົດອາຍຸແລ້ວ (Invalid or expired session)',
      });
      return;
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
      res.status(401).json({
        success: false,
        error: 'SESSION_EXPIRED',
        message: 'ເຊດຊັນໝົດອາຍຸແລ້ວ ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່ (Session expired)',
      });
      return;
    }

    if (session.status !== 'ACTIVE') {
      res.status(403).json({
        success: false,
        error: 'ACCOUNT_INACTIVE',
        message: 'ບັນຊີຂອງທ່ານຖືກໂຈະ ຫຼື ຍັງບໍ່ໄດ້ເປີດໃຊ້ງານ (Account is suspended or locked)',
      });
      return;
    }

    // Touch last_active_at
    db.prepare('UPDATE sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?').run(session.id);

    // Fetch user roles
    const rolesRows = db.prepare(`
      SELECT r.code FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
    `).all(session.u_id) as { code: RoleCode }[];
    const roles = rolesRows.map(r => r.code);

    // Fetch user permissions
    const permsRows = db.prepare(`
      SELECT DISTINCT p.code FROM user_roles ur
      JOIN role_permissions rp ON ur.role_id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = ?
    `).all(session.u_id) as { code: string }[];
    const permissions = permsRows.map(p => p.code);

    req.user = {
      id: session.u_id,
      org_id: session.org_id,
      dept_id: session.dept_id,
      position_id: session.position_id,
      email: session.email,
      full_name_lo: session.full_name_lo,
      full_name_en: session.full_name_en,
      phone: session.phone,
      avatar_url: session.avatar_url,
      status: session.status,
      must_change_password: Boolean(session.must_change_password),
      mfa_enabled: Boolean(session.mfa_enabled),
      last_login_at: session.last_login_at,
      created_at: session.created_at,
      updated_at: session.updated_at,
      roles,
      permissions,
      dept_name_lo: session.dept_name_lo,
      dept_name_en: session.dept_name_en,
      dept_code: session.dept_code,
    };
    req.sessionId = session.id;

    next();
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'AUTH_ERROR',
      message: 'ເກີດຂໍ້ຜິດພາດໃນການກວດສອບສິດທິ (Authentication server error)',
    });
  }
}

// Require one of specific roles (e.g. SUPER_ADMIN)
export function requireRole(...allowedRoles: RoleCode[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
      return;
    }
    const hasRole = req.user.roles.some((r: RoleCode) => allowedRoles.includes(r));
    if (!hasRole) {
      // Log denied attempt in audit log
      db.prepare(`
        INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, status, details, ip_address)
        VALUES (?, ?, ?, ?, ?, 'ROLE_ACCESS_DENIED', 'ROUTE', 'DENIED', ?, ?)
      `).run(
        `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        req.user.org_id,
        req.user.dept_id,
        req.user.id,
        req.user.email,
        JSON.stringify({ path: req.originalUrl, requiredRoles: allowedRoles, userRoles: req.user.roles }),
        req.ip || '127.0.0.1'
      );

      res.status(403).json({
        success: false,
        error: 'FORBIDDEN_ROLE',
        message: 'ທ່ານບໍ່ມີສິດໃນການເຂົ້າເຖິງພາກສ່ວນນີ້ (Role permission required: ' + allowedRoles.join(', ') + ')',
      });
      return;
    }
    next();
  };
}

// Enforce strict Department Isolation: Super Admin allowed everywhere, others strictly locked to their dept_id
export function enforceDepartmentIsolation(getTargetDeptId: (req: AuthenticatedRequest) => string | undefined | null) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
      return;
    }

    // Super Admin has enterprise-wide oversight
    if (req.user.roles.includes('SUPER_ADMIN')) {
      return next();
    }

    const targetDeptId = getTargetDeptId(req);

    // If target dept is specified and differs from user's dept_id, BLOCK
    if (targetDeptId && targetDeptId !== req.user.dept_id) {
      db.prepare(`
        INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
        VALUES (?, ?, ?, ?, ?, 'CROSS_DEPARTMENT_ACCESS_BLOCKED', 'DEPARTMENT', ?, 'DENIED', ?, ?)
      `).run(
        `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        req.user.org_id,
        req.user.dept_id,
        req.user.id,
        req.user.email,
        targetDeptId,
        JSON.stringify({
          violation: 'Attempted cross-department access without authorization',
          userDept: req.user.dept_id,
          targetDept: targetDeptId,
          endpoint: req.originalUrl,
          method: req.method,
        }),
        req.ip || '127.0.0.1'
      );

      res.status(403).json({
        success: false,
        error: 'DEPARTMENT_ISOLATION_VIOLATION',
        message: 'ການເຂົ້າເຖິງຖືກປະຕິເສດ: ທ່ານບໍ່ມີສິດເຂົ້າເຖິງຂໍ້ມູນ ຫຼື ບຸກຄະລາກອນຂອງພະແນກອື່ນ (Cross-department access strictly prohibited)',
      });
      return;
    }

    next();
  };
}
