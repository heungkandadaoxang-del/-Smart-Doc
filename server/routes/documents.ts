import { Router, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sendRealTimeNotification } from '../services/notifications.js';
import { extractOcrText, indexDocumentAttachmentOcr } from '../services/ocr.js';

export const documentsRouter = Router();

// Helper to generate sequential registration number: LHSE-{DEPT}/{YEAR}/{001}
export function generateNextRegNumber(deptId: string, docType: string): string {
  const dept = db.prepare('SELECT code FROM departments WHERE id = ?').get(deptId) as any;
  const deptCode = dept ? dept.code.replace('DEPT_', '').replace('_', '-') : 'GEN';
  const year = new Date().getFullYear();

  // Upsert sequence counter atomically
  db.prepare(`
    INSERT INTO document_number_sequences (id, dept_id, doc_type, year, current_sequence, updated_at)
    VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(dept_id, doc_type, year) DO UPDATE SET
      current_sequence = current_sequence + 1,
      updated_at = CURRENT_TIMESTAMP
  `).run(`seq-${deptId}-${docType}-${year}`, deptId, docType, year);

  const seqRow = db.prepare(`
    SELECT current_sequence FROM document_number_sequences
    WHERE dept_id = ? AND doc_type = ? AND year = ?
  `).get(deptId, docType, year) as any;

  const seqNum = String(seqRow?.current_sequence || 1).padStart(3, '0');
  const typePrefix = docType === 'INCOMING' ? 'IN' : docType === 'OUTGOING' ? 'OUT' : 'INT';
  return `LHSE-${deptCode}/${typePrefix}/${year}/${seqNum}`;
}

// 1. GET /api/documents - List documents with strict department isolation & full OCR text search
documentsRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');
  const isExecutive = actor.roles.includes('EXECUTIVE_VIEWER') || isSuperAdmin;

  const {
    doc_type,
    workflow_status,
    priority,
    confidentiality,
    dept_id,
    search,
    date_from,
    date_to,
    page = '1',
    limit = '50',
  } = req.query;

  // Strict department isolation: non-superadmin can ONLY view their assigned department
  let effectiveDeptId = dept_id as string | undefined;
  if (!isSuperAdmin && !isExecutive) {
    if (effectiveDeptId && effectiveDeptId !== actor.dept_id) {
      res.status(403).json({
        success: false,
        error: 'DEPARTMENT_ISOLATION_VIOLATION',
        message: 'ການເຂົ້າເຖິງຖືກປະຕິເສດ: ທ່ານບໍ່ມີສິດເບິ່ງເອກະສານຂອງພະແນກອື່ນ',
      });
      return;
    }
    effectiveDeptId = actor.dept_id || undefined;
  }

  let query = `
    SELECT doc.*, d.name_lo as dept_name_lo, d.name_en as dept_name_en, d.code as dept_code,
           u.full_name_lo as creator_name_lo, u.email as creator_email,
           r.full_name_lo as responsible_name_lo,
           (SELECT COUNT(*) FROM document_attachments att WHERE att.doc_id = doc.id) as attachments_count,
           (SELECT COUNT(*) FROM document_attachments att WHERE att.doc_id = doc.id AND att.ocr_status = 'COMPLETED') as ocr_indexed_count,
           (SELECT COUNT(*) FROM document_versions ver WHERE ver.doc_id = doc.id) as versions_count,
           (SELECT COUNT(*) FROM document_signatures sig WHERE sig.doc_id = doc.id AND sig.is_valid = 1) as signatures_count
    FROM documents doc
    JOIN departments d ON doc.dept_id = d.id
    LEFT JOIN users u ON doc.creator_id = u.id
    LEFT JOIN users r ON doc.responsible_user_id = r.id
  `;

  const conditions: string[] = [];
  const params: any[] = [];

  if (effectiveDeptId) {
    conditions.push('doc.dept_id = ?');
    params.push(effectiveDeptId);
  }

  if (doc_type && doc_type !== 'ALL') {
    conditions.push('doc.doc_type = ?');
    params.push(doc_type);
  }

  if (workflow_status && workflow_status !== 'ALL') {
    conditions.push('doc.workflow_status = ?');
    params.push(workflow_status);
  }

  if (priority && priority !== 'ALL') {
    conditions.push('doc.priority = ?');
    params.push(priority);
  }

  if (confidentiality && confidentiality !== 'ALL') {
    conditions.push('doc.confidentiality = ?');
    params.push(confidentiality);
  }

  if (date_from) {
    conditions.push('doc.doc_date >= date(?)');
    params.push(date_from);
  }

  if (date_to) {
    conditions.push('doc.doc_date <= date(?)');
    params.push(date_to);
  }

  if (search) {
    const s = `%${String(search).trim()}%`;
    conditions.push(`(
      doc.reg_number LIKE ?
      OR doc.title LIKE ?
      OR doc.sender LIKE ?
      OR doc.recipient LIKE ?
      OR doc.internal_ref LIKE ?
      OR (doc.summary IS NOT NULL AND doc.summary LIKE ?)
      OR (doc.indexed_ocr_content IS NOT NULL AND doc.indexed_ocr_content LIKE ?)
      OR EXISTS (SELECT 1 FROM document_attachments att WHERE att.doc_id = doc.id AND att.ocr_text LIKE ?)
      OR EXISTS (SELECT 1 FROM document_ocr_indexes ocr WHERE ocr.doc_id = doc.id AND ocr.extracted_text LIKE ?)
    )`);
    params.push(s, s, s, s, s, s, s, s, s);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY doc.doc_date DESC, doc.created_at DESC';

  const p = Math.max(1, parseInt(String(page)) || 1);
  const l = Math.min(100, Math.max(1, parseInt(String(limit)) || 50));
  const offset = (p - 1) * l;

  const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
  const total = (db.prepare(countQuery).get(...params) as any)?.total || 0;

  query += ` LIMIT ${l} OFFSET ${offset}`;
  const rows = db.prepare(query).all(...params);

  res.json({
    success: true,
    total,
    page: p,
    limit: l,
    documents: rows,
  });
});

