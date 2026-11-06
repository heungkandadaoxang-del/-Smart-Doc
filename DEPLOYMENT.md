# Cloudflare Production Deployment Guide
## Project: Smart E-Doc-LHSE-V01
## Organization: Lao State Enterprise Holding (ລັດວິສາຫະກິດຖືຮຸ້ນລາວ)

This document provides step-by-step instructions for deploying Smart E-Doc-LHSE-V01 to Cloudflare Pages, Cloudflare Workers, Cloudflare D1 (Relational SQLite), and Private Cloudflare R2 object storage.

---

### 1. Prerequisites
- [Node.js](https://nodejs.org) >= 20.x
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/): `npm install -g wrangler`
- Cloudflare Account with access to D1, R2, and Pages.

---

### 2. Cloudflare D1 Database Provisioning
Run the following commands using Wrangler:

```bash
# 1. Login to Cloudflare
wrangler login

# 2. Create the production D1 database
wrangler d1 create lhse-edoc-d1

# Note the database_id returned in the output and verify it in wrangler.toml:
# [[d1_databases]]
# binding = "DB"
# database_name = "lhse-edoc-d1"
# database_id = "<your-d1-database-id>"

# 3. Apply the D1 database migration schema
wrangler d1 execute lhse-edoc-d1 --file=./migrations/0001_initial_schema.sql
```

---

### 3. Cloudflare R2 Storage Provisioning
Create private buckets for secure document and attachment storage:

```bash
# 1. Create the primary private document bucket
wrangler r2 bucket create lhse-edoc-private-documents

# 2. Verify binding in wrangler.toml:
# [[r2_buckets]]
# binding = "LHSE_DOCS_STORAGE"
# bucket_name = "lhse-edoc-private-documents"
```

---

### 4. Setting Production Environment Secrets
Securely provision the bootstrap secret without placing plaintext credentials in Git:

```bash
# Set initial admin temporary setup password secret
wrangler secret put INITIAL_ADMIN_PASSWORD
# (Enter a secure temporary password when prompted, e.g., LHSE#Bootstrap2026!)

# Set JWT/Session encryption secret
wrangler secret put SESSION_SECRET
```

---

### 5. Frontend & Pages Deployment
Build the React SPA and deploy to Cloudflare Pages:

```bash
# 1. Build the Vite production bundle
npm run build

# 2. Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=smart-edoc-lhse-v01
```

---

### 6. Cloudflare Workers API Deployment
Deploy the Workers Edge API handler:

```bash
wrangler deploy
```

---

### 7. Verification & Post-Deployment Checklist
1. Visit the deployed application URL.
2. Sign in using the initial Super Admin identity: `nokohn@gmail.com`.
3. Complete the mandatory password change on first login.
4. Open the Security Settings tab and configure Google Authenticator MFA.
5. In User Management, invite and activate the 5 Designated Department Admins:
   - ພະແນກບໍລິຫານ ບັນຊີ ແລະ ການເງິນ: ນາງ ທິບດາວອນ
   - ພະແນກພັດທະນາ: ນາງ ໜິງ
   - ພະແນກທຸລະກິດແຜນການ: ສຸພາລັກ
   - ພະແນກທຸລະກິດຂີ້ເທົ່າລອຍ: ທ້າວ ກິລິນທອນ
   - ພະແນກກວດສອບພາຍໃນ: ທ້າວ ວິລະປັນຍາ
6. Execute the automated Phase 1 - 7 Acceptance Suite from the UI.

---

### 8. Disaster Recovery (DR) & Automated Incremental Backup
Smart E-Doc-LHSE-V01 includes automated serverless backup routines:
- **Cloudflare Cron Triggers**: Configured in `wrangler.toml` with `crons = ["0 */6 * * *"]` (every 6 hours).
- **Incremental Snapshot**: Snapshots all D1 relational tables (`organizations`, `departments`, `positions_v2`, `users`, `documents`, `document_attachments`, `document_versions`, `document_workflow_steps`, `document_signatures`, `notifications`).
- **Integrity Digest**: Computes SHA-256 checksum over snapshot data before writing to Cloudflare R2 backup bucket (`lhse-edoc-backup-archives`).
- **Audit Verification**: Every backup run writes an immutable status record into `audit_logs` with action `DISASTER_RECOVERY_BACKUP` and status `SUCCESS`.
- **Sandbox Restore Validation**: Disaster recovery readiness can be verified on-demand via `POST /api/backup/verify-restore` or the Disaster Recovery UI tab, reconstructing tables in an isolated SQLite memory sandbox without altering live database records.

---

### 9. Rollback & Emergency Incident Response Plan
In the event of an operational incident or failed release:

1. **Rollback Cloudflare Pages Frontend**:
   ```bash
   wrangler pages deployment list --project-name=smart-edoc-lhse-v01
   wrangler pages deployment rollback <previous-deployment-id> --project-name=smart-edoc-lhse-v01
   ```

2. **Rollback Cloudflare Workers API**:
   ```bash
   wrangler rollback <version-id>
   ```

3. **Restore Database from D1/R2 Incremental Backup**:
   ```bash
   # Retrieve target backup snapshot from R2
   wrangler r2 object get lhse-edoc-backup-archives/backups/incremental/<date>/<backup-id>.json ./restore.json

   # Execute schema and data reconstruction via D1 CLI
   wrangler d1 execute lhse-edoc-d1 --file=./migrations/0001_initial_schema.sql
   wrangler d1 execute lhse-edoc-d1 --file=./migrations/0002_phase2_positions_and_kpis.sql
   wrangler d1 execute lhse-edoc-d1 --file=./migrations/0003_phases_3_to_6.sql
   ```
4. **Audit Logging**: Confirm incident recovery and append resolution details to `audit_logs`.

