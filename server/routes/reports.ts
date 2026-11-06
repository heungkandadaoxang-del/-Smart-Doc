import { Router, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const reportsRouter = Router();

function getDateClause(period: string, startDate?: string, endDate?: string): { sql: string; params: any[] } {
  if (period === 'daily') {
    return { sql: "date(doc_date) = date('now', 'localtime')", params: [] };
  } else if (period === 'weekly') {
    return { sql: "doc_date >= date('now', '-7 days', 'localtime')", params: [] };
  } else if (period === 'monthly') {
    return { sql: "doc_date >= date('now', '-30 days', 'localtime')", params: [] };
  } else if (period === 'quarterly') {
    return { sql: "doc_date >= date('now', '-90 days', 'localtime')", params: [] };
  } else if (period === 'half_yearly') {
    return { sql: "doc_date >= date('now', '-180 days', 'localtime')", params: [] };
  } else if (period === 'yearly') {
    return { sql: "doc_date >= date('now', '-365 days', 'localtime')", params: [] };
  } else if (period === 'custom' && startDate && endDate) {
    return { sql: "date(doc_date) BETWEEN date(?) AND date(?)", params: [startDate, endDate] };
  }
  return { sql: "doc_date >= date('now', '-90 days', 'localtime')", params: [] };
}

// 1. GET /api/reports/summary - Multi-period aggregate analytics
reportsRouter.get('/summary', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');
  const isExecutive = actor.roles.includes('EXECUTIVE_VIEWER') || isSuperAdmin;

  const { period = 'quarterly', startDate, endDate, dept_id } = req.query;
  const dateFilter = getDateClause(String(period), startDate as string, endDate as string);

  let deptConstraint = '';
  const params: any[] = [...dateFilter.params];

  if (!isSuperAdmin && !isExecutive) {
    deptConstraint = ' AND dept_id = ?';
    params.push(actor.dept_id);
  } else if (dept_id && dept_id !== 'ALL') {
    deptConstraint = ' AND dept_id = ?';
    params.push(dept_id);
  }

  // Summary counts
  const total = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE (${dateFilter.sql}) ${deptConstraint}`).get(...params) as any)?.c || 0;
  const incoming = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE doc_type = 'INCOMING' AND (${dateFilter.sql}) ${deptConstraint}`).get(...params) as any)?.c || 0;
  const outgoing = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE doc_type = 'OUTGOING' AND (${dateFilter.sql}) ${deptConstraint}`).get(...params) as any)?.c || 0;
  const internal = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE doc_type = 'INTERNAL' AND (${dateFilter.sql}) ${deptConstraint}`).get(...params) as any)?.c || 0;
  const completed = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE workflow_status IN ('SIGNED', 'COMPLETED') AND (${dateFilter.sql}) ${deptConstraint}`).get(...params) as any)?.c || 0;
  const pending = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE workflow_status IN ('REGISTERED', 'IN_REVIEW', 'APPROVED') AND (${dateFilter.sql}) ${deptConstraint}`).get(...params) as any)?.c || 0;
  const overdue = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE workflow_status NOT IN ('COMPLETED', 'ARCHIVED') AND doc_date < date('now', '-14 days') AND (${dateFilter.sql}) ${deptConstraint}`).get(...params) as any)?.c || 0;

  // Department comparison
  const deptStats = db.prepare(`
    SELECT d.id, d.code, d.name_lo, d.name_en,
           COUNT(doc.id) as total_docs,
           SUM(CASE WHEN doc.doc_type = 'INCOMING' THEN 1 ELSE 0 END) as incoming_docs,
           SUM(CASE WHEN doc.doc_type = 'OUTGOING' THEN 1 ELSE 0 END) as outgoing_docs,
           SUM(CASE WHEN doc.doc_type = 'INTERNAL' THEN 1 ELSE 0 END) as internal_docs,
           SUM(CASE WHEN doc.workflow_status IN ('SIGNED', 'COMPLETED') THEN 1 ELSE 0 END) as completed_docs,
           SUM(CASE WHEN doc.workflow_status NOT IN ('COMPLETED', 'ARCHIVED') AND doc.doc_date < date('now', '-14 days') THEN 1 ELSE 0 END) as overdue_docs
    FROM departments d
    LEFT JOIN documents doc ON d.id = doc.dept_id AND (${dateFilter.sql})
    GROUP BY d.id
    ORDER BY d.code ASC
  `).all(...dateFilter.params);

  // Status breakdown
  const statusStats = db.prepare(`
    SELECT workflow_status, COUNT(*) as count
    FROM documents
    WHERE (${dateFilter.sql}) ${deptConstraint}
    GROUP BY workflow_status
  `).all(...params);

  res.json({
    success: true,
    period,
    kpi: {
      total,
      incoming,
      outgoing,
      internal,
      completed,
      pending,
      overdue,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    },
    departmentComparison: deptStats,
    statusBreakdown: statusStats,
  });
});

// 2. GET /api/reports/export - Real Export in CSV with Lao UTF-8 BOM
reportsRouter.get('/export', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');
  const { format = 'csv', period = 'quarterly', startDate, endDate, doc_type } = req.query;

  const dateFilter = getDateClause(String(period), startDate as string, endDate as string);
  const params: any[] = [...dateFilter.params];

  let query = `
    SELECT doc.reg_number, doc.internal_ref, doc.doc_type, doc.title, doc.sender, doc.recipient,
           doc.doc_date, doc.priority, doc.confidentiality, doc.workflow_status,
           d.name_lo as dept_name_lo, d.code as dept_code, doc.created_at
    FROM documents doc
    JOIN departments d ON doc.dept_id = d.id
    WHERE (${dateFilter.sql})
  `;

  if (!isSuperAdmin) {
    query += ' AND doc.dept_id = ?';
    params.push(actor.dept_id);
  }

  if (doc_type && doc_type !== 'ALL') {
    query += ' AND doc.doc_type = ?';
    params.push(doc_type);
  }

  query += ' ORDER BY doc.doc_date DESC, doc.created_at DESC';
  const rows = db.prepare(query).all(...params) as any[];

  // Log export in audit ledger
  db.prepare(`
    INSERT INTO audit_logs (id, org_id, dept_id, actor_user_id, actor_email, action, entity_type, entity_id, status, details, ip_address)
    VALUES (?, 'org-lhse-main', ?, ?, ?, 'EXPORT_REPORT', 'REPORT', ?, 'SUCCESS', ?, ?)
  `).run(
    `audit-${Date.now()}`,
    actor.dept_id,
    actor.id,
    actor.email,
    `export-${period}`,
    JSON.stringify({ rowCount: rows.length, format, period }),
    req.ip || '127.0.0.1'
  );

  if (format === 'csv') {
    // UTF-8 BOM for Microsoft Excel Lao character recognition
    const BOM = '\uFEFF';
    const headers = [
      'ເລກທີທະບຽນ (Reg No)',
      'ປະເພດ (Type)',
      'ຫົວຂໍ້ເອກະສານ (Title)',
      'ພະແນກ (Department)',
      'ຜູ້ສົ່ງ (Sender)',
      'ຜູ້ຮັບ (Recipient)',
      'ວັນທີເອກະສານ (Date)',
      'ຄວາມຮີບດ່ວນ (Priority)',
      'ຊັ້ນຄວາມລັບ (Confidentiality)',
      'ສະຖານະຂັ້ນຕອນ (Status)',
    ];

    const escapeCsv = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
    const csvRows = [headers.join(',')];

    for (const r of rows) {
      csvRows.push([
        escapeCsv(r.reg_number),
        escapeCsv(r.doc_type),
        escapeCsv(r.title),
        escapeCsv(`${r.dept_code} - ${r.dept_name_lo}`),
        escapeCsv(r.sender),
        escapeCsv(r.recipient),
        escapeCsv(r.doc_date),
        escapeCsv(r.priority),
        escapeCsv(r.confidentiality),
        escapeCsv(r.workflow_status),
      ].join(','));
    }

    const csvContent = BOM + csvRows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="LHSE_EDoc_Report_${period}_${Date.now()}.csv"`);
    res.send(csvContent);
  } else {
    res.json({
      success: true,
      total: rows.length,
      records: rows,
    });
  }
});