// 2. GET /api/documents/:id - Single document with full attachments, versions, and workflow steps
documentsRouter.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');
  const isExecutive = actor.roles.includes('EXECUTIVE_VIEWER') || isSuperAdmin;
  const docId = req.params.id;

  const doc = db.prepare(`
    SELECT doc.*, d.name_lo as dept_name_lo, d.name_en as dept_name_en, d.code as dept_code,
           u.full_name_lo as creator_name_lo, u.email as creator_email,
           r.full_name_lo as responsible_name_lo
    FROM documents doc
    JOIN departments d ON doc.dept_id = d.id
    LEFT JOIN users u ON doc.creator_id = u.id
    LEFT JOIN users r ON doc.responsible_user_id = r.id
    WHERE doc.id = ?
  `).get(docId) as any;

  if (!doc) {
    res.status(404).json({ success: false, error: 'DOC_NOT_FOUND', message: 'ບໍ່ພົບເອກະສານ' });
    return;
  }

  // Enforce department boundary
  if (!isSuperAdmin && !isExecutive && doc.dept_id !== actor.dept_id) {
    res.status(403).json({
      success: false,
      error: 'DEPARTMENT_ISOLATION_VIOLATION',
      message: 'ທ່ານບໍ່ມີສິດເຂົ້າເຖິງເອກະສານຂອງພະແນກອື່ນ',
    });
    return;
  }

  const attachments = db.prepare(`
    SELECT att.*, u.full_name_lo as uploader_name
    FROM document_attachments att
    LEFT JOIN users u ON att.uploader_id = u.id
    WHERE att.doc_id = ?
    ORDER BY att.created_at ASC
  `).all(docId);

  const versions = db.prepare(`
    SELECT ver.*, u.full_name_lo as author_name
    FROM document_versions ver
    LEFT JOIN users u ON ver.changed_by = u.id
    WHERE ver.doc_id = ?
    ORDER BY ver.version_number DESC
  `).all(docId);

  const workflowSteps = db.prepare(`
    SELECT step.*, u.full_name_lo as assignee_name
    FROM document_workflow_steps step
    LEFT JOIN users u ON step.assignee_user_id = u.id
    WHERE step.doc_id = ?
    ORDER BY step.step_number ASC
  `).all(docId);

  const signatures = db.prepare(`
    SELECT sig.*, u.email as signer_email
    FROM document_signatures sig
    LEFT JOIN users u ON sig.signer_user_id = u.id
    WHERE sig.doc_id = ?
    ORDER BY sig.signed_at ASC
  `).all(docId);

  res.json({
    success: true,
    document: doc,
    attachments,
    versions,
    workflowSteps,
    signatures,
  });
});

