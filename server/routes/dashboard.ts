import { Router, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const dashboardRouter = Router();

// Helper to calculate date cutoff based on period
function getDateFilterClause(period: string, startDate?: string, endDate?: string): { sql: string; params: any[] } {
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
  } else if (period === 'custom') {
    if (startDate && endDate) {
      return { sql: "date(doc_date) BETWEEN date(?) AND date(?)", params: [startDate, endDate] };
    } else if (startDate) {
      return { sql: "date(doc_date) >= date(?)", params: [startDate] };
    } else if (endDate) {
      return { sql: "date(doc_date) <= date(?)", params: [endDate] };
    }
  }
  // Default to quarterly
  return { sql: "doc_date >= date('now', '-90 days', 'localtime')", params: [] };
}

// 1. Executive Dashboard Aggregated Data & Recharts Series
dashboardRouter.get('/executive', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');
  const isExecutive = actor.roles.includes('EXECUTIVE_VIEWER') || isSuperAdmin;

  if (!isExecutive) {
    res.status(403).json({
      success: false,
      error: 'EXECUTIVE_ACCESS_REQUIRED',
      message: 'ສະເພາະຄະນະອຳນວຍການ ຫຼື Super Admin ເທົ່ານັ້ນທີ່ສາມາດເບິ່ງ Executive Dashboard',
    });
    return;
  }

  const period = String(req.query.period || 'quarterly');
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  const dateFilter = getDateFilterClause(period, startDate, endDate);

  // Overall KPI counts
  const totalDocs = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE ${dateFilter.sql}`).get(...dateFilter.params) as any)?.c || 0;
  const incomingDocs = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE doc_type = 'INCOMING' AND ${dateFilter.sql}`).get(...dateFilter.params) as any)?.c || 0;
  const outgoingDocs = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE doc_type = 'OUTGOING' AND ${dateFilter.sql}`).get(...dateFilter.params) as any)?.c || 0;
  const internalDocs = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE doc_type = 'INTERNAL' AND ${dateFilter.sql}`).get(...dateFilter.params) as any)?.c || 0;
  
  const pendingApproval = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE workflow_status = 'IN_REVIEW' AND ${dateFilter.sql}`).get(...dateFilter.params) as any)?.c || 0;
  const pendingSignature = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE workflow_status = 'APPROVED' AND ${dateFilter.sql}`).get(...dateFilter.params) as any)?.c || 0;
  const completedDocs = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE workflow_status IN ('SIGNED', 'COMPLETED') AND ${dateFilter.sql}`).get(...dateFilter.params) as any)?.c || 0;
  const overdueDocs = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE workflow_status NOT IN ('COMPLETED', 'ARCHIVED') AND doc_date < date('now', '-14 days') AND ${dateFilter.sql}`).get(...dateFilter.params) as any)?.c || 0;

  // 1. Department Volume Bar Chart Series
  const deptVolumeRows = db.prepare(`
    SELECT d.code, d.name_lo, d.name_en,
           SUM(CASE WHEN doc.doc_type = 'INCOMING' THEN 1 ELSE 0 END) as incoming,
           SUM(CASE WHEN doc.doc_type = 'OUTGOING' THEN 1 ELSE 0 END) as outgoing,
           SUM(CASE WHEN doc.doc_type = 'INTERNAL' THEN 1 ELSE 0 END) as internal,
           COUNT(doc.id) as total
    FROM departments d
    LEFT JOIN documents doc ON d.id = doc.dept_id AND (${dateFilter.sql})
    GROUP BY d.id
    ORDER BY d.code ASC
  `).all(...dateFilter.params) as any[];

  // 2. Trend Line Chart Series (grouped by date / week)
  const trendRows = db.prepare(`
    SELECT date(doc_date) as date_label,
           COUNT(id) as total_registered,
           SUM(CASE WHEN workflow_status IN ('APPROVED', 'SIGNED', 'COMPLETED') THEN 1 ELSE 0 END) as approved_count
    FROM documents
    WHERE ${dateFilter.sql}
    GROUP BY date(doc_date)
    ORDER BY date(doc_date) ASC
  `).all(...dateFilter.params) as any[];

  // 3. Confidentiality Distribution (Donut / Pie Chart)
  const confidentialityRows = db.prepare(`
    SELECT confidentiality, COUNT(*) as count
    FROM documents
    WHERE ${dateFilter.sql}
    GROUP BY confidentiality
  `).all(...dateFilter.params) as any[];

  // 4. Priority Distribution (Donut / Pie Chart)
  const priorityRows = db.prepare(`
    SELECT priority, COUNT(*) as count
    FROM documents
    WHERE ${dateFilter.sql}
    GROUP BY priority
  `).all(...dateFilter.params) as any[];

  // 5. Stacked Bar Chart Series: Status Pipeline per Department
  const deptStatusRows = db.prepare(`
    SELECT d.code, d.name_lo,
           SUM(CASE WHEN doc.workflow_status = 'REGISTERED' THEN 1 ELSE 0 END) as registered,
           SUM(CASE WHEN doc.workflow_status = 'ASSIGNED' THEN 1 ELSE 0 END) as assigned,
           SUM(CASE WHEN doc.workflow_status = 'IN_REVIEW' THEN 1 ELSE 0 END) as in_review,
           SUM(CASE WHEN doc.workflow_status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
           SUM(CASE WHEN doc.workflow_status IN ('SIGNED', 'COMPLETED') THEN 1 ELSE 0 END) as completed
    FROM departments d
    LEFT JOIN documents doc ON d.id = doc.dept_id AND (${dateFilter.sql})
    GROUP BY d.id
    ORDER BY d.code ASC
  `).all(...dateFilter.params) as any[];

  res.json({
    success: true,
    period,
    kpi: {
      totalDocs,
      incomingDocs,
      outgoingDocs,
      internalDocs,
      pendingApproval,
      pendingSignature,
      completedDocs,
      overdueDocs,
    },
    charts: {
      deptVolume: deptVolumeRows,
      velocityTrend: trendRows,
      confidentiality: confidentialityRows,
      priority: priorityRows,
      deptStatus: deptStatusRows,
    },
  });
});

