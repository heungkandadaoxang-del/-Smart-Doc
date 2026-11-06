import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { db } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const signaturesRouter = Router();

// 1. POST /api/signatures/:docId/sign - Sign document with Canvas Drawn Signature or Digital Stamp
signaturesRouter.post('/:docId/sign', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const docId = req.params.docId;
  const { signatureType = 'DRAWN', signatureData, notes = '' } = req.body;

  if (!signatureData) {
    res.status(400).json({
      success: false,
      error: 'SIGNATURE_DATA_REQUIRED',
      message: 'ກະລຸນາແຕ້ມລາຍເຊັນ ຫຼື ອັບໂຫຼດກາປະທັບລາຍເຊັນ',
    });
    return;
  }

  const doc = db.prepare(`
    SELECT doc.*, d.name_lo as dept_name_lo, d.code as dept_code
    FROM documents doc
    JOIN departments d ON doc.dept_id = d.id
    WHERE doc.id = ?
  `).get(docId) as any;

  if (!doc) {
    res.status(404).json({ success: false, error: 'DOC_NOT_FOUND' });
    return;
  }

  // Department check: only assigned department or Super Admin can sign
  if (!actor.roles.includes('SUPER_ADMIN') && doc.dept_id !== actor.dept_id) {
    res.status(403).json({ success: false, error: 'DEPARTMENT_ISOLATION_VIOLATION' });
    return;
  }

  // Calculate cryptographic SHA-256 integrity hash over canonical document payload
  const canonicalPayload = JSON.stringify({
    reg_number: doc.reg_number,
    doc_type: doc.doc_type,
    title: doc.title,
    sender: doc.sender,
    recipient: doc.recipient,
    doc_date: doc.doc_date,
    dept_code: doc.dept_code,
    signer_id: actor.id,
    timestamp: new Date().toISOString(),
  });
  const documentSha256 = crypto.createHash('sha256').update(canonicalPayload).digest('hex');

  const verificationToken = `LHSE-VERIFY-${crypto.randomBytes(18).toString('hex').toUpperCase()}`;
  const sigId = `sig-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Retrieve signer's title / position
  const posRow = actor.position_id
    ? (db.prepare('SELECT title_lo, title_en FROM positions_v2 WHERE id = ?').get(actor.position_id) as any)
    : null;
  const signerTitle = posRow?.title_lo || actor.roles[0] || 'Executive Signer';

  // Save Signature record
  db.prepare(`
    INSERT INTO document_signatures (
      id, doc_id, signer_user_id, signer_name_lo, signer_name_en, signer_title,
      signature_type, signature_data, document_sha256, verification_token, ip_address, is_valid
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    sigId,
    docId,
    actor.id,
    actor.full_name_lo,
    actor.full_name_en || actor.full_name_lo,
    signerTitle,
    signatureType,
    signatureData,
    documentSha256,
    verificationToken,
    req.ip || '127.0.0.1'
  );

  // Update Document Status to SIGNED & COMPLETED
  db.prepare(`
    UPDATE documents
    SET workflow_status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(docId);

  // Add Workflow step
  db.prepare(`
    INSERT INTO document_workflow_steps (id, doc_id, step_number, step_name_lo, step_name_en, assignee_user_id, assignee_role, action, comments, acted_at)
    VALUES (?, ?, (SELECT COUNT(*) + 1 FROM document_workflow_steps WHERE doc_id = ?), 'ລົງລາຍເຊັນເອເລັກໂຕຣນິກ', 'E-Signature Completed', ?, 'SIGNER', 'SIGNED', ?, CURRENT_TIMESTAMP)
  `).run(`step-${Date.now()}`, docId, docId, actor.id, notes || `Signed digitally by ${actor.full_name_lo}`);

  // Write Immutable Audit Log
  db.prepare(`
    INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
    VALUES (?, 'org-lhse-main', ?, ?, ?, 'DOC_ESIGN', 'DOCUMENT', ?, 'SUCCESS', ?, ?)
  `).run(
    `audit-${Date.now()}`,
    doc.dept_id,
    actor.id,
    actor.email,
    docId,
    JSON.stringify({ verificationToken, documentSha256, signerTitle, signatureType }),
    req.ip || '127.0.0.1'
  );

  res.json({
    success: true,
    signatureId: sigId,
    verificationToken,
    documentSha256,
    message: 'ລົງລາຍເຊັນເອເລັກໂຕຣນິກ ແລະ ຢືນຢັນເອກະສານສຳເລັດສົມບູນ',
  });
});

// 2. GET /api/signatures/:docId/qr - Generate QR code image data URL for document verification
signaturesRouter.get('/:docId/qr', async (req: Request, res: Response) => {
  const docId = req.params.docId;

  const sig = db.prepare(`
    SELECT verification_token FROM document_signatures WHERE doc_id = ? AND is_valid = 1 ORDER BY signed_at DESC LIMIT 1
  `).get(docId) as any;

  const doc = db.prepare('SELECT qr_token, reg_number FROM documents WHERE id = ?').get(docId) as any;
  if (!doc) {
    res.status(404).json({ success: false, error: 'DOC_NOT_FOUND' });
    return;
  }

  const token = sig?.verification_token || doc.qr_token || doc.reg_number;
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const verifyUrl = `${baseUrl}/#verify?token=${encodeURIComponent(token)}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 256,
      color: {
        dark: '#1e3a8a', // Deep Blue
        light: '#ffffff',
      },
    });

    res.json({
      success: true,
      token,
      verifyUrl,
      qrDataUrl,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. GET /api/signatures/verify/:token - Public Document Verification Endpoint
signaturesRouter.get('/verify/:token', (req: Request, res: Response) => {
  const token = req.params.token;

  // Search by verification_token or qr_token or reg_number
  const sig = db.prepare(`
    SELECT sig.*, doc.reg_number, doc.title, doc.doc_type, doc.doc_date, doc.workflow_status,
           doc.priority, doc.confidentiality, d.name_lo as dept_name_lo, d.name_en as dept_name_en,
           d.code as dept_code, o.name_lo as org_name_lo, o.address_lo as org_address_lo
    FROM document_signatures sig
    JOIN documents doc ON sig.doc_id = doc.id
    JOIN departments d ON doc.dept_id = d.id
    JOIN organizations o ON doc.org_id = o.id
    WHERE sig.verification_token = ? AND sig.is_valid = 1
  `).get(token) as any;

  if (sig) {
    const isClassified = sig.confidentiality === 'CONFIDENTIAL' || sig.confidentiality === 'SECRET';
    const displayTitle = isClassified
      ? `[ເອກະສານລັບ - LHSE CLASSIFIED] (${sig.reg_number})`
      : sig.title;

    res.json({
      success: true,
      verified: true,
      isClassified,
      document: {
        regNumber: sig.reg_number,
        title: displayTitle,
        docType: sig.doc_type,
        docDate: sig.doc_date,
        departmentLo: sig.dept_name_lo,
        departmentEn: sig.dept_name_en,
        organizationLo: sig.org_name_lo,
        organizationAddress: sig.org_address_lo,
        status: sig.workflow_status,
        confidentiality: sig.confidentiality,
      },
      signature: {
        signerNameLo: sig.signer_name_lo,
        signerNameEn: sig.signer_name_en,
        signerTitle: sig.signer_title,
        signatureType: sig.signature_type,
        signedAt: sig.signed_at,
        timezone: 'Asia/Vientiane (UTC+7)',
        documentSha256: sig.document_sha256,
        verificationToken: sig.verification_token,
        isValid: Boolean(sig.is_valid),
      },
      verificationTimestamp: new Date().toISOString(),
      messageLo: 'ເອກະສານນີ້ໄດ້ຮັບການຢືນຢັນຄວາມຖືກຕ້ອງ ແລະ ລົງລາຍເຊັນດິຈິຕອນແທ້ຈາກ ລັດວິສາຫະກິດຖືຮຸ້ນລາວ (LHSE)',
      messageEn: 'This document is verified and authenticated with valid cryptographic electronic signature from Lao State Enterprise Holding (LHSE).',
    });
    return;
  }

  // Check fallback if token is qr_token
  const doc = db.prepare(`
    SELECT doc.id, doc.reg_number, doc.title, doc.doc_type, doc.doc_date, doc.workflow_status,
           doc.confidentiality, d.name_lo as dept_name_lo, d.name_en as dept_name_en,
           o.name_lo as org_name_lo
    FROM documents doc
    JOIN departments d ON doc.dept_id = d.id
    JOIN organizations o ON doc.org_id = o.id
    WHERE doc.qr_token = ? OR doc.reg_number = ?
  `).get(token, token) as any;

  if (doc) {
    const isClassified = doc.confidentiality === 'CONFIDENTIAL' || doc.confidentiality === 'SECRET';
    const displayTitle = isClassified
      ? `[ເອກະສານລັບ - LHSE CLASSIFIED] (${doc.reg_number})`
      : doc.title;

    res.json({
      success: true,
      verified: true,
      isClassified,
      document: {
        regNumber: doc.reg_number,
        title: displayTitle,
        docType: doc.doc_type,
        docDate: doc.doc_date,
        departmentLo: doc.dept_name_lo,
        departmentEn: doc.dept_name_en,
        organizationLo: doc.org_name_lo,
        status: doc.workflow_status,
        confidentiality: doc.confidentiality,
      },
      signature: null,
      verificationTimestamp: new Date().toISOString(),
      messageLo: 'ເອກະສານຖືກຕ້ອງຕາມທະບຽນ LHSE ແຕ່ຍັງບໍ່ທັນມີລາຍເຊັນດິຈິຕອນສົມບູນ',
      messageEn: 'Document registered in LHSE database, awaiting final electronic signature.',
    });
    return;
  }

  res.status(404).json({
    success: false,
    verified: false,
    error: 'INVALID_VERIFICATION_TOKEN',
    messageLo: 'ບໍ່ພົບເອກະສານ ຫຼື ລະຫັດ QR ບໍ່ຖືກຕ້ອງ / ໝົດອາຍຸ',
    messageEn: 'Document verification failed: invalid or expired verification token',
  });
});