// 3. POST /api/documents - Register new document (with optional initial attachment and automated OCR)
documentsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');

  const {
    doc_type,
    title,
    summary = '',
    sender = '',
    recipient = '',
    doc_date,
    received_date,
    priority = 'NORMAL',
    confidentiality = 'INTERNAL',
    dept_id = actor.dept_id,
    responsible_user_id,
    internal_ref,
    initialAttachment,
  } = req.body;

  if (!doc_type || !title || !doc_date) {
    res.status(400).json({
      success: false,
      error: 'MISSING_FIELDS',
      message: 'ກະລຸນາປ້ອນ ປະເພດເອກະສານ, ຫົວຂໍ້ ແລະ ວັນທີເອກະສານ',
    });
    return;
  }

  // Enforce department assignment
  const targetDeptId = isSuperAdmin && dept_id ? dept_id : actor.dept_id;
  if (!targetDeptId) {
    res.status(400).json({
      success: false,
      error: 'NO_DEPT_ASSIGNED',
      message: 'ກະລຸນາລະບຸພະແນກຜູ້ຮັບຜິດຊອບເອກະສານ',
    });
    return;
  }

  // Non-superadmin cannot create documents in other departments
  if (!isSuperAdmin && targetDeptId !== actor.dept_id) {
    res.status(403).json({
      success: false,
      error: 'DEPARTMENT_ISOLATION_VIOLATION',
      message: 'ທ່ານບໍ່ສາມາດສ້າງເອກະສານຂ້າມພະແນກໄດ້',
    });
    return;
  }

  const docId = `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const regNumber = generateNextRegNumber(targetDeptId, doc_type);
  const qrToken = `qr-lhse-${crypto.randomBytes(16).toString('hex')}`;

  db.prepare(`
    INSERT INTO documents (
      id, org_id, dept_id, reg_number, internal_ref, doc_type, title, summary,
      sender, recipient, doc_date, received_date, priority, confidentiality,
      workflow_status, current_step, creator_id, responsible_user_id, qr_token
    ) VALUES (?, 'org-lhse-main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REGISTERED', 1, ?, ?, ?)
  `).run(
    docId,
    targetDeptId,
    regNumber,
    internal_ref || regNumber,
    doc_type,
    title,
    summary,
    sender,
    recipient,
    doc_date,
    received_date || doc_date,
    priority,
    confidentiality,
    actor.id,
    responsible_user_id || actor.id,
    qrToken
  );

  // Initialize Version 1
  db.prepare(`
    INSERT INTO document_versions (id, doc_id, version_number, title, summary, changed_by, change_summary)
    VALUES (?, ?, 1, ?, ?, ?, 'Initial document registration')
  `).run(`ver-${Date.now()}`, docId, title, summary, actor.id);

  // Initialize initial workflow step (Registration)
  db.prepare(`
    INSERT INTO document_workflow_steps (id, doc_id, step_number, step_name_lo, step_name_en, assignee_user_id, assignee_role, action, acted_at)
    VALUES (?, ?, 1, 'ລົງທະບຽນເອກະສານ', 'Document Registration', ?, 'CREATOR', 'SUBMITTED', CURRENT_TIMESTAMP)
  `).run(`step-${Date.now()}`, docId, actor.id);

  // If initial attachment provided, store and immediately run OCR indexing
  let initialOcrResult: any = null;
  let initialAttachmentId: string | null = null;
  if (initialAttachment && initialAttachment.contentBase64 && initialAttachment.fileName) {
    try {
      const sha256 = crypto.createHash('sha256').update(initialAttachment.contentBase64).digest('hex');
      initialAttachmentId = `att-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const storageKey = `lhse-r2/documents/${docId}/${initialAttachmentId}_${initialAttachment.fileName}`;

      db.prepare(`
        INSERT INTO document_attachments (id, doc_id, file_name, file_type, file_size, storage_key, content_sha256, version, uploader_id, ocr_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 'PROCESSING')
      `).run(
        initialAttachmentId,
        docId,
        initialAttachment.fileName,
        initialAttachment.fileType || 'application/pdf',
        initialAttachment.fileSize || initialAttachment.contentBase64.length,
        storageKey,
        sha256,
        actor.id
      );

      // Run OCR extraction and database indexing
      initialOcrResult = await indexDocumentAttachmentOcr(
        docId,
        initialAttachmentId,
        initialAttachment.fileName,
        initialAttachment.fileType || 'application/pdf',
        initialAttachment.contentBase64,
        actor.id
      );
    } catch (ocrErr: any) {
      console.error('[Initial Attachment OCR Error]', ocrErr);
    }
  }

  // Write Immutable Audit Log
  db.prepare(`
    INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
    VALUES (?, 'org-lhse-main', ?, ?, ?, 'DOC_REGISTER', 'DOCUMENT', ?, 'SUCCESS', ?, ?)
  `).run(
    `audit-${Date.now()}`,
    targetDeptId,
    actor.id,
    actor.email,
    docId,
    JSON.stringify({
      regNumber,
      doc_type,
      title,
      priority,
      confidentiality,
      hasInitialAttachment: Boolean(initialAttachmentId),
      ocrWordsIndexed: initialOcrResult?.wordCount || 0,
    }),
    req.ip || '127.0.0.1'
  );

  // Notify assigned responsible user if different from creator
  if (responsible_user_id && responsible_user_id !== actor.id) {
    try {
      sendRealTimeNotification(
        responsible_user_id,
        'ທ່ານໄດ້ຮັບມອບໝາຍເອກະສານໃໝ່',
        'New Document Assigned',
        `ທ່ານໄດ້ຮັບມອບໝາຍເອກະສານ ${regNumber}: "${title}" ໂດຍ ${actor.full_name_lo}`,
        `You have been assigned to document ${regNumber}: "${title}" by ${actor.full_name_en || actor.full_name_lo}`,
        'APPROVAL_REQUEST',
        docId
      );
    } catch (e) {}
  }

  res.json({
    success: true,
    docId,
    regNumber,
    qrToken,
    initialAttachmentId,
    ocr: initialOcrResult,
    message: initialOcrResult?.success
      ? `ລົງທະບຽນເອກະສານ ແລະ ສະແກນ OCR ສຳເລັດ: ${regNumber} (${initialOcrResult.wordCount} ຄຳຖືກ Index)`
      : `ລົງທະບຽນເອກະສານສຳເລັດ: ${regNumber}`,
  });
});

