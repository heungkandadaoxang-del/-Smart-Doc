-- ====================================================================
-- Smart E-Doc-LHSE-V01 Database Schema (Cloudflare D1 / SQLite)
-- Migration: 0003_phases_3_to_6.sql
-- Modules: Documents, Attachments, Workflow/Approval, Signatures, QR, Notifications
-- ====================================================================

-- 1. Numbering Sequences for automated unique registration numbers
CREATE TABLE IF NOT EXISTS document_number_sequences (
    id TEXT PRIMARY KEY,
    dept_id TEXT NOT NULL,
    doc_type TEXT NOT NULL CHECK(doc_type IN ('INCOMING', 'OUTGOING', 'INTERNAL')),
    year INTEGER NOT NULL,
    current_sequence INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dept_id, doc_type, year),
    FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE CASCADE
);

-- 2. Document Attachments
CREATE TABLE IF NOT EXISTS document_attachments (
    id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    storage_key TEXT NOT NULL,
    content_sha256 TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    uploader_id TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Document Versions
CREATE TABLE IF NOT EXISTS document_versions (
    id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    changed_by TEXT NOT NULL,
    change_summary TEXT NOT NULL,
    file_attachment_id TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (file_attachment_id) REFERENCES document_attachments(id) ON DELETE SET NULL
);

-- 4. Workflow & Approval Steps
CREATE TABLE IF NOT EXISTS document_workflow_steps (
    id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    step_name_lo TEXT NOT NULL,
    step_name_en TEXT NOT NULL,
    assignee_user_id TEXT,
    assignee_role TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT 'PENDING' CHECK(action IN ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED_FOR_REVISION', 'ASSIGNED', 'SUBMITTED', 'SIGNED')),
    comments TEXT,
    acted_at DATETIME,
    deadline_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (assignee_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 5. Document Electronic Signatures & Cryptographic Stamps
CREATE TABLE IF NOT EXISTS document_signatures (
    id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    signer_user_id TEXT NOT NULL,
    signer_name_lo TEXT NOT NULL,
    signer_name_en TEXT NOT NULL,
    signer_title TEXT NOT NULL,
    signature_type TEXT NOT NULL CHECK(signature_type IN ('DRAWN', 'UPLOADED_STAMP', 'DIGITAL_SEAL')),
    signature_data TEXT NOT NULL,
    document_sha256 TEXT NOT NULL,
    verification_token TEXT NOT NULL UNIQUE,
    signed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    is_valid INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (signer_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. In-App Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title_lo TEXT NOT NULL,
    title_en TEXT NOT NULL,
    message_lo TEXT NOT NULL,
    message_en TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'INFO' CHECK(type IN ('INFO', 'APPROVAL_REQUEST', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED', 'REVISION_REQUESTED', 'DEADLINE_ALERT', 'SIGNATURE_COMPLETED')),
    entity_type TEXT DEFAULT 'DOCUMENT',
    entity_id TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. Add tags and archive metadata column to documents if not existing
-- (SQLite support for safe column addition)
-- Indexes
CREATE INDEX IF NOT EXISTS idx_doc_attachments_doc ON document_attachments(doc_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_doc ON document_versions(doc_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_doc ON document_workflow_steps(doc_id);
CREATE INDEX IF NOT EXISTS idx_signatures_doc ON document_signatures(doc_id);
CREATE INDEX IF NOT EXISTS idx_signatures_token ON document_signatures(verification_token);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
