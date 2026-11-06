import { Router, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const positionsRouter = Router();

// List positions with department name and active assigned employee counts
positionsRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { dept_id } = req.query;

  let query = `
    SELECT p.*,
           d.name_lo as dept_name_lo, d.name_en as dept_name_en, d.code as dept_code,
           (SELECT COUNT(*) FROM users u WHERE u.position_id = p.id AND u.status = 'ACTIVE') as assigned_user_count,
           rp.title_lo as reports_to_title_lo
    FROM positions_v2 p
    LEFT JOIN departments d ON p.dept_id = d.id
    LEFT JOIN positions_v2 rp ON p.reports_to_position_id = rp.id
    WHERE p.is_active = 1
  `;
  const params: any[] = [];

  if (dept_id && dept_id !== 'ALL') {
    query += ' AND (p.dept_id = ? OR (p.dept_id IS NULL AND ? = "EXECUTIVE"))';
    params.push(dept_id, dept_id);
  }

  query += ' ORDER BY p.level ASC, p.code ASC';

  const positions = db.prepare(query).all(...params);

  res.json({
    success: true,
    positions,
  });
});

// Create Position (Super Admin only)
positionsRouter.post('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  if (!actor.roles.includes('SUPER_ADMIN')) {
    res.status(403).json({
      success: false,
      error: 'SUPER_ADMIN_REQUIRED',
      message: 'ສະເພາະ Super Admin ເທົ່ານັ້ນທີ່ສາມາດສ້າງຕຳແໜ່ງງານ (Super Admin required)',
    });
    return;
  }

  const {
    dept_id,
    code,
    title_lo,
    title_en,
    description_lo,
    description_en,
    level = 5,
    max_headcount = 1,
    reports_to_position_id,
  } = req.body;

  if (!code || !title_lo || !title_en) {
    res.status(400).json({
      success: false,
      error: 'MISSING_FIELDS',
      message: 'ກະລຸນາປ້ອນລະຫັດຕຳແໜ່ງ, ຊື່ພາສາລາວ ແລະ ອັງກິດ',
    });
    return;
  }

  const cleanCode = String(code).trim().toUpperCase();

  const existing = db.prepare('SELECT id FROM positions_v2 WHERE code = ?').get(cleanCode);
  if (existing) {
    res.status(400).json({
      success: false,
      error: 'CODE_EXISTS',
      message: 'ລະຫັດຕຳແໜ່ງນີ້ມີຢູ່ໃນລະບົບແລ້ວ',
    });
    return;
  }

  const newId = `pos-${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  db.prepare(`
    INSERT INTO positions_v2 (
      id, org_id, dept_id, code, title_lo, title_en,
      description_lo, description_en, level, max_headcount, reports_to_position_id, is_active
    ) VALUES (?, 'org-lhse-main', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    newId,
    dept_id || null,
    cleanCode,
    title_lo,
    title_en,
    description_lo || null,
    description_en || null,
    Number(level) || 5,
    Number(max_headcount) || 1,
    reports_to_position_id || null
  );

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
    VALUES (?, 'org-lhse-main', ?, ?, ?, 'CREATE_POSITION', 'POSITION', ?, 'SUCCESS', ?, ?)
  `).run(
    `audit-${Date.now()}`,
    dept_id || null,
    actor.id,
    actor.email,
    newId,
    JSON.stringify({ code: cleanCode, title_lo }),
    req.ip || '127.0.0.1'
  );

  res.json({
    success: true,
    message: 'ສ້າງຕຳແໜ່ງງານສຳເລັດແລ້ວ (Position created)',
    id: newId,
  });
});

// Update Position (Super Admin only)
positionsRouter.put('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  if (!actor.roles.includes('SUPER_ADMIN')) {
    res.status(403).json({ success: false, error: 'SUPER_ADMIN_REQUIRED' });
    return;
  }

  const posId = req.params.id;
  const {
    dept_id,
    title_lo,
    title_en,
    description_lo,
    description_en,
    level,
    max_headcount,
    reports_to_position_id,
  } = req.body;

  db.prepare(`
    UPDATE positions_v2
    SET dept_id = ?,
        title_lo = COALESCE(?, title_lo),
        title_en = COALESCE(?, title_en),
        description_lo = ?,
        description_en = ?,
        level = COALESCE(?, level),
        max_headcount = COALESCE(?, max_headcount),
        reports_to_position_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    dept_id || null,
    title_lo,
    title_en,
    description_lo || null,
    description_en || null,
    level,
    max_headcount,
    reports_to_position_id || null,
    posId
  );

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
    VALUES (?, 'org-lhse-main', ?, ?, ?, 'UPDATE_POSITION', 'POSITION', ?, 'SUCCESS', ?, ?)
  `).run(
    `audit-${Date.now()}`,
    dept_id || null,
    actor.id,
    actor.email,
    posId,
    JSON.stringify({ updated: posId }),
    req.ip || '127.0.0.1'
  );

  res.json({
    success: true,
    message: 'ອັບເດດຂໍ້ມູນຕຳແໜ່ງສຳເລັດແລ້ວ',
  });
});

// Deactivate Position
positionsRouter.delete('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  if (!actor.roles.includes('SUPER_ADMIN')) {
    res.status(403).json({ success: false, error: 'SUPER_ADMIN_REQUIRED' });
    return;
  }

  const posId = req.params.id;

  // Check if active users are holding this position
  const activeHolding = (db.prepare('SELECT COUNT(*) as c FROM users WHERE position_id = ? AND status = "ACTIVE"').get(posId) as any)?.c;
  if (activeHolding > 0) {
    res.status(400).json({
      success: false,
      error: 'POSITION_IN_USE',
      message: `ບໍ່ສາມາດລຶບຕຳແໜ່ງນີ້ໄດ້ ເນື່ອງຈາກມີພະນັກງານທີ່ກຳລັງດຳລົງຕຳແໜ່ງຢູ່ ${activeHolding} ທ່ານ`,
    });
    return;
  }

  db.prepare('UPDATE positions_v2 SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(posId);

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
    VALUES (?, 'org-lhse-main', NULL, ?, ?, 'DEACTIVATE_POSITION', 'POSITION', ?, 'SUCCESS', ?, ?)
  `).run(
    `audit-${Date.now()}`,
    actor.id,
    actor.email,
    posId,
    JSON.stringify({ deactivatedPosition: posId }),
    req.ip || '127.0.0.1'
  );

  res.json({
    success: true,
    message: 'ປິດການໃຊ້ງານຕຳແໜ່ງສຳເລັດແລ້ວ',
  });
});