// 2. Department Dashboard Data (Strictly Isolated to User's Department)
dashboardRouter.get('/department', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const targetDeptId = req.query.dept_id as string || actor.dept_id;

  // Enforce department isolation
  if (!actor.roles.includes('SUPER_ADMIN') && targetDeptId !== actor.dept_id) {
    res.status(403).json({
      success: false,
      error: 'DEPARTMENT_ISOLATION_VIOLATION',
      message: 'ການເຂົ້າເຖິງຖືກປະຕິເສດ: ທ່ານບໍ່ມີສິດເບິ່ງ Dashboard ຂອງພະແນກອື່ນ',
    });
    return;
  }

  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(targetDeptId) as any;
  if (!dept) {
    res.status(404).json({ success: false, error: 'DEPT_NOT_FOUND' });
    return;
  }

  const period = String(req.query.period || 'quarterly');
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  const dateFilter = getDateFilterClause(period, startDate, endDate);

  const totalDeptDocs = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE dept_id = ? AND (${dateFilter.sql})`).get(targetDeptId, ...dateFilter.params) as any)?.c || 0;
  const inReview = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE dept_id = ? AND workflow_status = 'IN_REVIEW' AND (${dateFilter.sql})`).get(targetDeptId, ...dateFilter.params) as any)?.c || 0;
  const approved = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE dept_id = ? AND workflow_status = 'APPROVED' AND (${dateFilter.sql})`).get(targetDeptId, ...dateFilter.params) as any)?.c || 0;
  const signed = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE dept_id = ? AND workflow_status IN ('SIGNED', 'COMPLETED') AND (${dateFilter.sql})`).get(targetDeptId, ...dateFilter.params) as any)?.c || 0;

  // Recent Department Documents
  const recentDocs = db.prepare(`
    SELECT id, reg_number, doc_type, title, sender, doc_date, priority, confidentiality, workflow_status, created_at
    FROM documents
    WHERE dept_id = ? AND (${dateFilter.sql})
    ORDER BY created_at DESC
    LIMIT 15
  `).all(targetDeptId, ...dateFilter.params);

  // Department Staff List with Roles & Positions
  const staff = db.prepare(`
    SELECT u.id, u.full_name_lo, u.full_name_en, u.email, u.status, p.title_lo as position_title_lo
    FROM users u
    LEFT JOIN positions_v2 p ON u.position_id = p.id
    WHERE u.dept_id = ?
  `).all(targetDeptId);

  res.json({
    success: true,
    department: dept,
    period,
    startDate,
    endDate,
    kpi: {
      totalDocs: totalDeptDocs,
      inReview,
      approved,
      signed,
    },
    recentDocs,
    staff,
  });
});

