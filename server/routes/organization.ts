import { Router, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const organizationRouter = Router();

// Get Organization Profile
organizationRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get('org-lhse-main');
  res.json({
    success: true,
    organization: org,
  });
});

// Update Organization Profile (Super Admin only)
organizationRouter.put('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  if (!actor.roles.includes('SUPER_ADMIN')) {
    res.status(403).json({
      success: false,
      error: 'SUPER_ADMIN_REQUIRED',
      message: 'ສະເພາະ Super Admin ເທົ່ານັ້ນທີ່ສາມາດແກ້ໄຂຂໍ້ມູນອົງກອນໄດ້',
    });
    return;
  }

  const {
    name_lo,
    name_en,
    short_name,
    tax_id,
    address_lo,
    address_en,
    phone,
    email,
    website,
    logo_url,
  } = req.body;

  db.prepare(`
    UPDATE organizations
    SET name_lo = COALESCE(?, name_lo),
        name_en = COALESCE(?, name_en),
        short_name = COALESCE(?, short_name),
        tax_id = COALESCE(?, tax_id),
        address_lo = COALESCE(?, address_lo),
        address_en = COALESCE(?, address_en),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        website = COALESCE(?, website),
        logo_url = COALESCE(?, logo_url),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 'org-lhse-main'
  `).run(
    name_lo,
    name_en,
    short_name,
    tax_id,
    address_lo,
    address_en,
    phone,
    email,
    website,
    logo_url
  );

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
    VALUES (?, 'org-lhse-main', NULL, ?, ?, 'UPDATE_ORGANIZATION_PROFILE', 'ORGANIZATION', 'org-lhse-main', 'SUCCESS', ?, ?)
  `).run(
    `audit-${Date.now()}`,
    actor.id,
    actor.email,
    JSON.stringify({ updatedFields: Object.keys(req.body) }),
    req.ip || '127.0.0.1'
  );

  const updatedOrg = db.prepare('SELECT * FROM organizations WHERE id = ?').get('org-lhse-main');

  res.json({
    success: true,
    message: 'ອັບເດດຂໍ້ມູນອົງກອນສຳເລັດແລ້ວ',
    organization: updatedOrg,
  });
});
