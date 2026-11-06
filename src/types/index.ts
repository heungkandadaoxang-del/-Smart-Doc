/**
 * Smart E-Doc-LHSE-V01 Type Definitions
 * Organization: Lao State Enterprise Holding (LHSE)
 */

export type UserStatus = 'ACTIVE' | 'PENDING_ACTIVATION' | 'SUSPENDED' | 'LOCKED';

export type RoleCode = 
  | 'SUPER_ADMIN' 
  | 'DEPT_ADMIN' 
  | 'DEPT_STAFF' 
  | 'APPROVER' 
  | 'EXECUTIVE_VIEWER' 
  | string;

export interface Organization {
  id: string;
  name_lo: string;
  name_en: string;
  short_name: string;
  tax_id: string | null;
  address_lo: string;
  address_en: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  org_id: string;
  code: string;
  name_lo: string;
  name_en: string;
  description_lo: string | null;
  description_en: string | null;
  designated_admin_name: string;
  head_user_id: string | null;
  phone: string | null;
  email: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  // Computed / Joined fields
  admin_user_id?: string | null;
  admin_email?: string | null;
  admin_name_lo?: string | null;
  admin_status?: UserStatus | 'PENDING_INVITATION';
  active_invitation_id?: string | null;
  member_count?: number;
}

export interface Position {
  id: string;
  dept_id: string | null;
  code: string;
  title_lo: string;
  title_en: string;
  description_lo?: string | null;
  description_en?: string | null;
  level: number;
  max_headcount: number;
  reports_to_position_id?: string | null;
  is_active: number;
  // Computed / Joined
  dept_name_lo?: string | null;
  dept_name_en?: string | null;
  dept_code?: string | null;
  assigned_user_count?: number;
  reports_to_title_lo?: string | null;
}

export interface DocumentRecord {
  id: string;
  org_id: string;
  dept_id: string;
  reg_number: string;
  internal_ref?: string | null;
  doc_type: 'INCOMING' | 'OUTGOING' | 'INTERNAL';
  title: string;
  summary?: string | null;
  sender?: string | null;
  recipient?: string | null;
  doc_date: string;
  received_date?: string | null;
  priority: 'LOW' | 'NORMAL' | 'URGENT' | 'VERY_URGENT';
  confidentiality: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'HIGHLY_CONFIDENTIAL';
  workflow_status: 'DRAFT' | 'REGISTERED' | 'ASSIGNED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'SIGNED' | 'ARCHIVED' | 'COMPLETED';
  current_step: number;
  creator_id: string;
  responsible_user_id?: string | null;
  created_at: string;
  dept_name_lo?: string;
  dept_name_en?: string;
  dept_code?: string;
}

export interface Role {
  id: string;
  code: RoleCode;
  name_lo: string;
  name_en: string;
  description_lo: string | null;
  description_en: string | null;
  is_system: number;
  permissions?: string[];
}

export interface Permission {
  id: string;
  code: string;
  category: string;
  name_lo: string;
  name_en: string;
  description: string | null;
}

export interface User {
  id: string;
  org_id: string;
  dept_id: string | null;
  position_id: string | null;
  email: string;
  full_name_lo: string;
  full_name_en: string;
  phone: string | null;
  avatar_url: string | null;
  status: UserStatus;
  must_change_password: boolean;
  mfa_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  // Role & Department Joined Info
  roles: RoleCode[];
  permissions: string[];
  dept_name_lo?: string | null;
  dept_name_en?: string | null;
  dept_code?: string | null;
  position_title_lo?: string | null;
  position_title_en?: string | null;
}

export interface UserInvitation {
  id: string;
  org_id: string;
  dept_id: string;
  role_id: string;
  designated_name: string;
  email: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  dept_name_lo?: string;
  dept_name_en?: string;
  role_code?: string;
}

export interface LoginHistory {
  id: string;
  user_id: string | null;
  email: string;
  ip_address: string | null;
  user_agent: string | null;
  status: 'SUCCESS' | 'FAILED_PASSWORD' | 'FAILED_MFA' | 'ACCOUNT_LOCKED' | 'LOGOUT';
  failure_reason: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  org_id: string;
  dept_id: string | null;
  actor_user_id: string | null;
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: string | null;
  new_values: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: 'SUCCESS' | 'DENIED' | 'ERROR';
  details: string | null;
  created_at: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
  token?: string;
  mfaRequired?: boolean;
  mustChangePassword?: boolean;
}

export interface MFASetupResponse {
  secret: string;
  qrCodeUrl: string;
  manualCode: string;
}
