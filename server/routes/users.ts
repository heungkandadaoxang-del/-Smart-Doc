import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { hashPassword } from '../auth.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { User, RoleCode } from '../../src/types/index.js';

export const usersRouter = Router();

// List users with department scoping
usersRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const isSuperAdmin = user.roles.includes('SUPER_ADMIN');
  const isDeptAdmin = user.roles.includes('DEPT_ADMIN');

  if (!isSuperAdmin && !isDeptAdmin) {
    res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'ທ່ານບໍ່ມີສິດເຂົ້າເຖິງການຈັດການຜູ້ໃຊ້ງານ (Insufficient permissions)',
    });
    return;
  }

  // Requested filter by department
  const filterDeptId = req.query.dept_id as string | undefined;

  // Department isolation check: Department Admin can NEVER filter or see another department
  if (isDeptAdmin && !isSuperAdmin) {
    if (filterDeptId && filterDeptId !== user.dept_id) {
      // Log isolation breach attempt
      db.prepare(`
        INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
        VALUES (?, ?, ?, ?, ?, 'CROSS_DEPARTMENT_USER_LIST_BLOCKED', 'USER', ?, 'DENIED', ?, ?)
      `).run(
        `audit-${Date.now()}`,
        user.org_id,
        user.dept_id,
        user.id,
        user.email,
        filterDeptId,
        JSON.stringify({ attemptedDept: filterDeptId, actualDept: user.dept_id }),
        req.ip || '127.0.0.1'
      );

      res.status(403).json({
        success: false,
        error: 'DEPARTMENT_ISOLATION_VIOLATION',
        message: 'ການເຂົ້າເຖິງຖືກປະຕິເສດ: ທ່ານບໍ່ສາມາດເບິ່ງຜູ້ໃຊ້ຂອງພະແນກອື່ນໄດ້ (Cannot access other department users)',
      });
      return;
    }
  }

  const effectiveDeptId = isSuperAdmin ? (filterDeptId || null) : user.dept_id;

  let query = `
    SELECT u.id, u.org_id, u.dept_id, u.position_id, u.email,
           u.full_name_lo, u.full_name_en, u.phone, u.avatar_url,
           u.status, u.must_change_password, u.mfa_enabled, u.last_login_at,
           u.created_at, u.updated_at,
           d.name_lo as dept_name_lo, d.name_en as dept_name_en, d.code as dept_code,
           p.title_lo as position_title_lo, p.title_en as position_title_en
    FROM users u
    LEFT JOIN departments d ON u.dept_id = d.id
    LEFT JOIN positions p ON u.position_id = p.id
  `;

  const params: any[] = [];
  if (effectiveDeptId) {
    query += ' WHERE u.dept_id = ?';
    params.push(effectiveDeptId);
  }
  query += ' ORDER BY u.created_at DESC';

  const rows = db.prepare(query).all(...params) as any[];

  // Attach roles for each user
  const usersWithRoles = rows.map(r => {
    const rolesRows = db.prepare(`
      SELECT r.code FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?
    `).all(r.id) as { code: RoleCode }[];

    return {
      ...r,
      must_change_password: Boolean(r.must_change_password),
      mfa_enabled: Boolean(r.mfa_enabled),
      roles: rolesRows.map(x => x.code),
    };
  });

  res.json({
    success: true,
    users: usersWithRoles,
    departmentScoped: !isSuperAdmin,
    scopeDepartmentId: effectiveDeptId,
  });
});

