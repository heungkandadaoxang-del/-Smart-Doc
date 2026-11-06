-- ====================================================================
-- Smart E-Doc-LHSE-V01 Database Schema (Cloudflare D1 / SQLite)
-- Migration: 0004_ocr_indexing.sql
-- Focus: OCR Text Extraction & Full-Text Search Indexing
-- ====================================================================

-- 1. Document OCR Extracted Content Store
CREATE TABLE IF NOT EXISTS document_ocr_indexes (
    id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    attachment_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    extracted_text TEXT NOT NULL,
    extracted_language TEXT NOT NULL DEFAULT 'lo,en',
    confidence_score REAL NOT NULL DEFAULT 0.95,
    ocr_engine TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
    processing_duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (attachment_id) REFERENCES document_attachments(id) ON DELETE CASCADE
);

-- 2. Indexes for fast full-text keyword searches
CREATE INDEX IF NOT EXISTS idx_ocr_indexes_doc_id ON document_ocr_indexes(doc_id);
CREATE INDEX IF NOT EXISTS idx_ocr_indexes_attachment_id ON document_ocr_indexes(attachment_id);
CREATE INDEX IF NOT EXISTS idx_ocr_indexes_created ON document_ocr_indexes(created_at);