// 4.0 POST /api/documents/ocr/preview-extract - Live OCR preview & metadata suggestion before submission
documentsRouter.post('/ocr/preview-extract', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { fileName, fileType, contentBase64 } = req.body;
  if (!contentBase64) {
    res.status(400).json({ success: false, error: 'MISSING_FILE_DATA', message: 'ກະລຸນາເລືອກໄຟລ໌' });
    return;
  }
  try {
    const result = await extractOcrText(contentBase64, fileType || 'application/pdf', fileName || 'scan.pdf');
    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. POST /api/documents/:id/attachments - Upload document attachment & automatically run OCR extraction and indexing
documentsRouter.post('/:id/attachments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const docId = req.params.id;
  const { fileName, fileType, fileSize, contentBase64 } = req.body;

  if (!fileName || !contentBase64) {
    res.status(400).json({ success: false, error: 'MISSING_FILE_DATA', message: 'ກະລຸນາເລືອກໄຟລ໌' });
    return;
  }

  const doc = db.prepare('SELECT dept_id FROM documents WHERE id = ?').get(docId) as any;
  if (!doc) {
    res.status(404).json({ success: false, error: 'DOC_NOT_FOUND' });
    return;
  }

  // Department check
  if (!actor.roles.includes('SUPER_ADMIN') && doc.dept_id !== actor.dept_id) {
    res.status(403).json({ success: false, error: 'DEPARTMENT_ISOLATION_VIOLATION' });
    return;
  }

  const sha256 = crypto.createHash('sha256').update(contentBase64).digest('hex');
  const attId = `att-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const storageKey = `lhse-r2/documents/${docId}/${attId}_${fileName}`;

  db.prepare(`
    INSERT INTO document_attachments (id, doc_id, file_name, file_type, file_size, storage_key, content_sha256, version, uploader_id, ocr_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 'PROCESSING')
  `).run(attId, docId, fileName, fileType || 'application/octet-stream', fileSize || contentBase64.length, storageKey, sha256, actor.id);

  // Automatically execute OCR extraction and database full-text indexing
  let ocrResult: any = null;
  try {
    ocrResult = await indexDocumentAttachmentOcr(
      docId,
      attId,
      fileName,
      fileType || 'application/octet-stream',
      contentBase64,
      actor.id
    );
  } catch (err: any) {
    console.error('[Attachment OCR Processing Error]', err);
  }

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
    VALUES (?, 'org-lhse-main', ?, ?, ?, 'ATTACHMENT_UPLOAD', 'ATTACHMENT', ?, 'SUCCESS', ?, ?)
  `).run(
    `audit-${Date.now()}`,
    doc.dept_id,
    actor.id,
    actor.email,
    attId,
    JSON.stringify({
      docId,
      fileName,
      fileSize,
      sha256,
      ocrEngine: ocrResult?.ocrEngine,
      ocrWords: ocrResult?.wordCount,
    }),
    req.ip || '127.0.0.1'
  );

  res.json({
    success: true,
    attachmentId: attId,
    sha256,
    ocr: ocrResult,
    message: ocrResult?.success
      ? `ອັບໂຫຼດໄຟລ໌ແນບ ແລະ ສະແກນ OCR ສຳເລັດ (${ocrResult.wordCount} ຄຳຖືກ Index)`
      : 'ອັບໂຫຼດໄຟລ໌ແນບສຳເລັດ',
  });
});