// Create new user (Super Admin can create any, Dept Admin can only create within their department)
usersRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');
  const isDeptAdmin = actor.roles.includes('DEPT_ADMIN');

  if (!isSuperAdmin && !isDeptAdmin) {
    res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'ທ່ານບໍ່ມີສິດສ້າງຜູ້ໃຊ້ງານ (Insufficient permissions)',
    });
    return;
  }

  const {
    email,
    password,
    full_name_lo,
    full_name_en,
    dept_id,
    position_title_lo,
    phone,
    role_code,
  } = req.body;

  if (!email || !password || !full_name_lo) {
    res.status(400).json({
      success: false,
      error: 'MISSING_FIELDS',
      message: 'ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບຖ້ວນ (Email, password, and Lao name are required)',
    });
    return;
  }

  // Enforce department boundary for Dept Admin
  let targetDeptId = dept_id;
  if (isDeptAdmin && !isSuperAdmin) {
    if (dept_id && dept_id !== actor.dept_id) {
      res.status(403).json({
        success: false,
        error: 'DEPARTMENT_ISOLATION_VIOLATION',
        message: 'ທ່ານສາມາດເພີ່ມພະນັກງານສະເພາະພະແນກຂອງທ່ານເອງເທົ່ານັ້ນ (Can only create users in your department)',
      });
      return;
    }
    targetDeptId = actor.dept_id;

    // Dept Admin cannot create Super Admin or Dept Admin
    if (role_code === 'SUPER_ADMIN' || role_code === 'DEPT_ADMIN') {
      res.status(403).json({
        success: false,
        error: 'CANNOT_ASSIGN_PRIVILEGED_ROLE',
        message: 'ທ່ານບໍ່ສາມາດກຳນົດສິດລະດັບສູງນີ້ໄດ້ (Cannot assign privileged role)',
      });
      return;
    }
  }

  const cleanEmail = String(email).trim().toLowerCase();

  // Check unique email
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(cleanEmail);
  if (existing) {
    res.status(400).json({
      success: false,
      error: 'EMAIL_ALREADY_EXISTS',
      message: 'ອີເມວນີ້ມີຢູ່ໃນລະບົບແລ້ວ (Email is already registered)',
    });
    return;
  }

  const newUserId = `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const passwordHash = await hashPassword(password);

  db.prepare(`
    INSERT INTO users (
      id, org_id, dept_id, email, password_hash, full_name_lo, full_name_en, phone,
      status, must_change_password
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1)
  `).run(
    newUserId,
    actor.org_id,
    targetDeptId || null,
    cleanEmail,
    passwordHash,
    full_name_lo,
    full_name_en || full_name_lo,
    phone || null
  );

  // Assign Role
  const roleCodeToAssign = role_code || 'DEPT_STAFF';
  const roleRow = db.prepare('SELECT id FROM roles WHERE code = ?').get(roleCodeToAssign) as any;
  if (roleRow) {
    db.prepare(`
      INSERT INTO user_roles (user_id, role_id, assigned_by)
      VALUES (?, ?, ?)
    `).run(newUserId, roleRow.id, actor.id);
  }

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
    VALUES (?, ?, ?, ?, ?, 'CREATE_USER', 'USER', ?, 'SUCCESS', ?, ?)
  `).run(
    `audit-${Date.now()}`,
    actor.org_id,
    targetDeptId,
    actor.id,
    actor.email,
    newUserId,
    JSON.stringify({ createdEmail: cleanEmail, role: roleCodeToAssign, deptId: targetDeptId }),
    req.ip || '127.0.0.1'
  );

  res.json({
    success: true,
    userId: newUserId,
    message: 'ສ້າງຜູ້ໃຊ້ງານໃໝ່ສຳເລັດແລ້ວ (User created successfully)',
  });
});

