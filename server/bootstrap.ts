import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db } from './db.js';
import { hashPassword } from './auth.js';

export interface BootstrapResult {
  isFirstRun: boolean;
  superAdminEmail: string;
  temporaryPasswordGenerated?: string;
  departmentsCreated: number;
}

export async function runBootstrap(): Promise<BootstrapResult> {
  const result: BootstrapResult = {
    isFirstRun: false,
    superAdminEmail: 'nokohn@gmail.com',
    departmentsCreated: 0,
  };

  // 1. Seed Organization (Lao State Enterprise Holding)
  const orgId = 'org-lhse-main';
  const orgCheck = db.prepare('SELECT id FROM organizations WHERE id = ?').get(orgId);
  if (!orgCheck) {
    db.prepare(`
      INSERT INTO organizations (
        id, name_lo, name_en, short_name, tax_id, address_lo, address_en, phone, email, website, timezone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orgId,
      'ລັດວິສາຫະກິດຖືຮຸ້ນລາວ',
      'Lao State Enterprise Holding',
      'LHSE',
      '01-00023489',
      'ຖະໜົນລ້ານຊ້າງ, ບ້ານຫັດສະດີ, ເມືອງຈັນທະບູລີ, ນະຄອນຫຼວງວຽງຈັນ',
      'Lane Xang Avenue, Hatsady Village, Chanthabouly District, Vientiane Capital',
      '+856 21 213 456',
      'info@lhse.gov.la',
      'https://lhse.gov.la',
      'Asia/Vientiane'
    );
  }

  // 2. Seed Permissions
  const permissions = [
    { code: 'doc:view', cat: 'DOCUMENT', lo: 'ເບິ່ງເອກະສານ', en: 'View Documents' },
    { code: 'doc:create', cat: 'DOCUMENT', lo: 'ສ້າງເອກະສານ', en: 'Create Documents' },
    { code: 'doc:edit', cat: 'DOCUMENT', lo: 'ແກ້ໄຂເອກະສານ', en: 'Edit Documents' },
    { code: 'doc:delete', cat: 'DOCUMENT', lo: 'ລຶບເອກະສານ', en: 'Delete Documents' },
    { code: 'doc:submit', cat: 'DOCUMENT', lo: 'ສົ່ງເອກະສານ', en: 'Submit Documents' },
    { code: 'doc:approve', cat: 'WORKFLOW', lo: 'ອະນຸມັດເອກະສານ', en: 'Approve Documents' },
    { code: 'doc:reject', cat: 'WORKFLOW', lo: 'ປະຕິເສດເອກະສານ', en: 'Reject Documents' },
    { code: 'doc:assign', cat: 'WORKFLOW', lo: 'ມອບໝາຍວຽກ', en: 'Assign Tasks' },
    { code: 'doc:download', cat: 'DOCUMENT', lo: 'ດາວໂຫຼດເອກະສານ', en: 'Download Files' },
    { code: 'doc:export', cat: 'REPORT', lo: 'ສົ່ງອອກຂໍ້ມູນ', en: 'Export Reports' },
    { code: 'users:manage', cat: 'ADMIN', lo: 'ຈັດການຜູ້ໃຊ້ງານ', en: 'Manage Users' },
    { code: 'dept:manage', cat: 'ADMIN', lo: 'ຈັດການພະແນກ', en: 'Manage Department' },
    { code: 'audit:view', cat: 'SECURITY', lo: 'ເບິ່ງບັນທຶກຄວາມປອດໄພ', en: 'View Audit Logs' },
    { code: 'settings:manage', cat: 'ADMIN', lo: 'ຕັ້ງຄ່າລະບົບ', en: 'Manage Settings' },
  ];

  const insertPerm = db.prepare(`
    INSERT OR IGNORE INTO permissions (id, code, category, name_lo, name_en)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const p of permissions) {
    insertPerm.run(`perm-${p.code.replace(':', '-')}`, p.code, p.cat, p.lo, p.en);
  }

  // 3. Seed Standard Roles
  const roles = [
    {
      id: 'role-super-admin',
      code: 'SUPER_ADMIN',
      lo: 'ຜູ້ບໍລິຫານລະບົບສູງສຸດ',
      en: 'Super Admin',
      desc_lo: 'ສິດທິສູງສຸດໃນການຄຸ້ມຄອງລະບົບ ແລະ ກວດສອບທົ່ວອົງກອນ',
      desc_en: 'Full enterprise-wide access subject to audit policies',
      perms: permissions.map(p => p.code),
    },
    {
      id: 'role-dept-admin',
      code: 'DEPT_ADMIN',
      lo: 'ຫົວໜ້າພະແນກ / ຜູ້ຄຸ້ມຄອງພະແນກ',
      en: 'Department Admin',
      desc_lo: 'ຄຸ້ມຄອງ ແລະ ອະນຸມັດເອກະສານສະເພາະພາຍໃນພະແນກຕົນເອງ',
      desc_en: 'Manages users and document approvals strictly within assigned department',
      perms: [
        'doc:view', 'doc:create', 'doc:edit', 'doc:delete', 'doc:submit',
        'doc:approve', 'doc:reject', 'doc:assign', 'doc:download', 'doc:export', 'dept:manage'
      ],
    },
    {
      id: 'role-dept-staff',
      code: 'DEPT_STAFF',
      lo: 'ພະນັກງານພະແນກ',
      en: 'Department Staff',
      desc_lo: 'ຮ່າງ, ສົ່ງ ແລະ ຕິດຕາມເອກະສານພາຍໃນພະແນກຕົນເອງ',
      desc_en: 'Creates, drafts and submits documents strictly within department',
      perms: ['doc:view', 'doc:create', 'doc:edit', 'doc:submit', 'doc:download'],
    },
    {
      id: 'role-approver',
      code: 'APPROVER',
      lo: 'ຜູ້ອະນຸມັດ / ກວດສອບ',
      en: 'Document Approver',
      desc_lo: 'ກວດສອບ, ອະນຸມັດ ຫຼື ປະຕິເສດເອກະສານຕາມສາຍງານ',
      desc_en: 'Reviews, approves and signs documents assigned to them',
      perms: ['doc:view', 'doc:approve', 'doc:reject', 'doc:download'],
    },
    {
      id: 'role-executive-viewer',
      code: 'EXECUTIVE_VIEWER',
      lo: 'ຜູ້ບໍລິຫານລະດັບສູງ (ກວດເບິ່ງ)',
      en: 'Executive Viewer',
      desc_lo: 'ເບິ່ງລາຍງານ, Dashboard ແລະ ສະຖິຕິພາບລວມທົ່ວອົງກອນ (ອ່ານຢ່າງດຽວ)',
      desc_en: 'Read-only access to organizational analytics, reports and dashboards',
      perms: ['doc:view', 'doc:download', 'doc:export'],
    },
  ];

  const insertRole = db.prepare(`
    INSERT OR IGNORE INTO roles (id, code, name_lo, name_en, description_lo, description_en, is_system)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);
  const insertRolePerm = db.prepare(`
    INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
    VALUES (?, (SELECT id FROM permissions WHERE code = ?))
  `);

  for (const r of roles) {
    insertRole.run(r.id, r.code, r.lo, r.en, r.desc_lo, r.desc_en);
    for (const p of r.perms) {
      insertRolePerm.run(r.id, p);
    }
  }

  // 4. Seed The 5 Approved LHSE Departments & Pending Admin Assignments
  const departments = [
    {
      id: 'dept-adm-fin',
      code: 'ADM_FIN',
      name_lo: 'ພະແນກບໍລິຫານ ບັນຊີ ແລະ ການເງິນ',
      name_en: 'Administration, Accounting & Finance Department',
      admin_name: 'ນາງ ທິບດາວອນ',
      desc_lo: 'ຄຸ້ມຄອງວຽກງານບໍລິຫານທົ່ວໄປ, ບັນຊີ, ການເງິນ ແລະ ງົບປະມານ',
      desc_en: 'General administration, accounting, corporate finance and budgeting',
    },
    {
      id: 'dept-dev',
      code: 'DEV',
      name_lo: 'ພະແນກພັດທະນາ',
      name_en: 'Development Department',
      admin_name: 'ນາງ ໜິງ',
      desc_lo: 'ວຽກງານພັດທະນາໂຄງການລົງທຶນ, ພະລັງງານ ແລະ ຍຸດທະສາດການເຕີບໂຕ',
      desc_en: 'Investment projects, power asset development and strategic growth',
    },
    {
      id: 'dept-bus-plan',
      code: 'BUS_PLAN',
      name_lo: 'ພະແນກທຸລະກິດແຜນການ',
      name_en: 'Business Planning Department',
      admin_name: 'ສຸພາລັກ',
      desc_lo: 'ວຽກງານວາງແຜນທຸລະກິດ, ຕິດຕາມປະເມີນຜົນ ແລະ ການຮ່ວມທຶນ',
      desc_en: 'Business planning, performance monitoring and joint venture coordination',
    },
    {
      id: 'dept-fly-ash',
      code: 'FLY_ASH',
      name_lo: 'ພະແນກທຸລະກິດຂີ້ເທົ່າລອຍ',
      name_en: 'Fly Ash Business Department',
      admin_name: 'ທ້າວ ກິລິນທອນ',
      desc_lo: 'ຄຸ້ມຄອງທຸລະກິດຈຳໜ່າຍຜະລິດຕະພັນຂີ້ເທົ່າລອຍ ແລະ ສັນຍາການຄ້າ',
      desc_en: 'Fly ash commercial operations, product distribution and trade agreements',
    },
    {
      id: 'dept-int-audit',
      code: 'INT_AUDIT',
      name_lo: 'ພະແນກກວດສອບພາຍໃນ',
      name_en: 'Internal Audit Department',
      admin_name: 'ທ້າວ ວິລະປັນຍາ',
      desc_lo: 'ກວດສອບຄວາມຖືກຕ້ອງ, ປະຕິບັດຕາມລະບຽບການ ແລະ ການຄຸ້ມຄອງຄວາມສ່ຽງ',
      desc_en: 'Internal compliance audit, financial verification and risk governance',
    },
  ];

  const insertDept = db.prepare(`
    INSERT OR IGNORE INTO departments (
      id, org_id, code, name_lo, name_en, description_lo, description_en, designated_admin_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertInvitation = db.prepare(`
    INSERT OR IGNORE INTO user_invitations (
      id, org_id, dept_id, role_id, designated_name, token_hash, status, invited_by, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
  `);

  const oneYearLater = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  for (const d of departments) {
    insertDept.run(d.id, orgId, d.code, d.name_lo, d.name_en, d.desc_lo, d.desc_en, d.admin_name);
    result.departmentsCreated++;

    // Seed pending invitation if not already created
    const existingInvite = db.prepare('SELECT id FROM user_invitations WHERE dept_id = ?').get(d.id);
    if (!existingInvite) {
      const inviteToken = crypto.randomBytes(24).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');
      insertInvitation.run(
        `inv-${d.code.toLowerCase()}`,
        orgId,
        d.id,
        'role-dept-admin',
        d.admin_name,
        tokenHash,
        'SYSTEM_BOOTSTRAP',
        oneYearLater
      );
    }
  }

  // 5. Seed Initial Super Admin Idempotently
  const superAdminEmail = 'nokohn@gmail.com';
  const existingSuperAdmin = db.prepare('SELECT id, status, must_change_password FROM users WHERE email = ?').get(superAdminEmail) as any;

  if (!existingSuperAdmin) {
    // Generate secure temporary bootstrap password if not in env
    const tempPassword = process.env.INITIAL_ADMIN_PASSWORD || `LHSE#${crypto.randomBytes(5).toString('hex').toUpperCase()}!9`;
    const passwordHash = await hashPassword(tempPassword);
    const superAdminId = 'user-superadmin-001';

    db.prepare(`
      INSERT INTO users (
        id, org_id, dept_id, email, password_hash, full_name_lo, full_name_en,
        status, must_change_password, mfa_enabled
      ) VALUES (?, ?, NULL, ?, ?, ?, ?, 'ACTIVE', 1, 0)
    `).run(
      superAdminId,
      orgId,
      superAdminEmail,
      passwordHash,
      'ຜູ້ບໍລິຫານລະບົບ LHSE (Super Admin)',
      'LHSE Super Administrator'
    );

    // Assign SUPER_ADMIN role
    db.prepare(`
      INSERT OR IGNORE INTO user_roles (user_id, role_id, assigned_by)
      VALUES (?, 'role-super-admin', 'SYSTEM_BOOTSTRAP')
    `).run(superAdminId);

    // Record audit log for bootstrap
    db.prepare(`
      INSERT INTO audit_logs (
        id, org_id, actor_email, action, entity_type, entity_id, status, details
      ) VALUES (?, ?, ?, 'BOOTSTRAP_INITIAL_ADMIN', 'USER', ?, 'SUCCESS', ?)
    `).run(
      `audit-${Date.now()}-001`,
      orgId,
      'SYSTEM',
      superAdminId,
      JSON.stringify({
        event: 'Super Admin bootstrapped with temporary one-time password',
        email: superAdminEmail,
        mustChangePassword: true,
      })
    );

    result.isFirstRun = true;
    result.temporaryPasswordGenerated = tempPassword;

    // Securely persist bootstrap notice locally in gitignored file for verification
    const credentialNoticePath = path.resolve(process.cwd(), 'secure_bootstrap_credential.json');
    fs.writeFileSync(
      credentialNoticePath,
      JSON.stringify(
        {
          notice: 'ONE-TIME TEMPORARY BOOTSTRAP CREDENTIAL FOR SUPER ADMIN',
          superAdminEmail,
          temporaryBootstrapPassword: tempPassword,
          instruction: 'Login with this temporary password. The system will immediately require changing the password and setting up MFA.',
          createdAt: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf-8'
    );

    // Store in system_settings as a one-time setup flag (without storing plaintext password)
    db.prepare(`
      INSERT OR REPLACE INTO system_settings (key, value, description, is_public)
      VALUES ('BOOTSTRAP_COMPLETED_AT', ?, 'Timestamp of initial system bootstrap', 0)
    `).run(new Date().toISOString());

    db.prepare(`
      INSERT OR REPLACE INTO system_settings (key, value, description, is_public)
      VALUES ('BOOTSTRAP_SUPER_ADMIN_INITIALIZED', 'true', 'Super Admin identity provisioned', 1)
    `).run();
  }

  // 6. Seed Phase 2 Three-Tier Organizational Positions
  const seedPositions = [
    // Tier 1: Executive Directorate
    { id: 'pos-md', dept_id: null, code: 'EXEC_MD', lo: 'ຜູ້ອຳນວຍການໃຫຍ່', en: 'Managing Director', level: 1, max: 1 },
    { id: 'pos-dmd-adm', dept_id: null, code: 'EXEC_DMD_ADM', lo: 'ຮອງຜູ້ອຳນວຍການໃຫຍ່ ສາຍງານບໍລິຫານ & ການເງິນ', en: 'Deputy Managing Director (Admin & Finance)', level: 2, max: 1 },
    { id: 'pos-dmd-biz', dept_id: null, code: 'EXEC_DMD_BIZ', lo: 'ຮອງຜູ້ອຳນວຍການໃຫຍ່ ສາຍງານທຸລະກິດ & ພັດທະນາ', en: 'Deputy Managing Director (Business & Dev)', level: 2, max: 1 },
    
    // Tier 2 & 3: Department Positions (5 Departments)
    // 1. Administration, Accounting & Finance
    { id: 'pos-head-adm-fin', dept_id: 'dept-adm-fin', code: 'HEAD_ADM_FIN', lo: 'ຫົວໜ້າພະແນກບໍລິຫານ ບັນຊີ ແລະ ການເງິນ', en: 'Head of Administration, Accounting & Finance', level: 3, max: 1 },
    { id: 'pos-dep-adm-fin', dept_id: 'dept-adm-fin', code: 'DEP_ADM_FIN', lo: 'ຮອງຫົວໜ້າພະແນກບໍລິຫານ ບັນຊີ ແລະ ການເງິນ', en: 'Deputy Head of Administration & Finance', level: 4, max: 2 },
    { id: 'pos-acc-adm-fin', dept_id: 'dept-adm-fin', code: 'SPEC_ACC', lo: 'ຫົວໜ້າຂະແໜງບັນຊີ-ການເງິນ', en: 'Senior Accounting & Finance Specialist', level: 5, max: 3 },
    { id: 'pos-off-adm-fin', dept_id: 'dept-adm-fin', code: 'OFF_ADM', lo: 'ວິຊາການບໍລິຫານທົ່ວໄປ', en: 'General Administration Officer', level: 6, max: 5 },

    // 2. Development Department
    { id: 'pos-head-dev', dept_id: 'dept-dev', code: 'HEAD_DEV', lo: 'ຫົວໜ້າພະແນກພັດທະນາ', en: 'Head of Development', level: 3, max: 1 },
    { id: 'pos-dep-dev', dept_id: 'dept-dev', code: 'DEP_DEV', lo: 'ຮອງຫົວໜ້າພະແນກພັດທະນາ', en: 'Deputy Head of Development', level: 4, max: 2 },
    { id: 'pos-spec-dev', dept_id: 'dept-dev', code: 'SPEC_DEV', lo: 'ຊ່ຽວຊານພັດທະນາໂຄງການພະລັງງານ', en: 'Senior Project Development Specialist', level: 5, max: 4 },
    { id: 'pos-off-dev', dept_id: 'dept-dev', code: 'OFF_DEV', lo: 'ວິຊາການວິເຄາະການລົງທຶນ', en: 'Investment Analysis Officer', level: 6, max: 6 },

    // 3. Business Planning Department
    { id: 'pos-head-bus-plan', dept_id: 'dept-bus-plan', code: 'HEAD_BUS_PLAN', lo: 'ຫົວໜ້າພະແນກທຸລະກິດແຜນການ', en: 'Head of Business Planning', level: 3, max: 1 },
    { id: 'pos-dep-bus-plan', dept_id: 'dept-bus-plan', code: 'DEP_BUS_PLAN', lo: 'ຮອງຫົວໜ້າພະແນກທຸລະກິດແຜນການ', en: 'Deputy Head of Business Planning', level: 4, max: 2 },
    { id: 'pos-spec-bus-plan', dept_id: 'dept-bus-plan', code: 'SPEC_BUS_PLAN', lo: 'ວິຊາການວາງແຜນຍຸດທະສາດ', en: 'Strategic Planning Specialist', level: 5, max: 3 },
    { id: 'pos-off-bus-plan', dept_id: 'dept-bus-plan', code: 'OFF_BUS_PLAN', lo: 'ວິຊາການຕິດຕາມແຜນທຸລະກິດ', en: 'Business Monitoring Officer', level: 6, max: 5 },

    // 4. Fly Ash Business Department
    { id: 'pos-head-fly-ash', dept_id: 'dept-fly-ash', code: 'HEAD_FLY_ASH', lo: 'ຫົວໜ້າພະແນກທຸລະກິດຂີ້ເທົ່າລອຍ', en: 'Head of Fly Ash Business', level: 3, max: 1 },
    { id: 'pos-dep-fly-ash', dept_id: 'dept-fly-ash', code: 'DEP_FLY_ASH', lo: 'ຮອງຫົວໜ້າພະແນກທຸລະກິດຂີ້ເທົ່າລອຍ', en: 'Deputy Head of Fly Ash Business', level: 4, max: 2 },
    { id: 'pos-spec-fly-ash', dept_id: 'dept-fly-ash', code: 'SPEC_FLY_ASH', lo: 'ວິຊາການຄຸ້ມຄອງສັນຍາ ແລະ ການຄ້າ', en: 'Commercial Trade Specialist', level: 5, max: 3 },
    { id: 'pos-off-fly-ash', dept_id: 'dept-fly-ash', code: 'OFF_FLY_ASH', lo: 'ວິຊາການຂົນສົ່ງ ແລະ ສາງສິນຄ້າ', en: 'Logistics & Inventory Officer', level: 6, max: 5 },

    // 5. Internal Audit Department
    { id: 'pos-head-int-audit', dept_id: 'dept-int-audit', code: 'HEAD_INT_AUDIT', lo: 'ຫົວໜ້າພະແນກກວດສອບພາຍໃນ', en: 'Head of Internal Audit', level: 3, max: 1 },
    { id: 'pos-dep-int-audit', dept_id: 'dept-int-audit', code: 'DEP_INT_AUDIT', lo: 'ຮອງຫົວໜ້າພະແນກກວດສອບພາຍໃນ', en: 'Deputy Head of Internal Audit', level: 4, max: 2 },
    { id: 'pos-spec-int-audit', dept_id: 'dept-int-audit', code: 'SPEC_INT_AUDIT', lo: 'ຜູ້ກວດສອບບັນຊີພາຍໃນອາວຸໂສ', en: 'Senior Internal Auditor', level: 5, max: 3 },
    { id: 'pos-off-int-audit', dept_id: 'dept-int-audit', code: 'OFF_INT_AUDIT', lo: 'ວິຊາການກວດສອບການປະຕິບັດຕາມລະບຽບ', en: 'Compliance Audit Officer', level: 6, max: 4 },
  ];

  const insertPos = db.prepare(`
    INSERT OR IGNORE INTO positions_v2 (
      id, org_id, dept_id, code, title_lo, title_en, level, max_headcount
    ) VALUES (?, 'org-lhse-main', ?, ?, ?, ?, ?, ?)
  `);

  for (const pos of seedPositions) {
    insertPos.run(pos.id, pos.dept_id, pos.code, pos.lo, pos.en, pos.level, pos.max);
  }

  // 7. Seed Real Baseline Operational Documents across 5 Departments for Analytics
  const docCount = (db.prepare('SELECT COUNT(*) as c FROM documents').get() as any)?.c;
  if (docCount === 0) {
    const baselineDocs = [
      // ADM_FIN
      {
        id: 'doc-af-001',
        dept: 'dept-adm-fin',
        reg: 'LHSE-AF/2026/001',
        type: 'INCOMING',
        title: 'ບົດລາຍງານງົບປະມານປະຈຳໄຕຣມາດ 3/2026 ຈາກກະຊວງການເງິນ',
        sender: 'ກະຊວງການເງິນ',
        rec: 'ລັດວິສາຫະກິດຖືຮຸ້ນລາວ',
        date: '2026-11-04',
        prio: 'URGENT',
        conf: 'CONFIDENTIAL',
        status: 'IN_REVIEW',
        step: 3,
      },
      {
        id: 'doc-af-002',
        dept: 'dept-adm-fin',
        reg: 'LHSE-AF/2026/002',
        type: 'OUTGOING',
        title: 'ແຈ້ງການຊໍາລະພັນທະພາສີ-ອາກອນ ປະຈຳເດືອນ 10/2026',
        sender: 'ພະແນກບໍລິຫານ ບັນຊີ ແລະ ການເງິນ',
        rec: 'ກົມສ່ວຍສາອາກອນ',
        date: '2026-11-02',
        prio: 'NORMAL',
        conf: 'INTERNAL',
        status: 'APPROVED',
        step: 4,
      },
      {
        id: 'doc-af-003',
        dept: 'dept-adm-fin',
        reg: 'LHSE-AF/2026/003',
        type: 'INTERNAL',
        title: 'ແຈ້ງການສະຫຼຸບບັນຊີ ແລະ ວຽກງານບໍລິຫານທ້າຍປີ 2026',
        sender: 'ນາງ ທິບດາວອນ',
        rec: 'ທຸກພະແນກພາຍໃນ LHSE',
        date: '2026-11-05',
        prio: 'VERY_URGENT',
        conf: 'PUBLIC',
        status: 'SIGNED',
        step: 5,
      },

      // DEV
      {
        id: 'doc-dev-001',
        dept: 'dept-dev',
        reg: 'LHSE-DEV/2026/012',
        type: 'INCOMING',
        title: 'ບົດສະເໜີໂຄງການພະລັງງານແສງຕາເວັນ 50MW ເຂດພາກໃຕ້',
        sender: 'ກຸ່ມບໍລິສັດຮ່ວມທຶນພະລັງງານ',
        rec: 'ຄະນະອຳນວຍການ LHSE',
        date: '2026-11-01',
        prio: 'URGENT',
        conf: 'HIGHLY_CONFIDENTIAL',
        status: 'IN_REVIEW',
        step: 3,
      },
      {
        id: 'doc-dev-002',
        dept: 'dept-dev',
        reg: 'LHSE-DEV/2026/013',
        type: 'INTERNAL',
        title: 'ບົດວິເຄາະຄວາມເປັນໄປໄດ້ທາງເສດຖະກິດໂຄງການລົງທຶນໃໝ່',
        sender: 'ນາງ ໜິງ',
        rec: 'ຜູ້ອຳນວຍການໃຫຍ່ LHSE',
        date: '2026-10-28',
        prio: 'NORMAL',
        conf: 'CONFIDENTIAL',
        status: 'APPROVED',
        step: 4,
      },

      // BUS_PLAN
      {
        id: 'doc-bp-001',
        dept: 'dept-bus-plan',
        reg: 'LHSE-BP/2026/005',
        type: 'INTERNAL',
        title: 'ແຜນດຳເນີນທຸລະກິດ ແລະ ຄາດຄະເນລາຍຮັບ-ລາຍຈ່າຍ ປີ 2027',
        sender: 'ສຸພາລັກ',
        rec: 'ຄະນະອຳນວຍການ LHSE',
        date: '2026-11-03',
        prio: 'URGENT',
        conf: 'CONFIDENTIAL',
        status: 'ASSIGNED',
        step: 2,
      },
      {
        id: 'doc-bp-002',
        dept: 'dept-bus-plan',
        reg: 'LHSE-BP/2026/006',
        type: 'OUTGOING',
        title: 'ໜັງສືປະສານງານການຖືຮຸ້ນໃນໂຄງການເຂື່ອນໄຟຟ້ານໍ້າງື່ມ 2',
        sender: 'ພະແນກທຸລະກິດແຜນການ',
        rec: 'ຄະນະກຳມະການຮ່ວມທຶນ',
        date: '2026-10-20',
        prio: 'NORMAL',
        conf: 'INTERNAL',
        status: 'COMPLETED',
        step: 6,
      },

      // FLY_ASH
      {
        id: 'doc-fa-001',
        dept: 'dept-fly-ash',
        reg: 'LHSE-FA/2026/044',
        type: 'OUTGOING',
        title: 'ສັນຍາຊື້-ຂາຍຜະລິດຕະພັນຂີ້ເທົ່າລອຍ ໂຄງການໄຟຟ້າຫົງສາ ໄຕຣມາດ 4',
        sender: 'ທ້າວ ກິລິນທອນ',
        rec: 'ບໍລິສັດ ຜະລິດຊີມັງ ລາວ',
        date: '2026-11-04',
        prio: 'VERY_URGENT',
        conf: 'CONFIDENTIAL',
        status: 'APPROVED',
        step: 4,
      },
      {
        id: 'doc-fa-002',
        dept: 'dept-fly-ash',
        reg: 'LHSE-FA/2026/045',
        type: 'INCOMING',
        title: 'ໃບສັ່ງຊື້ຂີ້ເທົ່າລອຍລວງໜ້າ ປະຈຳເດືອນ 11/2026',
        sender: 'ຄູ່ຄ້າພາຍໃນປະເທດ',
        rec: 'ພະແນກທຸລະກິດຂີ້ເທົ່າລອຍ',
        date: '2026-11-05',
        prio: 'NORMAL',
        conf: 'INTERNAL',
        status: 'REGISTERED',
        step: 1,
      },

      // INT_AUDIT
      {
        id: 'doc-ia-001',
        dept: 'dept-int-audit',
        reg: 'LHSE-IA/2026/008',
        type: 'INTERNAL',
        title: 'ບົດລາຍງານຜົນການກວດສອບພາຍໃນ ການນຳໃຊ້ງົບປະມານ 6 ເດືອນຕົ້ນປີ',
        sender: 'ທ້າວ ວິລະປັນຍາ',
        rec: 'ຄະນະກວດກາ LHSE',
        date: '2026-10-15',
        prio: 'VERY_URGENT',
        conf: 'HIGHLY_CONFIDENTIAL',
        status: 'COMPLETED',
        step: 6,
      },
      {
        id: 'doc-ia-002',
        dept: 'dept-int-audit',
        reg: 'LHSE-IA/2026/009',
        type: 'INTERNAL',
        title: 'ແຜນການລົງກວດສອບສາງ ແລະ ການຈັດສົ່ງຜະລິດຕະພັນຂີ້ເທົ່າລອຍ',
        sender: 'ພະແນກກວດສອບພາຍໃນ',
        rec: 'ພະແນກທຸລະກິດຂີ້ເທົ່າລອຍ',
        date: '2026-11-02',
        prio: 'NORMAL',
        conf: 'CONFIDENTIAL',
        status: 'IN_REVIEW',
        step: 3,
      },
    ];

    const insertDoc = db.prepare(`
      INSERT OR IGNORE INTO documents (
        id, org_id, dept_id, reg_number, internal_ref, doc_type, title,
        sender, recipient, doc_date, priority, confidentiality,
        workflow_status, current_step, creator_id
      ) VALUES (?, 'org-lhse-main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'user-superadmin-001')
    `);

    for (const doc of baselineDocs) {
      insertDoc.run(
        doc.id,
        doc.dept,
        doc.reg,
        doc.reg,
        doc.type,
        doc.title,
        doc.sender,
        doc.rec,
        doc.date,
        doc.prio,
        doc.conf,
        doc.status,
        doc.step
      );
    }
  }

  return result;
}
