-- ====================================================================
-- Smart E-Doc-LHSE-V01 Database Schema (Cloudflare D1 / SQLite)
-- Organization: Lao State Enterprise Holding (ລັດວິສາຫະກິດຖືຮຸ້ນລາວ)
-- Migration: 0001_initial_schema.sql
-- ====================================================================

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name_lo TEXT NOT NULL,
    name_en TEXT NOT NULL,
    short_name TEXT NOT NULL DEFAULT 'LHSE',
    tax_id TEXT,
    address_lo TEXT NOT NULL,
    address_en TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    logo_url TEXT,
    timezone TEXT NOT NULL DEFAULT 'Asia/Vientiane',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Departments
CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    name_lo TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_lo TEXT,
    description_en TEXT,
    designated_admin_name TEXT,
    head_user_id TEXT,
    phone TEXT,
    email TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- 3. Positions
CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    dept_id TEXT,
    title_lo TEXT NOT NULL,
    title_en TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE SET NULL
);

-- 4. Roles
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name_lo TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_lo TEXT,
    description_en TEXT,
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Permissions
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    name_lo TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description TEXT
);

-- 6. Role Permissions (Mapping)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- 7. Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    dept_id TEXT,
    position_id TEXT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name_lo TEXT NOT NULL,
    full_name_en TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'PENDING_ACTIVATION', 'SUSPENDED', 'LOCKED')),
    must_change_password INTEGER NOT NULL DEFAULT 0,
    mfa_enabled INTEGER NOT NULL DEFAULT 0,
    mfa_secret TEXT,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until DATETIME,
    last_login_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL
);

-- 8. User Roles
CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    assigned_by TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- 9. User Invitations (for Department Admins & Staff activation)
CREATE TABLE IF NOT EXISTS user_invitations (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    dept_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    designated_name TEXT NOT NULL,
    email TEXT,
    token_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
    invited_by TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    accepted_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- 10. Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    mfa_verified INTEGER NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 11. Login History
CREATE TABLE IF NOT EXISTS login_history (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    email TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    status TEXT NOT NULL CHECK(status IN ('SUCCESS', 'FAILED_PASSWORD', 'FAILED_MFA', 'ACCOUNT_LOCKED', 'LOGOUT')),
    failure_reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. Audit Logs (Immutable security ledger)
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    dept_id TEXT,
    actor_user_id TEXT,
    actor_email TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    user_agent TEXT,
    status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK(status IN ('SUCCESS', 'DENIED', 'ERROR')),
    details TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. System Settings
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    is_public INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. Document Categories (Phase 1 schema prep for Phase 2/3)
CREATE TABLE IF NOT EXISTS document_categories (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    name_lo TEXT NOT NULL,
    name_en TEXT NOT NULL,
    prefix TEXT NOT NULL,
    current_number INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 15. Documents (Core schema supporting department isolation)
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    dept_id TEXT NOT NULL,
    reg_number TEXT NOT NULL UNIQUE,
    internal_ref TEXT,
    doc_type TEXT NOT NULL CHECK(doc_type IN ('INCOMING', 'OUTGOING', 'INTERNAL')),
    title TEXT NOT NULL,
    summary TEXT,
    sender TEXT,
    recipient TEXT,
    doc_date DATE NOT NULL,
    received_date DATE,
    priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK(priority IN ('LOW', 'NORMAL', 'URGENT', 'VERY_URGENT')),
    confidentiality TEXT NOT NULL DEFAULT 'INTERNAL' CHECK(confidentiality IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'HIGHLY_CONFIDENTIAL')),
    workflow_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(workflow_status IN ('DRAFT', 'REGISTERED', 'ASSIGNED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SIGNED', 'ARCHIVED', 'COMPLETED')),
    current_step INTEGER NOT NULL DEFAULT 1,
    creator_id TEXT NOT NULL,
    responsible_user_id TEXT,
    qr_token TEXT UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE CASCADE,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for high performance and strict isolation queries
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_dept ON users(dept_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_dept ON audit_logs(dept_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_dept ON documents(dept_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(workflow_status);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);