// Activate Department Admin by Super Admin (Assign official email & initial credentials)
usersRouter.post('/activate-dept-admin', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  if (!actor.roles.includes('SUPER_ADMIN')) {
    res.status(403).json({
      success: false,
      error: 'SUPER_ADMIN_REQUIRED',
      message: 'ສະເພາະ Super Admin ເທົ່ານັ້ນທີ່ສາມາດເປີດນຳໃຊ້ບັນຊີຫົວໜ້າພະແນກ (Super Admin access required)',
    });
    return;
  }

  const { dept_id, official_email, full_name_en, initial_password, phone } = req.body;

  if (!dept_id || !official_email || !initial_password) {
    res.status(400).json({
      success: false,
      error: 'MISSING_FIELDS',
      message: 'ກະລຸນາລະບົບພະແນກ, ອີເມວທາງການ ແລະ ລະຫັດຜ່ານເລີ່ມຕົ້ນ (Department, official email, and initial password are required)',
    });
    return;
  }

  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(dept_id) as any;
  if (!dept) {
    res.status(404).json({ success: false, error: 'DEPT_NOT_FOUND', message: 'ບໍ່ພົບຂໍ້ມູນພະແນກ (Department not found)' });
    return;
  }

  const cleanEmail = String(official_email).trim().toLowerCase();

  // Check email
  const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(cleanEmail);
  if (existingUser) {
    res.status(400).json({
      success: false,
      error: 'EMAIL_EXISTS',
      message: 'ອີເມວນີ້ມີຢູ່ໃນລະບົບແລ້ວ (Email already registered)',
    });
    return;
  }

  const newAdminId = `user-admin-${dept.code.toLowerCase()}`;
  const passwordHash = await hashPassword(initial_password);

  // Insert User
  db.prepare(`
    INSERT INTO users (
      id, org_id, dept_id, email, password_hash, full_name_lo, full_name_en, phone,
      status, must_change_password
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1)
  `).run(
    newAdminId,
    actor.org_id,
    dept.id,
    cleanEmail,
    passwordHash,
    dept.designated_admin_name,
    full_name_en || dept.designated_admin_name,
    phone || null
  );

  // Assign DEPT_ADMIN role
  const roleDeptAdmin = db.prepare("SELECT id FROM roles WHERE code = 'DEPT_ADMIN'").get() as any;
  if (roleDeptAdmin) {
    db.prepare('INSERT OR REPLACE INTO user_roles (user_id, role_id, assigned_by) VALUES (?, ?, ?)')
      .run(newAdminId, roleDeptAdmin.id, actor.id);
  }

  // Update department head_user_id
  db.prepare('UPDATE departments SET head_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(newAdminId, dept.id);

  // Mark pending invitation as accepted
  db.prepare(`
    UPDATE user_invitations 
    SET status = 'ACCEPTED', accepted_at = CURRENT_TIMESTAMP, email = ?
    WHERE dept_id = ? AND role_id = ?
  `).run(cleanEmail, dept.id, roleDeptAdmin.id);

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
    VALUES (?, ?, ?, ?, ?, 'ACTIVATE_DEPARTMENT_ADMIN', 'DEPARTMENT', ?, 'SUCCESS', ?, ?)
  `).run(
    `audit-${Date.now()}`,
    actor.org_id,
    dept.id,
    actor.id,
    actor.email,
    dept.id,
    JSON.stringify({
      deptName: dept.name_lo,
      designatedName: dept.designated_admin_name,
      assignedEmail: cleanEmail,
      userId: newAdminId,
    }),
    req.ip || '127.0.0.1'
  );

  res.json({
    success: true,
    message: `ເປີດນຳໃຊ້ບັນຊີຫົວໜ້າ ${dept.name_lo} (${dept.designated_admin_name}) ສຳເລັດແລ້ວ!`,
    userId: newAdminId,
  });
});

// Suspend or Reactivate User
usersRouter.patch('/:id/status', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const targetUserId = req.params.id;
  const { status } = req.body;

  if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
    res.status(400).json({ success: false, error: 'INVALID_STATUS', message: 'ສະຖານະບໍ່ຖືກຕ້ອງ' });
    return;
  }

  const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId) as any;
  if (!targetUser) {
    res.status(404).json({ success: false, error: 'USER_NOT_FOUND', message: 'ບໍ່ພົບຜູ້ໃຊ້' });
    return;
  }

  const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');
  const isDeptAdmin = actor.roles.includes('DEPT_ADMIN');

  if (!isSuperAdmin) {
    if (!isDeptAdmin || targetUser.dept_id !== actor.dept_id) {
      res.status(403).json({
        success: false,
        error: 'DEPARTMENT_ISOLATION_VIOLATION',
        message: 'ທ່ານບໍ່ມີສິດຈັດການຜູ້ໃຊ້ຕ່າງພະແນກ (Cannot manage users in another department)',
      });
      return;
    }
  }

  // Prevent suspending Super Admin
  if (targetUser.email === 'nokohn@gmail.com') {
    res.status(400).json({
      success: false,
      error: 'CANNOT_SUSPEND_SUPER_ADMIN',
      message: 'ບໍ່ສາມາດໂຈະບັນຊີ Super Admin ຫຼັກໄດ້',
    });
    return;
  }

  db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, targetUserId);

  // If suspended, invalidate all active sessions
  if (status === 'SUSPENDED') {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetUserId);
  }

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
    VALUES (?, ?, ?, ?, ?, 'UPDATE_USER_STATUS', 'USER', ?, 'SUCCESS', ?, ?)
  `).run(
    `audit-${Date.now()}`,
    actor.org_id,
    targetUser.dept_id,
    actor.id,
    actor.email,
    targetUserId,
    JSON.stringify({ oldStatus: targetUser.status, newStatus: status, targetEmail: targetUser.email }),
    req.ip || '127.0.0.1'
  );

  res.json({
    success: true,
    message: status === 'ACTIVE' ? 'ເປີດໃຊ້ງານບັນຊີຄືນໃໝ່ສຳເລັດ' : 'ໂຈະການໃຊ້ງານບັນຊີຮຽບຮ້ອຍແລ້ວ',
  });
});