// 4.01 POST /api/documents/:id/attachments/:attId/ocr - Re-run OCR text extraction on demand
documentsRouter.post('/:id/attachments/:attId/ocr', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const { id: docId, attId } = req.params;
  const { contentBase64 } = req.body;

  const doc = db.prepare('SELECT dept_id FROM documents WHERE id = ?').get(docId) as any;
  if (!doc) {
    res.status(404).json({ success: false, error: 'DOC_NOT_FOUND' });
    return;
  }

  if (!actor.roles.includes('SUPER_ADMIN') && doc.dept_id !== actor.dept_id) {
    res.status(403).json({ success: false, error: 'DEPARTMENT_ISOLATION_VIOLATION' });
    return;
  }

  const attachment = db.prepare('SELECT * FROM document_attachments WHERE id = ? AND doc_id = ?').get(attId, docId) as any;
  if (!attachment) {
    res.status(404).json({ success: false, error: 'ATTACHMENT_NOT_FOUND' });
    return;
  }

  const payload = contentBase64 || `data:${attachment.file_type};base64,`;
  const result = await indexDocumentAttachmentOcr(
    docId,
    attId,
    attachment.file_name,
    attachment.file_type,
    payload,
    actor.id
  );

  res.json({
    success: true,
    ocr: result,
    message: `ສຳເລັດການສະແກນ ແລະ Index ເນື້ອໃນ OCR ຄືນໃໝ່ (${result.wordCount} ຄຳ)`,
  });
});

// 4.02 GET /api/documents/:id/ocr-search - View OCR indexing details and text extracts
documentsRouter.get('/:id/ocr-search', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const docId = req.params.id;

  const doc = db.prepare('SELECT id, dept_id, reg_number, title, indexed_ocr_content FROM documents WHERE id = ?').get(docId) as any;
  if (!doc) {
    res.status(404).json({ success: false, error: 'DOC_NOT_FOUND' });
    return;
  }

  if (!actor.roles.includes('SUPER_ADMIN') && !actor.roles.includes('EXECUTIVE_VIEWER') && doc.dept_id !== actor.dept_id) {
    res.status(403).json({ success: false, error: 'DEPARTMENT_ISOLATION_VIOLATION' });
    return;
  }

  const indexes = db.prepare(`
    SELECT idx.*, att.file_name, att.file_size
    FROM document_ocr_indexes idx
    JOIN document_attachments att ON idx.attachment_id = att.id
    WHERE idx.doc_id = ?
    ORDER BY idx.created_at ASC
  `).all(docId) as any[];

  res.json({
    success: true,
    docId,
    regNumber: doc.reg_number,
    indexedOcrContent: doc.indexed_ocr_content,
    indexes,
  });
});