// 3. Filtered Records Drill-down API (Invoked when clicking Recharts bars, nodes, or slices)
dashboardRouter.get('/filtered-records', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');

  const {
    dept_code,
    dept_id,
    doc_type,
    workflow_status,
    confidentiality,
    priority,
    period = 'quarterly',
    startDate,
    endDate,
  } = req.query;

  // Department isolation enforcement
  let effectiveDeptId = dept_id as string | undefined;
  if (!isSuperAdmin) {
    if (effectiveDeptId && effectiveDeptId !== actor.dept_id) {
      res.status(403).json({
        success: false,
        error: 'DEPARTMENT_ISOLATION_VIOLATION',
        message: 'ທ່ານບໍ່ມີສິດເຂົ້າເຖິງລາຍການເອກະສານຂອງພະແນກອື່ນ',
      });
      return;
    }
    effectiveDeptId = actor.dept_id || undefined;
  }

  let query = `
    SELECT doc.*, d.name_lo as dept_name_lo, d.name_en as dept_name_en, d.code as dept_code
    FROM documents doc
    JOIN departments d ON doc.dept_id = d.id
  `;
  const conditions: string[] = [];
  const params: any[] = [];

  if (effectiveDeptId) {
    conditions.push('doc.dept_id = ?');
    params.push(effectiveDeptId);
  } else if (dept_code) {
    conditions.push('d.code = ?');
    params.push(dept_code);
  }

  if (doc_type) {
    conditions.push('doc.doc_type = ?');
    params.push(doc_type);
  }

  if (workflow_status) {
    conditions.push('doc.workflow_status = ?');
    params.push(workflow_status);
  }

  if (confidentiality) {
    conditions.push('doc.confidentiality = ?');
    params.push(confidentiality);
  }

  if (priority) {
    conditions.push('doc.priority = ?');
    params.push(priority);
  }

  // Date period & custom range
  const dateFilter = getDateFilterClause(String(period), startDate as string | undefined, endDate as string | undefined);
  conditions.push(dateFilter.sql);
  params.push(...dateFilter.params);

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY doc.doc_date DESC, doc.created_at DESC LIMIT 100';

  const records = db.prepare(query).all(...params);

  res.json({
    success: true,
    total: records.length,
    filterCriteria: {
      dept_code,
      effectiveDeptId,
      doc_type,
      workflow_status,
      confidentiality,
      priority,
      period,
      startDate,
      endDate,
    },
    records,
  });
});

// Legacy simple stats endpoint
dashboardRouter.get('/stats', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user!;
  const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');

  let baseWhere = isSuperAdmin ? '' : `WHERE dept_id = '${actor.dept_id}'`;

  const totalUsers = (db.prepare(`SELECT COUNT(*) as c FROM users ${baseWhere}`).get() as any)?.c || 0;
  const totalDepts = (db.prepare('SELECT COUNT(*) as c FROM departments').get() as any)?.c || 0;
  const totalAuditEvents = (db.prepare(`SELECT COUNT(*) as c FROM audit_logs ${baseWhere}`).get() as any)?.c || 0;
  const totalDocs = (db.prepare(`SELECT COUNT(*) as c FROM documents ${baseWhere}`).get() as any)?.c || 0;

  const deptDistribution = db.prepare(`
    SELECT d.code, d.name_lo, d.name_en,
           (SELECT COUNT(*) FROM users u WHERE u.dept_id = d.id) as user_count,
           (SELECT COUNT(*) FROM documents doc WHERE doc.dept_id = d.id) as doc_count
    FROM departments d
    ORDER BY d.code ASC
  `).all();

  res.json({
    success: true,
    stats: {
      totalUsers,
      totalDepts,
      totalAuditEvents,
      totalDocs,
      deptDistribution,
    },
  });
});
