import { Router, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sendRealTimeNotification } from '../services/notifications.js';

export const workflowsRouter = Router();

// Helper to push real-time notification
function createNotification(userId: string, titleLo: string, titleEn: string, messageLo: string, messageEn: string, type: any, entityId: string) {
  sendRealTimeNotification(userId, titleLo, titleEn, messageLo, messageEn, type, entityId);
}

// 1. GET /api/workflows/pending - Queue of documents pending current user's review or approval
workflowsRouter.get('/pending', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');

  let query = `
    SELECT doc.*, d.name_lo as dept_name_lo, d.name_en as dept_name_en, d.code as dept_code,
           u.full_name_lo as creator_name_lo, u.email as creator_email
    FROM documents doc
    JOIN departments d ON doc.dept_id = d.id
    LEFT JOIN users u ON doc.creator_id = u.id
    WHERE doc.workflow_status IN ('REGISTERED', 'IN_REVIEW', 'APPROVED')
  `;

  const params: any[] = [];
  if (!isSuperAdmin) {
    query += ' AND doc.dept_id = ?';
    params.push(actor.dept_id);
  }

  query += " ORDER BY doc.priority = 'VERY_URGENT' DESC, doc.priority = 'URGENT' DESC, doc.created_at ASC";

  const rows = db.prepare(query).all(...params);

  res.json({
    success: true,
    total: rows.length,
    pendingTasks: rows,
  });
});

// 2. POST /api/workflows/:docId/submit - Creator submits document for department approval
workflowsRouter.post('/:docId/submit', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const docId = req.params.docId;
  const { notes = '' } = req.body;

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId) as any;
  if (!doc) {
    res.status(404).json({ success: false, error: 'DOC_NOT_FOUND' });
    return;
  }

  // Isolation check
  if (!actor.roles.includes('SUPER_ADMIN') && doc.dept_id !== actor.dept_id) {
    res.status(403).json({ success: false, error: 'DEPARTMENT_ISOLATION_VIOLATION' });
    return;
  }

  // Update status
  db.prepare(`
    UPDATE documents SET workflow_status = 'IN_REVIEW', current_step = 2, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(docId);

  // Record workflow step
  db.prepare(`
    INSERT INTO document_workflow_steps (id, doc_id, step_number, step_name_lo, step_name_en, assignee_user_id, assignee_role, action, comments, acted_at)
    VALUES (?, ?, 2, 'ກວດສອບເອກະສານ', 'Department Review', ?, 'DEPT_ADMIN', 'SUBMITTED', ?, CURRENT_TIMESTAMP)
  `).run(`step-${Date.now()}`, docId, actor.id, notes);

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
    VALUES (?, 'org-lhse-main', ?, ?, ?, 'WORKFLOW_SUBMIT', 'DOCUMENT', ?, 'SUCCESS', ?, ?)
  `).run(
    `audit-${Date.now()}`,
    doc.dept_id,
    actor.id,
    actor.email,
    docId,
    JSON.stringify({ fromStatus: doc.workflow_status, toStatus: 'IN_REVIEW', notes }),
    req.ip || '127.0.0.1'
  );

  // Notify Department Admin
  const deptAdmins = db.prepare(`
    SELECT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE u.dept_id = ? AND r.code IN ('DEPT_ADMIN', 'APPROVER')
  `).all(doc.dept_id) as any[];

  for (const admin of deptAdmins) {
    createNotification(
      admin.id,
      'ເອກະສານໃໝ່ລໍຖ້າການກວດສອບ',
      'Document Pending Review',
      `ເອກະສານ ${doc.reg_number}: "${doc.title}" ຖືກສົ່ງມາກວດສອບ`,
      `Document ${doc.reg_number} is pending your review`,
      'APPROVAL_REQUEST',
      docId
    );
  }

  res.json({
    success: true,
    workflowStatus: 'IN_REVIEW',
    message: 'ສົ່ງເອກະສານເຂົ້າສູ່ຂັ້ນຕອນການກວດສອບສຳເລັດ',
  });
});

