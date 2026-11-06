import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import {
  GitBranch,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  User,
  Building,
  FileText,
  AlertTriangle,
  Send,
  MessageSquare,
  Check,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { alertService } from '../../services/swal.js';

interface WorkflowApprovalViewProps {
  initialDocId?: string;
  onNavigateToDocument?: (docId: string) => void;
  onNavigateToSign?: (docId: string) => void;
}

export const WorkflowApprovalView: React.FC<WorkflowApprovalViewProps> = ({
  initialDocId,
  onNavigateToDocument,
  onNavigateToSign,
}) => {
  const { user, fetchWithAuth, language } = useAuth();
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [trail, setTrail] = useState<any[]>([]);
  const [trailLoading, setTrailLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const loadPendingTasks = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/workflows/pending');
      const data = await res.json();
      if (data.success) {
        setPendingTasks(data.pendingTasks);
        if (initialDocId) {
          const match = data.pendingTasks.find((t: any) => t.id === initialDocId);
          if (match) {
            handleSelectTask(match);
          }
        } else if (data.pendingTasks.length > 0 && !selectedTask) {
          handleSelectTask(data.pendingTasks[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingTasks();
  }, [initialDocId]);

  const handleSelectTask = async (task: any) => {
    setSelectedTask(task);
    setTrailLoading(true);
    try {
      const res = await fetchWithAuth(`/api/workflows/${task.id}/trail`);
      const data = await res.json();
      if (data.success) {
        setTrail(data.trail);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTrailLoading(false);
    }
  };

  const handleWorkflowAction = async (action: 'APPROVE' | 'REJECT' | 'RETURN_FOR_REVISION') => {
    if (!selectedTask) return;

    if ((action === 'REJECT' || action === 'RETURN_FOR_REVISION') && !comment.trim()) {
      alertService.error(
        language === 'lo' ? 'ກະລຸນາໃສ່ເຫດຜົນ' : 'Comment Required',
        language === 'lo' ? 'ການປະຕິເສດ ຫຼື ສົ່ງກັບໄປແກ້ໄຂ ຕ້ອງມີເຫດຜົນປະກອບ' : 'Please provide justification reasons for this action'
      );
      return;
    }

    const actionTextLo = action === 'APPROVE' ? 'ອະນຸມັດ' : action === 'REJECT' ? 'ປະຕິເສດ' : 'ສົ່ງກັບໄປແກ້ໄຂ';
    const actionTextEn = action === 'APPROVE' ? 'Approve' : action === 'REJECT' ? 'Reject' : 'Return for Revision';

    const confirm = await alertService.confirm(
      language === 'lo' ? `ຢືນຢັນການ${actionTextLo}` : `Confirm ${actionTextEn}`,
      language === 'lo' ? `ທ່ານຕ້ອງການ ${actionTextLo} ເອກະສານ ${selectedTask.reg_number} ແທ້ບໍ?` : `Proceed with ${actionTextEn} on ${selectedTask.reg_number}?`,
      actionTextLo,
      language === 'lo' ? 'ຍົກເລີກ' : 'Cancel'
    );

    if (confirm.isConfirmed) {
      setSubmittingAction(true);
      try {
        const res = await fetchWithAuth(`/api/workflows/${selectedTask.id}/action`, {
          method: 'POST',
          body: JSON.stringify({ action, comments: comment }),
        });
        const data = await res.json();
        if (data.success) {
          alertService.success(
            language === 'lo' ? 'ດຳເນີນການສຳເລັດ' : 'Action Completed',
            data.message
          );
          setComment('');
          loadPendingTasks();
        } else {
          alertService.error('Action Failed', data.message);
        }
      } catch (e) {
        alertService.error('Error', 'Failed to perform workflow action');
      } finally {
        setSubmittingAction(false);
      }
    }
  };

  const getStepProgressIndex = (status: string) => {
    switch (status) {
      case 'DRAFT': return 0;
      case 'REGISTERED': return 1;
      case 'IN_REVIEW': return 2;
      case 'APPROVED': return 3;
      case 'COMPLETED':
      case 'SIGNED': return 4;
      default: return 1;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <GitBranch className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {language === 'lo'
                ? 'ສາຍງານອະນຸມັດ ແລະ ກວດສອບເອກະສານ (Workflow & Approvals)'
                : 'Document Workflow & Approvals Management'}
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            {language === 'lo'
              ? 'ກວດສອບ, ອະນຸມັດ, ສົ່ງກັບໄປແກ້ໄຂ, ແລະ ຕິດຕາມສາຍງານອະນຸມັດຂອງພະແນກພ້ອມປະຫວັດການລົງລາຍເຊັນ.'
              : 'Multi-stage approval pipeline, department review queues, revision requests, and audit logs.'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={loadPendingTasks}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Split: Pending Tasks Queue on Left, Interactive Approval Canvas on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Pending Queue */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900">
                {language === 'lo' ? 'ຄິວລໍຖ້າການດຳເນີນການ' : 'Pending Tasks Queue'}
              </h2>
            </div>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
              {pendingTasks.length}
            </span>
          </div>

          <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
            {loading ? (
              <p className="text-xs text-slate-400 py-6 text-center">Loading queue...</p>
            ) : pendingTasks.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                <p className="font-semibold text-slate-700">
                  {language === 'lo' ? 'ບໍ່ມີເອກະສານຄ້າງກວດສອບ' : 'All workflows up to date!'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {language === 'lo' ? 'ທຸກເອກະສານໄດ້ຮັບການອະນຸມັດຮຽບຮ້ອຍ' : 'No pending tasks in queue'}
                </p>
              </div>
            ) : (
              pendingTasks.map(task => {
                const isSelected = selectedTask?.id === task.id;
                return (
                  <div
                    key={task.id}
                    onClick={() => handleSelectTask(task)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer text-xs ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/40 shadow-xs'
                        : 'border-slate-100 bg-slate-50/70 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono font-bold text-blue-600">{task.reg_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        task.workflow_status === 'APPROVED'
                          ? 'bg-blue-100 text-blue-800'
                          : task.workflow_status === 'IN_REVIEW'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {task.workflow_status}
                      </span>
                    </div>

                    <div className="font-semibold text-slate-900 truncate mb-1" title={task.title}>
                      {task.title}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{task.dept_code}</span>
                      <span className="font-mono text-[10px]">{task.doc_date}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Workflow Stage Inspector & Decision Action */}
        <div className="lg:col-span-2 space-y-6">
          {selectedTask ? (
            <>
              {/* Stepper Visualizer */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-6">
                  <div>
                    <span className="font-mono text-xs font-bold text-blue-600 block mb-0.5">
                      {selectedTask.reg_number} • {selectedTask.dept_name_lo}
                    </span>
                    <h2 className="text-base font-bold text-slate-900">
                      {selectedTask.title}
                    </h2>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-100 text-amber-800">
                    {selectedTask.workflow_status}
                  </span>
                </div>

                {/* Stepper UI */}
                <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                  {[
                    { step: 1, nameLo: 'ລົງທະບຽນ', nameEn: 'Registered' },
                    { step: 2, nameLo: 'ກວດສອບພະແນກ', nameEn: 'Review' },
                    { step: 3, nameLo: 'ອະນຸມັດ', nameEn: 'Approved' },
                    { step: 4, nameLo: 'ລົງລາຍເຊັນ', nameEn: 'Signed / Done' },
                  ].map(s => {
                    const currentIdx = getStepProgressIndex(selectedTask.workflow_status);
                    const isDone = currentIdx >= s.step;
                    const isCurrent = currentIdx === s.step - 1;
                    return (
                      <div key={s.step} className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-1.5 transition ${
                          isDone
                            ? 'bg-emerald-600 text-white'
                            : isCurrent
                            ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          {isDone ? <Check className="w-4 h-4" /> : s.step}
                        </div>
                        <span className={`text-[11px] font-semibold ${isDone || isCurrent ? 'text-slate-800' : 'text-slate-400'}`}>
                          {language === 'lo' ? s.nameLo : s.nameEn}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Decision Form */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2 pb-2 border-b border-slate-100">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  <span>{language === 'lo' ? 'ການຕັດສິນໃຈ & ຄຳເຫັນ (Decision & Comments)' : 'Decision & Feedback'}</span>
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {language === 'lo' ? 'ຄຳເຫັນ / ເຫດຜົນປະກອບ (Comments):' : 'Comments / Justification Notes:'}
                  </label>
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder={language === 'lo' ? 'ປ້ອນຄຳເຫັນ ຫຼື ເຫດຜົນ (ຈຳເປັນເມື່ອປະຕິເສດ ຫຼື ສົ່ງກັບ)...' : 'Enter review comments or reasons...'}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={submittingAction}
                    onClick={() => handleWorkflowAction('APPROVE')}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-xs disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{language === 'lo' ? 'ອະນຸມັດເອກະສານ (Approve)' : 'Approve Document'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={submittingAction}
                    onClick={() => handleWorkflowAction('RETURN_FOR_REVISION')}
                    className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-xs disabled:opacity-60"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>{language === 'lo' ? 'ສົ່ງກັບໄປແກ້ໄຂ (Return)' : 'Return for Revision'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={submittingAction}
                    onClick={() => handleWorkflowAction('REJECT')}
                    className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-xs disabled:opacity-60"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>{language === 'lo' ? 'ປະຕິເສດ (Reject)' : 'Reject Document'}</span>
                  </button>

                  {onNavigateToSign && selectedTask.workflow_status === 'APPROVED' && (
                    <button
                      type="button"
                      onClick={() => onNavigateToSign(selectedTask.id)}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer ml-auto"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>{language === 'lo' ? 'ໄປໜ້າລົງລາຍເຊັນ E-Sign' : 'Proceed to E-Sign'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Approval History Trail */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
                <h3 className="font-bold text-sm text-slate-900 pb-3 border-b border-slate-100 mb-4 flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>{language === 'lo' ? 'ປະຫວັດສາຍງານອະນຸມັດ (Approval Audit Trail)' : 'Workflow Chain History'}</span>
                </h3>

                <div className="space-y-3">
                  {trailLoading ? (
                    <p className="text-xs text-slate-400 py-3 text-center">Loading trail...</p>
                  ) : trail.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">No trail records</p>
                  ) : (
                    trail.map(t => (
                      <div
                        key={t.id}
                        className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-start justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-bold text-slate-900">{t.step_name_lo}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.action === 'APPROVED' || t.action === 'SIGNED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : t.action === 'REJECTED'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {t.action}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {t.actor_name_lo || 'User'} ({t.position_title_lo || t.assignee_role})
                          </div>
                          {t.comments && (
                            <div className="text-[11px] text-slate-700 mt-1.5 p-2 rounded-lg bg-white border border-slate-200">
                              "{t.comments}"
                            </div>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap ml-4">
                          {t.acted_at || t.created_at}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl p-12 border border-slate-200/80 shadow-xs text-center text-slate-400 text-xs">
              <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-slate-700">
                {language === 'lo' ? 'ເລືອກເອກະສານຈາກຄິວດ້ານຊ້າຍ' : 'Select a document from queue'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
