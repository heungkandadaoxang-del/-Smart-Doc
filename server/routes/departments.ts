import { Router, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const departmentsRouter = Router();

// List departments (Super Admin sees all, Dept Admin sees only their department unless listing summary)
departmentsRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');

  let rows = db.prepare(`
    SELECT d.*,
           u.email as admin_email,
           u.full_name_lo as admin_name_lo,
           u.status as admin_status,
           (SELECT COUNT(*) FROM users u2 WHERE u2.dept_id = d.id) as member_count,
           (SELECT id FROM user_invitations inv WHERE inv.dept_id = d.id AND inv.status = 'PENDING' LIMIT 1) as active_invitation_id
    FROM departments d
    LEFT JOIN users u ON d.head_user_id = u.id
    ORDER BY d.code ASC
  `).all() as any[];

  // If normal staff or dept admin requesting filtered view:
  if (!isSuperAdmin) {
    // Return all departments metadata for select-lists/routing, but mark active department
    rows = rows.map(dept => ({
      ...dept,
      isUserDepartment: dept.id === actor.dept_id,
      canManage: dept.id === actor.dept_id && actor.roles.includes('DEPT_ADMIN'),
    }));
  } else {
    rows = rows.map(dept => ({
      ...dept,
      isUserDepartment: true,
      canManage: true,
    }));
  }

  res.json({
    success: true,
    departments: rows,
  });
});

// Get single department details with strict isolation check
departmentsRouter.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const deptId = req.params.id;
  const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');

  // Enforce department isolation
  if (!isSuperAdmin && actor.dept_id !== deptId) {
    db.prepare(`
      INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
      VALUES (?, ?, ?, ?, ?, 'CROSS_DEPT_READ_BLOCKED', 'DEPARTMENT', ?, 'DENIED', ?, ?)
    `).run(
      `audit-${Date.now()}`,
      actor.org_id,
      actor.dept_id,
      actor.id,
      actor.email,
      deptId,
      JSON.stringify({ reason: 'Attempted to view department details outside own department' }),
      req.ip || '127.0.0.1'
    );

    res.status(403).json({
      success: false,
      error: 'DEPARTMENT_ISOLATION_VIOLATION',
      message: 'ການເຂົ້າເຖິງຖືກປະຕິເສດ: ທ່ານບໍ່ມີສິດເຂົ້າເຖິງຂໍ້ມູນລະອຽດຂອງພະແນກອື່ນ (Unauthorized department access)',
    });
    return;
  }

  const dept = db.prepare(`
    SELECT d.*,
           u.email as admin_email,
           u.full_name_lo as admin_name_lo,
           u.status as admin_status
    FROM departments d
    LEFT JOIN users u ON d.head_user_id = u.id
    WHERE d.id = ?
  `).get(deptId) as any;

  if (!dept) {
    res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'ບໍ່ພົບຂໍ້ມູນພະແນກ' });
    return;
  }

  const members = db.prepare(`
    SELECT id, email, full_name_lo, full_name_en, status, last_login_at
    FROM users WHERE dept_id = ?
  `).all(deptId);

  res.json({
    success: true,
    department: dept,
    members,
  });
});

// Update department details
departmentsRouter.put('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const deptId = req.params.id;
  const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');
  const isDeptAdmin = actor.roles.includes('DEPT_ADMIN');

  if (!isSuperAdmin && (!isDeptAdmin || actor.dept_id !== deptId)) {
    res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'ທ່ານບໍ່ມີສິດແກ້ໄຂຂໍ້ມູນພະແນກນີ້',
    });
    return;
  }

  const { name_lo, name_en, description_lo, description_en, phone, email } = req.body;

  db.prepare(`
    UPDATE departments
    SET name_lo = COALESCE(?, name_lo),
        name_en = COALESCE(?, name_en),
        description_lo = COALESCE(?, description_lo),
        description_en = COALESCE(?, description_en),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name_lo, name_en, description_lo, description_en, phone, email, deptId);

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
    VALUES (?, ?, ?, ?, ?, 'UPDATE_DEPARTMENT', 'DEPARTMENT', ?, 'SUCCESS', ?, ?)
  `).run(
    `audit-${Date.now()}`,
    actor.org_id,
    deptId,
    actor.id,
    actor.email,
    deptId,
    JSON.stringify({ updatedFields: Object.keys(req.body) }),
    req.ip || '127.0.0.1'
  );

  res.json({
    success: true,
    message: 'ອັບເດດຂໍ້ມູນພະແນກສຳເລັດແລ້ວ',
  });
});