// 3. POST /api/workflows/:docId/action - Approve, Reject, or Return for Revision
workflowsRouter.post('/:docId/action', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const docId = req.params.docId;
  const { action, comments = '' } = req.body;

  if (!action || !['APPROVE', 'REJECT', 'RETURN_FOR_REVISION'].includes(action)) {
    res.status(400).json({
      success: false,
      error: 'INVALID_ACTION',
      message: 'ການດຳເນີນງານບໍ່ຖືກຕ້ອງ (ຕ້ອງແມ່ນ APPROVE, REJECT, ຫຼື RETURN_FOR_REVISION)',
    });
    return;
  }

  if ((action === 'REJECT' || action === 'RETURN_FOR_REVISION') && !comments.trim()) {
    res.status(400).json({
      success: false,
      error: 'COMMENTS_REQUIRED',
      message: 'ກະລຸນາລະບຸເຫດຜົນໃນການປະຕິເສດ ຫຼື ສົ່ງກັບໄປແກ້ໄຂ',
    });
    return;
  }

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId) as any;
  if (!doc) {
    res.status(404).json({ success: false, error: 'DOC_NOT_FOUND' });
    return;
  }

  // Department check
  if (!actor.roles.includes('SUPER_ADMIN') && doc.dept_id !== actor.dept_id) {
    res.status(403).json({ success: false, error: 'DEPARTMENT_ISOLATION_VIOLATION' });
    return;
  }

  let nextStatus = doc.workflow_status;
  let stepNameLo = 'ກວດສອບ/ອະນຸມັດ';
  let stepNameEn = 'Review/Approval';

  if (action === 'APPROVE') {
    nextStatus = 'APPROVED';
    stepNameLo = 'ອະນຸມັດເອກະສານ';
    stepNameEn = 'Document Approved';
  } else if (action === 'REJECT') {
    nextStatus = 'REJECTED';
    stepNameLo = 'ປະຕິເສດເອກະສານ';
    stepNameEn = 'Document Rejected';
  } else if (action === 'RETURN_FOR_REVISION') {
    nextStatus = 'DRAFT';
    stepNameLo = 'ສົ່ງກັບໄປປັບປຸງແກ້ໄຂ';
    stepNameEn = 'Returned for Revision';
  }

  // Update document status
  db.prepare(`
    UPDATE documents SET workflow_status = ?, current_step = current_step + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(nextStatus, docId);

  // Append workflow step record
  db.prepare(`
    INSERT INTO document_workflow_steps (id, doc_id, step_number, step_name_lo, step_name_en, assignee_user_id, assignee_role, action, comments, acted_at)
    VALUES (?, ?, (SELECT COUNT(*) + 1 FROM document_workflow_steps WHERE doc_id = ?), ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    `step-${Date.now()}`,
    docId,
    docId,
    stepNameLo,
    stepNameEn,
    actor.id,
    actor.roles[0] || 'APPROVER',
    action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'RETURNED_FOR_REVISION',
    comments
  );

  // Write Immutable Audit Log
  db.prepare(`
    INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
    VALUES (?, 'org-lhse-main', ?, ?, ?, ?, 'DOCUMENT', ?, 'SUCCESS', ?, ?)
  `).run(
    `audit-${Date.now()}`,
    doc.dept_id,
    actor.id,
    actor.email,
    `WORKFLOW_${action}`,
    docId,
    JSON.stringify({ fromStatus: doc.workflow_status, toStatus: nextStatus, comments }),
    req.ip || '127.0.0.1'
  );

  // Notify document creator
  const notifType = action === 'APPROVE' ? 'DOCUMENT_APPROVED' : action === 'REJECT' ? 'DOCUMENT_REJECTED' : 'REVISION_REQUESTED';
  createNotification(
    doc.creator_id,
    action === 'APPROVE' ? 'ເອກະສານໄດ້ຮັບການອະນຸມັດແລ້ວ' : action === 'REJECT' ? 'ເອກະສານຖືກປະຕິເສດ' : 'ເອກະສານຖືກສົ່ງກັບໄປແກ້ໄຂ',
    action === 'APPROVE' ? 'Document Approved' : action === 'REJECT' ? 'Document Rejected' : 'Revision Requested',
    `ເອກະສານ ${doc.reg_number}: "${doc.title}" ດຳເນີນການໂດຍ ${actor.full_name_lo}. ${comments ? `(ເຫດຜົນ: ${comments})` : ''}`,
    `Document ${doc.reg_number} action: ${action}. ${comments}`,
    notifType,
    docId
  );

  res.json({
    success: true,
    workflowStatus: nextStatus,
    message: action === 'APPROVE'
      ? 'ອະນຸມັດເອກະສານຮຽບຮ້ອຍແລ້ວ'
      : action === 'REJECT'
      ? 'ປະຕິເສດເອກະສານຮຽບຮ້ອຍແລ້ວ'
      : 'ສົ່ງເອກະສານກັບໄປແກ້ໄຂຮຽບຮ້ອຍແລ້ວ',
  });
});

// 4. GET /api/workflows/:docId/trail - Complete chronological approval trail
workflowsRouter.get('/:docId/trail', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const docId = req.params.docId;

  const doc = db.prepare('SELECT dept_id FROM documents WHERE id = ?').get(docId) as any;
  if (!doc) {
    res.status(404).json({ success: false, error: 'DOC_NOT_FOUND' });
    return;
  }

  if (!actor.roles.includes('SUPER_ADMIN') && !actor.roles.includes('EXECUTIVE_VIEWER') && doc.dept_id !== actor.dept_id) {
    res.status(403).json({ success: false, error: 'DEPARTMENT_ISOLATION_VIOLATION' });
    return;
  }

  const steps = db.prepare(`
    SELECT s.*, u.full_name_lo as actor_name_lo, u.full_name_en as actor_name_en, u.email as actor_email,
           p.title_lo as position_title_lo
    FROM document_workflow_steps s
    LEFT JOIN users u ON s.assignee_user_id = u.id
    LEFT JOIN positions_v2 p ON u.position_id = p.id
    WHERE s.doc_id = ?
    ORDER BY s.step_number ASC, s.created_at ASC
  `).all(docId);

  res.json({
    success: true,
    trail: steps,
  });
});

// 5. In-App Notifications Endpoints
workflowsRouter.get('/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const rows = db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(actor.id);

  const unreadCount = (db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0').get(actor.id) as any)?.c || 0;

  res.json({
    success: true,
    unreadCount,
    notifications: rows,
  });
});

workflowsRouter.post('/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const notifId = req.params.id;

  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(notifId, actor.id);
  res.json({ success: true });
});

workflowsRouter.post('/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(actor.id);
  res.json({ success: true, message: 'ໝາຍວ່າອ່ານທຸກລາຍການແລ້ວ' });
});