// Reset User Password
usersRouter.post('/:id/reset-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const targetUserId = req.params.id;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    res.status(400).json({
      success: false,
      error: 'WEAK_PASSWORD',
      message: 'ລະຫັດຜ່ານໃໝ່ຕ້ອງມີຢ່າງໜ້ອຍ 8 ຕົວອັກສອນ',
    });
    return;
  }

  const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId) as any;
  if (!targetUser) {
    res.status(404).json({ success: false, error: 'USER_NOT_FOUND', message: 'ບໍ່ພົບຜູ້ໃຊ້' });
    return;
  }

  const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');
  const isDeptAdmin = actor.roles.includes('DEPT_ADMIN');

  if (!isSuperAdmin) {
    if (!isDeptAdmin || targetUser.dept_id !== actor.dept_id) {
      res.status(403).json({
        success: false,
        error: 'DEPARTMENT_ISOLATION_VIOLATION',
        message: 'ທ່ານບໍ່ສາມາດຣີເຊັດລະຫັດຜ່ານຂອງພະນັກງານພະແນກອື່ນໄດ້',
      });
      return;
    }
  }

  const hash = await hashPassword(newPassword);
  db.prepare(`
    UPDATE users SET password_hash = ?, must_change_password = 1, failed_login_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(hash, targetUserId);

  // Invalidate old sessions
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetUserId);

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
    VALUES (?, ?, ?, ?, ?, 'RESET_USER_PASSWORD', 'USER', ?, 'SUCCESS', ?, ?)
  `).run(
    `audit-${Date.now()}`,
    actor.org_id,
    targetUser.dept_id,
    actor.id,
    actor.email,
    targetUserId,
    JSON.stringify({ targetEmail: targetUser.email, forcedChange: true }),
    req.ip || '127.0.0.1'
  );

  res.json({
    success: true,
    message: 'ຣີເຊັດລະຫັດຜ່ານສຳເລັດ (ຜູ້ໃຊ້ຈະຕ້ອງປ່ຽນລະຫັດເມື່ອເຂົ້າສູ່ລະບົບຄັ້ງຕໍ່ໄປ)',
  });
});
