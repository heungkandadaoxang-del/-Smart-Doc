import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import {
  FileText,
  FileInput,
  FileOutput,
  Layers,
  Plus,
  Search,
  Filter,
  Eye,
  Download,
  Calendar,
  Building,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Archive,
  ArrowRight,
  RefreshCw,
  X,
  FileCheck,
  QrCode,
  PenTool,
  History,
  Sparkles,
  ScanText,
  Copy,
  Check,
} from 'lucide-react';
import { alertService } from '../../services/swal.js';

interface DocumentManagementProps {
  initialType?: 'ALL' | 'INCOMING' | 'OUTGOING' | 'INTERNAL' | 'ARCHIVED';
  onOpenWorkflow?: (docId: string) => void;
  onOpenSignature?: (docId: string) => void;
}

export const DocumentManagementView: React.FC<DocumentManagementProps> = ({
  initialType = 'ALL',
  onOpenWorkflow,
  onOpenSignature,
}) => {
  const { user, fetchWithAuth, language, t } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(initialType);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Registration modal state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regType, setRegType] = useState<'INCOMING' | 'OUTGOING' | 'INTERNAL'>('INCOMING');
  const [regTitle, setRegTitle] = useState('');
  const [regSummary, setRegSummary] = useState('');
  const [regSender, setRegSender] = useState('');
  const [regRecipient, setRegRecipient] = useState('');
  const [regDocDate, setRegDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [regPriority, setRegPriority] = useState('NORMAL');
  const [regConfidentiality, setRegConfidentiality] = useState('INTERNAL');
  const [submitting, setSubmitting] = useState(false);

  // Initial file & OCR state for Registration Modal
  const [initialFile, setInitialFile] = useState<{ name: string; type: string; size: number; base64: string } | null>(null);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrResultPreview, setOcrResultPreview] = useState<any>(null);

  // Detail Drawer state
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // File upload state inside details
  const [uploadingFile, setUploadingFile] = useState(false);

  // OCR Text Viewer Modal state
  const [selectedOcrAttachment, setSelectedOcrAttachment] = useState<any>(null);
  const [copiedText, setCopiedText] = useState(false);

  const isSuperAdmin = user?.roles.includes('SUPER_ADMIN');

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab === 'ARCHIVED') {
        params.set('workflow_status', 'ARCHIVED');
      } else if (activeTab !== 'ALL') {
        params.set('doc_type', activeTab);
      }
      if (statusFilter !== 'ALL' && activeTab !== 'ARCHIVED') {
        params.set('workflow_status', statusFilter);
      }
      if (priorityFilter !== 'ALL') {
        params.set('priority', priorityFilter);
      }
      if (search.trim()) {
        params.set('search', search.trim());
      }

      const res = await fetchWithAuth(`/api/documents?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [activeTab, statusFilter, priorityFilter]);

  const loadDocumentDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetchWithAuth(`/api/documents/${id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedDoc(data);
      }
    } catch (e) {
      alertService.error('Error', 'Failed to load document details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleInitialFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setInitialFile({
        name: file.name,
        type: file.type || 'application/pdf',
        size: file.size,
        base64: reader.result as string,
      });
      setOcrResultPreview(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRunOcrPreview = async () => {
    if (!initialFile) return;
    setOcrScanning(true);
    try {
      const res = await fetchWithAuth('/api/documents/ocr/preview-extract', {
        method: 'POST',
        body: JSON.stringify({
          fileName: initialFile.name,
          fileType: initialFile.type,
          contentBase64: initialFile.base64,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOcrResultPreview(data);
        // Auto-fill form fields if currently empty
        if (data.suggestedMetadata) {
          if (!regTitle && data.suggestedMetadata.title) setRegTitle(data.suggestedMetadata.title);
          if (!regSender && data.suggestedMetadata.sender) setRegSender(data.suggestedMetadata.sender);
          if (!regRecipient && data.suggestedMetadata.recipient) setRegRecipient(data.suggestedMetadata.recipient);
          if (data.suggestedMetadata.docDate) setRegDocDate(data.suggestedMetadata.docDate);
          if (!regSummary && data.suggestedMetadata.summary) setRegSummary(data.suggestedMetadata.summary);
        }
        alertService.toast(
          'success',
          language === 'lo'
            ? `ສະແກນ OCR ສຳເລັດ (${data.wordCount} ຄຳ) ແລະ ຕື່ມຂໍ້ມູນອັດຕະໂນມັດ`
            : `OCR extracted ${data.wordCount} words; auto-populated fields`
        );
      } else {
        alertService.error('OCR Error', data.message || 'Failed to extract text');
      }
    } catch (err: any) {
      alertService.error('OCR Error', err.message);
    } finally {
      setOcrScanning(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regTitle || !regDocDate) {
      alertService.error(
        language === 'lo' ? 'ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບ' : 'Missing Information',
        language === 'lo' ? 'ກະລຸນາປ້ອນຫົວຂໍ້ ແລະ ວັນທີເອກະສານ' : 'Title and document date are required'
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth('/api/documents', {
        method: 'POST',
        body: JSON.stringify({
          doc_type: regType,
          title: regTitle,
          summary: regSummary,
          sender: regSender || (regType === 'OUTGOING' ? 'ລັດວິສາຫະກິດຖືຮຸ້ນລາວ (LHSE)' : ''),
          recipient: regRecipient || (regType === 'INCOMING' ? 'ລັດວິສາຫະກິດຖືຮຸ້ນລາວ (LHSE)' : ''),
          doc_date: regDocDate,
          priority: regPriority,
          confidentiality: regConfidentiality,
          initialAttachment: initialFile ? {
            fileName: initialFile.name,
            fileType: initialFile.type,
            fileSize: initialFile.size,
            contentBase64: initialFile.base64,
          } : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const ocrInfo = data.ocr?.wordCount ? ` (OCR: ${data.ocr.wordCount} words indexed)` : '';
        alertService.success(
          language === 'lo' ? 'ລົງທະບຽນສຳເລັດ' : 'Document Registered',
          `${language === 'lo' ? 'ເລກທີທະບຽນອັດຕະໂນມັດ:' : 'Assigned Registration No:'} ${data.regNumber}${ocrInfo}`
        );
        setShowRegisterModal(false);
        // Reset form
        setRegTitle('');
        setRegSummary('');
        setRegSender('');
        setRegRecipient('');
        setInitialFile(null);
        setOcrResultPreview(null);
        loadDocuments();
      } else {
        alertService.error('Registration Failed', data.message);
      }
    } catch (e) {
      alertService.error('Error', 'Registration request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveDoc = async (docId: string, regNumber: string) => {
    const confirm = await alertService.confirm(
      language === 'lo' ? 'ຍ້າຍເຂົ້າຄັງເກັບມ້ຽນ' : 'Archive Document',
      language === 'lo' ? `ທ່ານຕ້ອງການຍ້າຍເອກະສານ ${regNumber} ເຂົ້າສູ່ຄັງເກັບມ້ຽນເອເລັກໂຕຣນິກແທ້ບໍ?` : `Archive document ${regNumber}?`,
      language === 'lo' ? 'ຍ້າຍເຂົ້າຄັງ' : 'Archive Now',
      language === 'lo' ? 'ຍົກເລີກ' : 'Cancel'
    );

    if (confirm.isConfirmed) {
      try {
        const res = await fetchWithAuth(`/api/documents/${docId}/archive`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          alertService.toast('success', data.message);
          loadDocuments();
          if (selectedDoc?.document?.id === docId) {
            setSelectedDoc(null);
          }
        }
      } catch (e) {
        alertService.error('Error', 'Failed to archive');
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDoc) return;

    setUploadingFile(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const res = await fetchWithAuth(`/api/documents/${selectedDoc.document.id}/attachments`, {
          method: 'POST',
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || 'application/pdf',
            fileSize: file.size,
            contentBase64: base64,
          }),
        });
        const data = await res.json();
        if (data.success) {
          const ocrMsg = data.ocr?.wordCount
            ? ` (${data.ocr.wordCount} words indexed)`
            : '';
          alertService.toast(
            'success',
            language === 'lo'
              ? `ອັບໂຫຼດໄຟລ໌ແນບ ແລະ ສະແກນ OCR ສຳເລັດ${ocrMsg}`
              : `Attachment uploaded & OCR indexed${ocrMsg}`
          );
          loadDocumentDetail(selectedDoc.document.id);
        }
      } catch (err) {
        alertService.error('Error', 'Failed to upload attachment');
      } finally {
        setUploadingFile(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleViewOcr = (att: any) => {
    setSelectedOcrAttachment(att);
    setCopiedText(false);
  };

  const handleCopyOcrText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
    alertService.toast('success', language === 'lo' ? 'ຄັດລອກເນື້ອໃນ OCR ແລ້ວ' : 'OCR text copied to clipboard');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <FileText className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {language === 'lo'
                ? 'ບໍລິຫານເອກະສານ ຂາເຂົ້າ - ຂາອອກ - ພາຍໃນ (Document Management)'
                : 'Document Management Lifecycle'}
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            {language === 'lo'
              ? 'ລະບົບລົງທະບຽນເລກທີອັດຕະໂນມັດ, ຈັດການໄຟລ໌ແນບ, ປະຫວັດເວີຊັນ, ແລະ ການແຍກສິດທິພະແນກ 100% ຕາມກົດລະບຽບ LHSE.'
              : 'Sequential numbering, metadata control, department isolation, version history, and attachments.'}
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-2 shadow-sm shadow-blue-600/30 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'lo' ? 'ລົງທະບຽນເອກະສານໃໝ່' : 'Register Document'}</span>
          </button>

          <button
            type="button"
            onClick={loadDocuments}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Navigation Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          {[
            { id: 'ALL', labelLo: 'ທັງໝົດ', labelEn: 'All Documents', icon: FileText },
            { id: 'INCOMING', labelLo: 'ຂາເຂົ້າ', labelEn: 'Incoming', icon: FileInput },
            { id: 'OUTGOING', labelLo: 'ຂາອອກ', labelEn: 'Outgoing', icon: FileOutput },
            { id: 'INTERNAL', labelLo: 'ພາຍໃນ', labelEn: 'Internal', icon: Layers },
            { id: 'ARCHIVED', labelLo: 'ຄັງເກັບມ້ຽນ', labelEn: 'Archive', icon: Archive },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                <span>{language === 'lo' ? tab.labelLo : tab.labelEn}</span>
              </button>
            );
          })}
        </div>

        {/* Search & Filter inputs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder={language === 'lo' ? 'ຄົ້ນຫາເລກທີ, ຫົວຂໍ້, ຫຼື ເນື້ອໃນ OCR...' : 'Search reg no, title, or OCR text...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadDocuments()}
              className="pl-8 pr-16 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 w-52 sm:w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5" />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setTimeout(loadDocuments, 50);
                }}
                className="absolute right-9 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={loadDocuments}
              className="absolute right-1 px-2 py-0.5 text-[10px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition cursor-pointer"
            >
              Go
            </button>
          </div>

          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-700 cursor-pointer"
          >
            <option value="ALL">{language === 'lo' ? 'ທຸກຄວາມຮີບດ່ວນ' : 'All Priority'}</option>
            <option value="NORMAL">{language === 'lo' ? 'ປົກກະຕິ (Normal)' : 'Normal'}</option>
            <option value="URGENT">{language === 'lo' ? 'ດ່ວນ (Urgent)' : 'Urgent'}</option>
            <option value="VERY_URGENT">{language === 'lo' ? 'ດ່ວນທີ່ສຸດ (Very Urgent)' : 'Very Urgent'}</option>
          </select>
        </div>
      </div>

      {/* Document List Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <th className="py-3 px-4">ເລກທີທະບຽນ (Reg No)</th>
                <th className="py-3 px-4">ປະເພດ (Type)</th>
                <th className="py-3 px-4">ຫົວຂໍ້ເອກະສານ (Title)</th>
                <th className="py-3 px-4">ພະແນກ (Department)</th>
                <th className="py-3 px-4">ຜູ້ສົ່ງ / ຜູ້ຮັບ</th>
                <th className="py-3 px-4">ສະຖານະ (Status)</th>
                <th className="py-3 px-4">ວັນທີ (Date)</th>
                <th className="py-3 px-4 text-right">ຈັດການ (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>{language === 'lo' ? 'ກຳລັງໂຫຼດເອກະສານ...' : 'Loading documents...'}</span>
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold">{language === 'lo' ? 'ບໍ່ພົບເອກະສານ' : 'No documents found'}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {language === 'lo' ? 'ກົດປຸ່ມ "ລົງທະບຽນເອກະສານໃໝ່" ເພື່ອເລີ່ມຕົ້ນ' : 'Click "Register Document" to create one'}
                    </p>
                  </td>
                </tr>
              ) : (
                documents.map(doc => {
                  const isIncoming = doc.doc_type === 'INCOMING';
                  const isOutgoing = doc.doc_type === 'OUTGOING';
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                        {doc.reg_number}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          isIncoming
                            ? 'bg-sky-100 text-sky-800'
                            : isOutgoing
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {doc.doc_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-slate-900 truncate" title={doc.title}>
                            {doc.title}
                          </span>
                          {doc.ocr_indexed_count > 0 && (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0"
                              title={`${doc.ocr_indexed_count} attachments indexed via Gemini OCR`}
                            >
                              <Sparkles className="w-2.5 h-2.5 mr-0.5 text-indigo-600" />
                              OCR ({doc.ocr_indexed_count})
                            </span>
                          )}
                        </div>
                        {doc.summary && (
                          <div className="text-[11px] text-slate-400 truncate">{doc.summary}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {doc.dept_code}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 text-[11px]">
                        <div>{doc.sender || '-'}</div>
                        <div className="text-[10px] text-slate-400">ຫາ: {doc.recipient || '-'}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          doc.workflow_status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : doc.workflow_status === 'APPROVED'
                            ? 'bg-blue-100 text-blue-800'
                            : doc.workflow_status === 'IN_REVIEW'
                            ? 'bg-amber-100 text-amber-800'
                            : doc.workflow_status === 'ARCHIVED'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {doc.workflow_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {doc.doc_date}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                        <button
                          type="button"
                          onClick={() => loadDocumentDetail(doc.id)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-semibold transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 inline mr-1" />
                          <span>{language === 'lo' ? 'ລາຍລະອຽດ' : 'Details'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register New Document Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Plus className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {language === 'lo' ? 'ລົງທະບຽນເອກະສານໃໝ່' : 'Register New Document'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {language === 'lo' ? 'ລະບົບຈະສ້າງເລກທີທະບຽນອັດຕະໂນມັດຕາມພະແນກ ແລະ ປີ' : 'Sequential numbering will be assigned automatically'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'lo' ? 'ປະເພດເອກະສານ:' : 'Document Type:'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'INCOMING', labelLo: 'ຂາເຂົ້າ (In)', labelEn: 'Incoming' },
                    { id: 'OUTGOING', labelLo: 'ຂາອອກ (Out)', labelEn: 'Outgoing' },
                    { id: 'INTERNAL', labelLo: 'ພາຍໃນ (Int)', labelEn: 'Internal' },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setRegType(t.id as any)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                        regType === t.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {language === 'lo' ? t.labelLo : t.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Intelligent Document Upload & OCR Auto-Extraction */}
              <div className="p-3.5 rounded-xl border border-indigo-100 bg-linear-to-br from-indigo-50/60 via-white to-blue-50/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900">
                      {language === 'lo' ? 'ອັບໂຫຼດໄຟລ໌ ແລະ ສະແກນ OCR (AI Gemini Auto-Extract)' : 'Upload & Auto-Extract OCR (AI Gemini)'}
                    </span>
                  </div>
                  <span className="text-[10px] text-indigo-700 font-medium bg-indigo-100/70 px-2 py-0.5 rounded-full font-mono">
                    PDF / Images
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <label className="flex-1 flex items-center justify-center sm:justify-start px-3 py-2 bg-white border border-dashed border-indigo-300 rounded-xl cursor-pointer hover:bg-indigo-50/40 transition text-xs text-slate-600 shadow-2xs">
                    <Upload className="w-3.5 h-3.5 mr-2 text-indigo-500 shrink-0" />
                    <span className="truncate max-w-[210px] font-medium">
                      {initialFile ? initialFile.name : (language === 'lo' ? 'ເລືອກໄຟລ໌ PDF ຫຼື ຮູບພາບ...' : 'Choose PDF or Image to scan...')}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={handleInitialFileSelect}
                      className="hidden"
                    />
                  </label>

                  {initialFile && (
                    <button
                      type="button"
                      onClick={handleRunOcrPreview}
                      disabled={ocrScanning}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 shrink-0 shadow-xs"
                    >
                      {ocrScanning ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>{language === 'lo' ? 'ກຳລັງສະແກນ...' : 'Extracting...'}</span>
                        </>
                      ) : (
                        <>
                          <ScanText className="w-3.5 h-3.5" />
                          <span>{language === 'lo' ? 'ສະແກນ OCR ດ່ວນ' : 'Scan OCR Now'}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {ocrResultPreview && (
                  <div className="mt-2.5 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 truncate">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate font-medium">
                        {language === 'lo'
                          ? `ດຶງຂໍ້ຄວາມສຳເລັດ (${ocrResultPreview.wordCount} ຄຳ, ພາສາ ${ocrResultPreview.languageDetected}) - ຕື່ມຫົວຂໍ້ & ຂໍ້ມູນອັດຕະໂນມັດແລ້ວ`
                          : `Extracted ${ocrResultPreview.wordCount} words (${ocrResultPreview.languageDetected}) - Form auto-populated`}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'lo' ? 'ຫົວຂໍ້ເອກະສານ (Title) *:' : 'Document Title *:'}
                </label>
                <input
                  type="text"
                  required
                  value={regTitle}
                  onChange={e => setRegTitle(e.target.value)}
                  placeholder={language === 'lo' ? 'ເຊັ່ນ: ບົດລາຍງານການເງິນປະຈຳເດືອນ...' : 'e.g. Monthly financial report...'}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'lo' ? 'ຜູ້ສົ່ງ (Sender):' : 'Sender:'}
                  </label>
                  <input
                    type="text"
                    value={regSender}
                    onChange={e => setRegSender(e.target.value)}
                    placeholder="ກະຊວງການເງິນ, ບໍລິສັດຄູ່ຮ່ວມ..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'lo' ? 'ຜູ້ຮັບ (Recipient):' : 'Recipient:'}
                  </label>
                  <input
                    type="text"
                    value={regRecipient}
                    onChange={e => setRegRecipient(e.target.value)}
                    placeholder="ຄະນະອຳນວຍການ, ຫົວໜ້າພະແນກ..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'lo' ? 'ວັນທີເອກະສານ *:' : 'Document Date *:'}
                  </label>
                  <input
                    type="date"
                    required
                    value={regDocDate}
                    onChange={e => setRegDocDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'lo' ? 'ຄວາມຮີບດ່ວນ:' : 'Priority:'}
                  </label>
                  <select
                    value={regPriority}
                    onChange={e => setRegPriority(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-800 cursor-pointer"
                  >
                    <option value="LOW">ປົກກະຕິ (Low)</option>
                    <option value="NORMAL">ປົກກະຕິ (Normal)</option>
                    <option value="URGENT">ດ່ວນ (Urgent)</option>
                    <option value="VERY_URGENT">ດ່ວນທີ່ສຸດ (Very Urgent)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'lo' ? 'ຊັ້ນຄວາມລັບ:' : 'Confidentiality:'}
                  </label>
                  <select
                    value={regConfidentiality}
                    onChange={e => setRegConfidentiality(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-800 cursor-pointer"
                  >
                    <option value="PUBLIC">ເປີດເຜີຍ (Public)</option>
                    <option value="INTERNAL">ພາຍໃນ (Internal)</option>
                    <option value="CONFIDENTIAL">ລັບ (Confidential)</option>
                    <option value="HIGHLY_CONFIDENTIAL">ລັບທີ່ສຸດ (Top Secret)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'lo' ? 'ເນື້ອໃນຫຍໍ້ / ລາຍລະອຽດ (Summary):' : 'Summary & Notes:'}
                </label>
                <textarea
                  rows={3}
                  value={regSummary}
                  onChange={e => setRegSummary(e.target.value)}
                  placeholder={language === 'lo' ? 'ອະທິບາຍຫຍໍ້ກ່ຽວກັບເນື້ອໃນເອກະສານ...' : 'Brief summary of the document...'}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  {language === 'lo' ? 'ຍົກເລີກ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {submitting
                    ? (language === 'lo' ? 'ກຳລັງບັນທຶກ...' : 'Registering...')
                    : (language === 'lo' ? 'ລົງທະບຽນເອກະສານ' : 'Complete Registration')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Detail Drawer / Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-200 mb-5">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                    {selectedDoc.document.reg_number}
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {selectedDoc.document.doc_type}
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {selectedDoc.document.workflow_status}
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900 mt-2">
                  {selectedDoc.document.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center gap-2 mb-6 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              {onOpenWorkflow && selectedDoc.document.workflow_status !== 'COMPLETED' && selectedDoc.document.workflow_status !== 'ARCHIVED' && (
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedDoc.document.id;
                    setSelectedDoc(null);
                    onOpenWorkflow(id);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>{language === 'lo' ? 'ຈັດການສາຍງານອະນຸມັດ (Workflow)' : 'Workflow & Approval'}</span>
                </button>
              )}

              {onOpenSignature && selectedDoc.document.workflow_status !== 'ARCHIVED' && (
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedDoc.document.id;
                    setSelectedDoc(null);
                    onOpenSignature(id);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>{language === 'lo' ? 'ລົງລາຍເຊັນ E-Sign & QR' : 'Sign & QR Code'}</span>
                </button>
              )}

              {selectedDoc.document.workflow_status !== 'ARCHIVED' && (
                <button
                  type="button"
                  onClick={() => handleArchiveDoc(selectedDoc.document.id, selectedDoc.document.reg_number)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer ml-auto"
                >
                  <Archive className="w-3.5 h-3.5 text-amber-400" />
                  <span>{language === 'lo' ? 'ຍ້າຍເຂົ້າຄັງເກັບມ້ຽນ' : 'Archive'}</span>
                </button>
              )}
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-6 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-400 block mb-0.5">{language === 'lo' ? 'ພະແນກຮັບຜິດຊອບ:' : 'Department:'}</span>
                <span className="font-semibold text-slate-800">{selectedDoc.document.dept_name_lo}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">{language === 'lo' ? 'ວັນທີເອກະສານ:' : 'Document Date:'}</span>
                <span className="font-mono font-semibold text-slate-800">{selectedDoc.document.doc_date}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">{language === 'lo' ? 'ລະດັບຄວາມຮີບດ່ວນ:' : 'Priority:'}</span>
                <span className="font-semibold text-amber-700">{selectedDoc.document.priority}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">{language === 'lo' ? 'ຊັ້ນຄວາມລັບ:' : 'Confidentiality:'}</span>
                <span className="font-semibold text-blue-700">{selectedDoc.document.confidentiality}</span>
              </div>
            </div>

            {/* Attachments Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                <h3 className="font-bold text-xs text-slate-900 flex items-center space-x-2">
                  <Upload className="w-4 h-4 text-blue-600" />
                  <span>{language === 'lo' ? 'ໄຟລ໌ແນບເອກະສານ (Attachments)' : 'Attachments'}</span>
                  <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                    {selectedDoc.attachments?.length || 0}
                  </span>
                </h3>

                <label className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center space-x-1">
                  <Plus className="w-3.5 h-3.5" />
                  <span>{uploadingFile ? 'Uploading...' : (language === 'lo' ? 'ເພີ່ມໄຟລ໌' : 'Upload File')}</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                  />
                </label>
              </div>

              <div className="space-y-2">
                {selectedDoc.attachments?.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">
                    {language === 'lo' ? 'ຍັງບໍ່ມີໄຟລ໌ແນບ' : 'No attachments uploaded'}
                  </p>
                ) : (
                  selectedDoc.attachments?.map((att: any) => {
                    const hasOcr = Boolean(att.ocr_text || att.ocr_status === 'COMPLETED');
                    return (
                      <div
                        key={att.id}
                        className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs gap-2"
                      >
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                          <div className="truncate">
                            <div className="font-semibold text-slate-900 truncate">{att.file_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-2">
                              <span>SHA-256: {att.content_sha256?.substring(0, 14)}...</span>
                              <span>•</span>
                              <span>{(att.file_size / 1024).toFixed(1)} KB</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          {hasOcr ? (
                            <button
                              type="button"
                              onClick={() => handleViewOcr(att)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition flex items-center space-x-1 cursor-pointer border border-indigo-200"
                              title="View OCR text extracted from this document"
                            >
                              <ScanText className="w-3 h-3 text-indigo-600" />
                              <span>{language === 'lo' ? 'ເບິ່ງ OCR' : 'View OCR'}</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium px-2 py-0.5 rounded bg-slate-200/60">
                              {att.ocr_status || 'NO OCR'}
                            </span>
                          )}

                          <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                            Verified
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Version History Section */}
            <div>
              <h3 className="font-bold text-xs text-slate-900 flex items-center space-x-2 pb-2 border-b border-slate-100 mb-3">
                <History className="w-4 h-4 text-indigo-600" />
                <span>{language === 'lo' ? 'ປະຫວັດເວີຊັນ (Version History)' : 'Version History'}</span>
              </h3>

              <div className="space-y-2">
                {selectedDoc.versions?.map((ver: any) => (
                  <div key={ver.id} className="p-2.5 rounded-xl border border-slate-100 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-blue-600 mr-2">v{ver.version_number}.0</span>
                      <span className="text-slate-700">{ver.change_summary}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{ver.created_at}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
