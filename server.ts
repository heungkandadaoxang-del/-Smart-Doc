import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './server/db.js';
import { runBootstrap } from './server/bootstrap.js';
import { authRouter } from './server/routes/auth.js';
import { usersRouter } from './server/routes/users.js';
import { departmentsRouter } from './server/routes/departments.js';
import { organizationRouter } from './server/routes/organization.js';
import { auditRouter } from './server/routes/audit.js';
import { securityTestRouter } from './server/routes/security-test.js';
import { dashboardRouter } from './server/routes/dashboard.js';
import { positionsRouter } from './server/routes/positions.js';
import { documentsRouter } from './server/routes/documents.js';
import { workflowsRouter } from './server/routes/workflows.js';
import { signaturesRouter } from './server/routes/signatures.js';
import { reportsRouter } from './server/routes/reports.js';
import { backupRouter } from './server/routes/backup.js';
import { initWebSocketServer } from './server/services/notifications.js';
import { runIncrementalBackup } from './server/services/backup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // 1. Initialize SQLite Database (Cloudflare D1 schema parity) & Idempotent Bootstrap
  initDatabase();
  const bootstrapInfo = await runBootstrap();
  console.log(`[Smart E-Doc-LHSE] Database initialized. Super Admin: ${bootstrapInfo.superAdminEmail}`);
  if (bootstrapInfo.isFirstRun) {
    console.log(`[Smart E-Doc-LHSE] First-time setup: Super Admin bootstrapped with temporary credential.`);
  }

  // 2. Middleware & Security Headers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // 3. Mount API Routers
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/departments', departmentsRouter);
  app.use('/api/organization', organizationRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/security-test', securityTestRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/positions', positionsRouter);
  app.use('/api/documents', documentsRouter);
  app.use('/api/workflows', workflowsRouter);
  app.use('/api/signatures', signaturesRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/backup', backupRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'UP',
      app: 'Smart E-Doc-LHSE-V01',
      organization: 'Lao State Enterprise Holding (LHSE)',
      timezone: 'Asia/Vientiane',
      timestamp: new Date().toISOString(),
    });
  });

  // 4. Vite Frontend Dev Server integration
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static frontend build
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  const server = http.createServer(app);

  // 5. Initialize Real-Time WebSocket Server
  initWebSocketServer(server);

  // 6. Automated Scheduled Incremental Backup Service (Every 6 hours / 21,600,000 ms)
  // Run initial disaster recovery backup verification asynchronously
  setTimeout(async () => {
    try {
      console.log('[Smart E-Doc-LHSE] Initializing scheduled D1 & R2 incremental backup...');
      const initialBackup = await runIncrementalBackup('CRON_SCHEDULED');
      console.log(`[Smart E-Doc-LHSE] Incremental backup completed (${initialBackup.backupId}) - DR Readiness: ${initialBackup.disasterRecoveryReadiness}`);
    } catch (e) {
      console.error('[Smart E-Doc-LHSE] Initial backup error:', e);
    }
  }, 2000);

  // Recurring 6-hour cron interval
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      console.log('[Smart E-Doc-LHSE] Executing scheduled incremental backup cron...');
      await runIncrementalBackup('CRON_SCHEDULED');
    } catch (e) {
      console.error('[Smart E-Doc-LHSE] Scheduled backup cron error:', e);
    }
  }, SIX_HOURS_MS);

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Smart E-Doc-LHSE] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[Smart E-Doc-LHSE] Failed to start server:', err);
  process.exit(1);
});
