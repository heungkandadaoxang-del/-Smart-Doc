import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { LoginView } from './components/auth/LoginView.js';
import { ForceChangePasswordModal } from './components/auth/ForceChangePasswordModal.js';
import { EnterpriseLayout } from './components/layout/EnterpriseLayout.js';
import { DashboardOverview } from './components/dashboard/DashboardOverview.js';
import { ExecutiveDashboardView } from './components/dashboard/ExecutiveDashboardView.js';
import { DepartmentDashboardView } from './components/dashboard/DepartmentDashboardView.js';
import { FilteredRecordsView } from './components/dashboard/FilteredRecordsView.js';
import { OrgStructureTree } from './components/organization/OrgStructureTree.js';
import { PositionsManagement } from './components/organization/PositionsManagement.js';
import { UserManagementView } from './components/users/UserManagementView.js';
import { DepartmentIsolationView } from './components/departments/DepartmentIsolationView.js';
import { OrganizationProfileView } from './components/organization/OrganizationProfileView.js';
import { AuditLogsView } from './components/audit/AuditLogsView.js';
import { AcceptanceTestsView } from './components/security/AcceptanceTestsView.js';
import { AccountSecurityView } from './components/security/AccountSecurityView.js';
import { AuthDiagnosticsView } from './components/security/AuthDiagnosticsView.js';
import { DocumentManagementView } from './components/documents/DocumentManagementView.js';
import { WorkflowApprovalView } from './components/workflow/WorkflowApprovalView.js';
import { SignatureQrView } from './components/signatures/SignatureQrView.js';
import { ReportsAnalyticsView } from './components/reports/ReportsAnalyticsView.js';
import { DisasterRecoveryBackupView } from './components/security/DisasterRecoveryBackupView.js';
import { Building2 } from 'lucide-react';

function AppContent() {
  const { user, isLoading, mustChangePassword, language } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('documents');
  const [drillDownCriteria, setDrillDownCriteria] = useState<any>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | undefined>(undefined);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white font-sans">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-2xl animate-pulse mb-4">
          <Building2 className="w-8 h-8" />
        </div>
        <h2 className="text-base font-bold tracking-tight">
          {language === 'lo' ? 'ລັດວິສາຫະກິດຖືຮຸ້ນລາວ (LHSE)' : 'Lao State Enterprise Holding'}
        </h2>
        <p className="text-xs text-blue-400 mt-1 font-mono">
          Smart E-Doc-LHSE-V01 • Initializing Secure Environment...
        </p>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const handleDrillDown = (criteria: any) => {
    setDrillDownCriteria(criteria);
    setCurrentTab('filtered-records');
  };

  const handleOpenWorkflow = (docId: string) => {
    setSelectedDocId(docId);
    setCurrentTab('workflows');
  };

  const handleOpenSignature = (docId: string) => {
    setSelectedDocId(docId);
    setCurrentTab('signatures');
  };

  return (
    <>
      {mustChangePassword && <ForceChangePasswordModal />}
      <EnterpriseLayout currentTab={currentTab} onSelectTab={setCurrentTab}>
        {/* Phase 3: Incoming & Outgoing Document Management */}
        {currentTab === 'documents' && (
          <DocumentManagementView
            onOpenWorkflow={handleOpenWorkflow}
            onOpenSignature={handleOpenSignature}
          />
        )}

        {/* Phase 4: Workflow & Approvals */}
        {currentTab === 'workflows' && (
          <WorkflowApprovalView
            initialDocId={selectedDocId}
            onNavigateToDocument={(id) => {
              setSelectedDocId(id);
              setCurrentTab('documents');
            }}
            onNavigateToSign={(id) => {
              setSelectedDocId(id);
              setCurrentTab('signatures');
            }}
          />
        )}

        {/* Phase 5: QR Verification & E-Signature */}
        {currentTab === 'signatures' && (
          <SignatureQrView
            initialDocId={selectedDocId}
            onNavigateBack={() => setCurrentTab('documents')}
          />
        )}

        {/* Phase 6: Reports & Analytics */}
        {currentTab === 'reports' && <ReportsAnalyticsView />}

        {/* Phase 1 & 2 Dashboards */}
        {currentTab === 'dashboard' && <DashboardOverview onNavigate={setCurrentTab} />}
        {currentTab === 'executive-dashboard' && <ExecutiveDashboardView onDrillDown={handleDrillDown} />}
        {currentTab === 'department-dashboard' && <DepartmentDashboardView onDrillDown={handleDrillDown} />}
        {currentTab === 'filtered-records' && (
          <FilteredRecordsView
            filterCriteria={drillDownCriteria || {}}
            onBack={() => setCurrentTab('executive-dashboard')}
          />
        )}

        {/* Organizational Structure & Personnel */}
        {currentTab === 'org-tree' && <OrgStructureTree />}
        {currentTab === 'positions' && <PositionsManagement />}
        {currentTab === 'users' && <UserManagementView />}
        {currentTab === 'departments' && <DepartmentIsolationView />}
        {currentTab === 'organization' && <OrganizationProfileView />}

        {/* Security, Disaster Recovery & Audit */}
        {currentTab === 'audit' && <AuditLogsView />}
        {currentTab === 'backup' && <DisasterRecoveryBackupView />}
        {currentTab === 'tests' && <AcceptanceTestsView />}
        {currentTab === 'security' && <AccountSecurityView />}
        {currentTab === 'auth-diagnostics' && <AuthDiagnosticsView />}
      </EnterpriseLayout>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