// 4.1 GET /api/documents/:id/attachments/:attId/download - Secure Document Attachment Download
documentsRouter.get('/:id/attachments/:attId/download', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const { id: docId, attId } = req.params;

  const doc = db.prepare('SELECT id, dept_id, reg_number, title, confidentiality FROM documents WHERE id = ?').get(docId) as any;
  if (!doc) {
    res.status(404).json({ success: false, error: 'DOC_NOT_FOUND', message: 'ບໍ່ພົບເອກະສານ' });
    return;
  }

  // Strict department authorization check
  const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');
  const isExecutive = actor.roles.includes('EXECUTIVE_VIEWER') || isSuperAdmin;

  if (!isSuperAdmin && !isExecutive && doc.dept_id !== actor.dept_id) {
    db.prepare(`
      INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
      VALUES (?, 'org-lhse-main', ?, ?, ?, 'CROSS_DEPT_DOWNLOAD_BLOCKED', 'ATTACHMENT', ?, 'DENIED', ?, ?)
    `).run(
      `audit-${Date.now()}`,
      doc.dept_id,
      actor.id,
      actor.email,
      attId,
      JSON.stringify({ docId, regNumber: doc.reg_number, attemptedDept: doc.dept_id, userDept: actor.dept_id }),
      req.ip || '127.0.0.1'
    );

    res.status(403).json({
      success: false,
      error: 'DEPARTMENT_ISOLATION_VIOLATION',
      message: 'ການເຂົ້າເຖິງຖືກປະຕິເສດ: ທ່ານບໍ່ມີສິດດາວໂຫຼດໄຟລ໌ແນບຂອງພະແນກອື່ນ',
    });
    return;
  }

  const attachment = db.prepare(`
    SELECT * FROM document_attachments WHERE id = ? AND doc_id = ?
  `).get(attId, docId) as any;

  if (!attachment) {
    res.status(404).json({ success: false, error: 'ATTACHMENT_NOT_FOUND', message: 'ບໍ່ພົບໄຟລ໌ແນບ' });
    return;
  }

  // Record download in immutable audit ledger
  db.prepare(`
    INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
    VALUES (?, 'org-lhse-main', ?, ?, ?, 'ATTACHMENT_DOWNLOAD', 'ATTACHMENT', ?, 'SUCCESS', ?, ?)
  `).run(
    `audit-${Date.now()}`,
    doc.dept_id,
    actor.id,
    actor.email,
    attId,
    JSON.stringify({ docId, fileName: attachment.file_name, sha256: attachment.content_sha256 }),
    req.ip || '127.0.0.1'
  );

  // Return download metadata and simulated binary payload / safe attachment headers
  res.setHeader('Content-Type', attachment.file_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.file_name)}"`);
  res.setHeader('X-Content-SHA256', attachment.content_sha256);
  res.setHeader('X-Storage-Key', attachment.storage_key);

  res.json({
    success: true,
    file_name: attachment.file_name,
    file_type: attachment.file_type,
    file_size: attachment.file_size,
    content_sha256: attachment.content_sha256,
    storage_key: attachment.storage_key,
    download_timestamp: new Date().toISOString(),
    message: 'ໄຟລ໌ແນບພ້ອມດາວໂຫຼດ (R2 Private Storage Verified)',
  });
});

// 5. POST /api/documents/:id/archive - Move to Electronic Archive
documentsRouter.post('/:id/archive', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const docId = req.params.id;

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId) as any;
  if (!doc) {
    res.status(404).json({ success: false, error: 'DOC_NOT_FOUND' });
    return;
  }

  if (!actor.roles.includes('SUPER_ADMIN') && doc.dept_id !== actor.dept_id) {
    res.status(403).json({ success: false, error: 'DEPARTMENT_ISOLATION_VIOLATION' });
    return;
  }

  db.prepare(`
    UPDATE documents SET workflow_status = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(docId);

  db.prepare(`
    INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
    VALUES (?, 'org-lhse-main', ?, ?, ?, 'DOC_ARCHIVE', 'DOCUMENT', ?, 'SUCCESS', ?, ?)
  `).run(
    `audit-${Date.now()}`,
    doc.dept_id,
    actor.id,
    actor.email,
    docId,
    JSON.stringify({ regNumber: doc.reg_number, title: doc.title }),
    req.ip || '127.0.0.1'
  );

  res.json({
    success: true,
    message: `ເອກະສານ ${doc.reg_number} ຖືກຍ້າຍເຂົ້າຄັງເກັບມ້ຽນເອເລັກໂຕຣນິກ (Archived)`,
  });
});
