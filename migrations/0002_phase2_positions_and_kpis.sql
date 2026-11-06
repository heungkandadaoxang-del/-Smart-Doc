-- ====================================================================
-- Smart E-Doc-LHSE-V01 Database Schema (Cloudflare D1 / SQLite)
-- Migration: 0002_phase2_positions_and_kpis.sql
-- Focus: Organizational Positions & Hierarchy, Aggregation Indexes
-- ====================================================================

-- 1. Create enhanced positions table if not exists or ensure columns
CREATE TABLE IF NOT EXISTS positions_v2 (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL DEFAULT 'org-lhse-main',
    dept_id TEXT,
    code TEXT NOT NULL UNIQUE,
    title_lo TEXT NOT NULL,
    title_en TEXT NOT NULL,
    description_lo TEXT,
    description_en TEXT,
    level INTEGER NOT NULL DEFAULT 1,
    max_headcount INTEGER NOT NULL DEFAULT 1,
    reports_to_position_id TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (dept_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (reports_to_position_id) REFERENCES positions_v2(id) ON DELETE SET NULL
);

-- Copy existing positions if any
INSERT OR IGNORE INTO positions_v2 (id, dept_id, code, title_lo, title_en, level)
SELECT id, dept_id, id, title_lo, title_en, level FROM positions;

-- 2. Indexes for fast dashboard aggregations
CREATE INDEX IF NOT EXISTS idx_positions_v2_dept ON positions_v2(dept_id);
CREATE INDEX IF NOT EXISTS idx_positions_v2_level ON positions_v2(level);
CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(doc_date);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_confidentiality ON documents(confidentiality);
CREATE INDEX IF NOT EXISTS idx_documents_priority ON documents(priority);
CREATE INDEX IF NOT EXISTS idx_documents_workflow_status ON documents(workflow_status);
