import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import {
  PenTool,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Download,
  Upload,
  Copy,
  Building2,
  Clock,
  UserCheck,
  FileText,
  Search,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { alertService } from '../../services/swal.js';

interface SignatureQrViewProps {
  initialDocId?: string;
  onNavigateBack?: () => void;
}

export const SignatureQrView: React.FC<SignatureQrViewProps> = ({
  initialDocId,
  onNavigateBack,
}) => {
  const { user, fetchWithAuth, language } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>(initialDocId || '');
  const [docDetail, setDocDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Signing mode: 'DRAW' or 'UPLOAD'
  const [signMode, setSignMode] = useState<'DRAW' | 'UPLOAD'>('DRAW');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadedStamp, setUploadedStamp] = useState<string | null>(null);
  const [submittingSign, setSubmittingSign] = useState(false);

  // QR Code result
  const [qrInfo, setQrInfo] = useState<any>(null);

  // Public verification simulator
  const [verifyTokenInput, setVerifyTokenInput] = useState('');
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  // Load eligible documents for signing
  const loadDocuments = async () => {
    try {
      const res = await fetchWithAuth('/api/documents?limit=50');
      const data = await res.json();
      if (data.success) {
        setDocuments(data.documents);
        if (!selectedDocId && data.documents.length > 0) {
          setSelectedDocId(data.documents[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  // Load selected document details & existing QR
  useEffect(() => {
    if (!selectedDocId) return;
    const fetchDoc = async () => {
      setLoading(true);
      try {
        const res = await fetchWithAuth(`/api/documents/${selectedDocId}`);
        const data = await res.json();
        if (data.success) {
          setDocDetail(data);
        }

        // Fetch QR Code
        const qrRes = await fetch(`/api/signatures/${selectedDocId}/qr`);
        const qrData = await qrRes.json();
        if (qrData.success) {
          setQrInfo(qrData);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [selectedDocId]);

  // Canvas Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'clientX' in e ? e.clientX - rect.left : e.touches[0].clientX - rect.left;
    const y = 'clientY' in e ? e.clientY - rect.top : e.touches[0].clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e3a8a'; // Deep LHSE Blue ink
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'clientX' in e ? e.clientX - rect.left : e.touches[0].clientX - rect.left;
    const y = 'clientY' in e ? e.clientY - rect.top : e.touches[0].clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedStamp(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleExecuteSignature = async () => {
    let signatureData = '';
    if (signMode === 'DRAW') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) {
        alertService.error(
          language === 'lo' ? 'ກະລຸນາແຕ້ມລາຍເຊັນ' : 'Signature Required',
          language === 'lo' ? 'ກະລຸນາແຕ້ມລາຍເຊັນໃນກ່ອງລົງລາຍເຊັນກ່ອນ' : 'Please draw your signature on the canvas first'
        );
        return;
      }
      signatureData = canvas.toDataURL('image/png');
    } else {
      if (!uploadedStamp) {
        alertService.error(
          language === 'lo' ? 'ກະລຸນາອັບໂຫຼດກາປະທັບ' : 'Stamp Required',
          language === 'lo' ? 'ກະລຸນາເລືອກໄຟລ໌ກາປະທັບລາຍເຊັນ' : 'Please upload signature stamp image'
        );
        return;
      }
      signatureData = uploadedStamp;
    }

    const confirm = await alertService.confirm(
      language === 'lo' ? 'ຢືນຢັນການລົງລາຍເຊັນເອເລັກໂຕຣນິກ' : 'Confirm Electronic Signature',
      language === 'lo'
        ? `ທ່ານກຳລັງຈະລົງລາຍເຊັນດິຈິຕອນໃສ່ເອກະສານ ${docDetail?.document?.reg_number} ພ້ອມສ້າງລະຫັດກວດສອບ QR ແລະ Cryptographic SHA-256 Hash.`
        : `Sign document ${docDetail?.document?.reg_number} with digital seal and SHA-256 integrity hash?`,
      language === 'lo' ? 'ລົງລາຍເຊັນດຽວນີ້' : 'Sign Now',
      language === 'lo' ? 'ຍົກເລີກ' : 'Cancel'
    );

    if (confirm.isConfirmed) {
      setSubmittingSign(true);
      try {
        const res = await fetchWithAuth(`/api/signatures/${selectedDocId}/sign`, {
          method: 'POST',
          body: JSON.stringify({
            signatureType: signMode === 'DRAW' ? 'DRAWN' : 'UPLOADED_STAMP',
            signatureData,
          }),
        });
        const data = await res.json();
        if (data.success) {
          alertService.success(
            language === 'lo' ? 'ລົງລາຍເຊັນດິຈິຕອນສຳເລັດ' : 'Document Signed Successfully',
            `${language === 'lo' ? 'ລະຫັດກວດສອບ:' : 'Verification Token:'} ${data.verificationToken}`
          );

          // Refresh details & QR
          const qrRes = await fetch(`/api/signatures/${selectedDocId}/qr`);
          const qrData = await qrRes.json();
          if (qrData.success) {
            setQrInfo(qrData);
          }
          // Reload doc details
          const docRes = await fetchWithAuth(`/api/documents/${selectedDocId}`);
          const newDocData = await docRes.json();
          if (newDocData.success) {
            setDocDetail(newDocData);
          }
        } else {
          alertService.error('Sign Failed', data.message);
        }
      } catch (e) {
        alertService.error('Error', 'Signature submission failed');
      } finally {
        setSubmittingSign(false);
      }
    }
  };

  const handleVerifyToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!verifyTokenInput.trim()) return;

    setVerifying(true);
    setVerificationResult(null);
    try {
      const res = await fetch(`/api/signatures/verify/${encodeURIComponent(verifyTokenInput.trim())}`);
      const data = await res.json();
      setVerificationResult(data);
    } catch (e) {
      setVerificationResult({ success: false, messageLo: 'ການເຊື່ອມຕໍ່ກວດສອບຜິດພາດ' });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <PenTool className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {language === 'lo'
                ? 'ລົງລາຍເຊັນເອເລັກໂຕຣນິກ & ກວດສອບ QR (E-Signature & QR Verification)'
                : 'Cryptographic E-Signature & QR Document Verification'}
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            {language === 'lo'
              ? 'ແຕ້ມລາຍເຊັນ, ອັບໂຫຼດກາປະທັບ, ສ້າງ QR Code ມາດຕະຖານ, ແລະ ກວດສອບຄວາມຖືກຕ້ອງດ້ວຍ SHA-256 Hash.'
              : 'Canvas signing pad, official stamps, QR code generation, and public SHA-256 verification.'}
          </p>
        </div>

        {/* Document Selector Dropdown */}
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <select
            value={selectedDocId}
            onChange={e => setSelectedDocId(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold cursor-pointer max-w-xs truncate"
          >
            {documents.map(d => (
              <option key={d.id} value={d.id}>
                {d.reg_number} - {d.title.substring(0, 30)}...
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Signing Pad (Left) & QR Code / Mobile Verifier (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Interactive E-Signature Canvas */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <PenTool className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">
                {language === 'lo' ? 'ແຜ່ນລົງລາຍເຊັນດິຈິຕອນ' : 'Digital Signature Pad'}
              </h2>
            </div>
            <div className="flex items-center space-x-1 p-0.5 bg-slate-100 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setSignMode('DRAW')}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  signMode === 'DRAW' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                {language === 'lo' ? 'ແຕ້ມລາຍເຊັນ' : 'Draw'}
              </button>
              <button
                type="button"
                onClick={() => setSignMode('UPLOAD')}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  signMode === 'UPLOAD' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                {language === 'lo' ? 'ອັບໂຫຼດກາປະທັບ' : 'Stamp Upload'}
              </button>
            </div>
          </div>

          {/* Signer Info Badge */}
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 block">{language === 'lo' ? 'ຜູ້ລົງລາຍເຊັນ:' : 'Signer:'}</span>
              <span className="font-bold text-blue-900">{user?.full_name_lo}</span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-500 block">{language === 'lo' ? 'ເຂດເວລາ:' : 'Timezone:'}</span>
              <span className="font-mono text-slate-700 text-[11px]">Asia/Vientiane (UTC+7)</span>
            </div>
          </div>

          {/* Canvas or Stamp Upload area */}
          {signMode === 'DRAW' ? (
            <div>
              <div className="border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/80 p-2 text-center relative overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={180}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-44 bg-white rounded-xl shadow-inner cursor-crosshair touch-none"
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-400 text-xs">
                    ✍️ {language === 'lo' ? 'ໃຊ້ເມົ້າ ຫຼື ນິ້ວມືແຕ້ມລາຍເຊັນໃສ່ບ່ອນນີ້' : 'Draw your signature in this box'}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-[11px] text-slate-400">
                  {language === 'lo' ? 'ລາຍເຊັນຈະຖືກເຂົ້າລະຫັດ SHA-256' : 'Signature bound via SHA-256'}
                </span>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="px-2.5 py-1 text-slate-600 hover:text-red-600 text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{language === 'lo' ? 'ລຶບແຕ້ມໃໝ່' : 'Clear'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 p-6 text-center">
              {uploadedStamp ? (
                <div className="space-y-3">
                  <img src={uploadedStamp} alt="Stamp" className="max-h-32 mx-auto object-contain" />
                  <button
                    type="button"
                    onClick={() => setUploadedStamp(null)}
                    className="text-xs text-red-600 font-semibold hover:underline"
                  >
                    {language === 'lo' ? 'ເລືອກຮູບໃໝ່' : 'Remove stamp'}
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">
                    {language === 'lo' ? 'ຄລິກເພື່ອອັບໂຫຼດຮູບກາປະທັບ (PNG/JPG)' : 'Upload Official LHSE Stamp (PNG/JPG)'}
                  </p>
                  <input type="file" accept="image/*" onChange={handleStampUpload} className="hidden" />
                </label>
              )}
            </div>
          )}

          {/* Action button */}
          <button
            type="button"
            disabled={submittingSign}
            onClick={handleExecuteSignature}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-md shadow-blue-600/30 transition cursor-pointer disabled:opacity-60"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span>
              {submittingSign
                ? (language === 'lo' ? 'ກຳລັງຢືນຢັນລາຍເຊັນ...' : 'Cryptographic Signing...')
                : (language === 'lo' ? 'ຢືນຢັນການລົງລາຍເຊັນເອເລັກໂຕຣນິກ' : 'Execute Cryptographic Signature')}
            </span>
          </button>

          {/* Existing Signatures on this document */}
          {docDetail?.signatures?.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <h3 className="font-bold text-xs text-slate-800 mb-2">
                {language === 'lo' ? 'ລາຍເຊັນທີ່ຖືກຕ້ອງໃນເອກະສານນີ້:' : 'Valid Signatures on this document:'}
              </h3>
              <div className="space-y-2">
                {docDetail.signatures.map((sig: any) => (
                  <div key={sig.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{sig.signer_name_lo}</div>
                      <div className="text-[11px] text-slate-500">{sig.signer_title} • {sig.signed_at}</div>
                      <div className="text-[10px] text-blue-600 font-mono mt-0.5">Token: {sig.verification_token}</div>
                    </div>
                    {sig.signature_data && (
                      <img src={sig.signature_data} alt="Sig" className="h-10 w-24 object-contain bg-white rounded border border-slate-100" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: QR Code Card & Public Mobile Verification Simulator */}
        <div className="space-y-6">
          {/* Official QR Code Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs text-center space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-left">
              <div className="flex items-center space-x-2">
                <QrCode className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  {language === 'lo' ? 'ລະຫັດ QR ຢືນຢັນເອກະສານ' : 'Verification QR Code'}
                </h2>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                High ECC (Level H)
              </span>
            </div>

            {qrInfo?.qrDataUrl ? (
              <div className="space-y-3">
                <div className="inline-block p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-sm">
                  <img src={qrInfo.qrDataUrl} alt="Document QR" className="w-48 h-48 mx-auto" />
                </div>
                <div className="text-xs">
                  <span className="text-slate-400 block mb-0.5">{language === 'lo' ? 'ລະຫັດ Token ປະຈຳເອກະສານ:' : 'Verification Token:'}</span>
                  <div className="flex items-center justify-center space-x-2 font-mono text-[11px] text-slate-700 bg-slate-50 p-1.5 rounded-lg border border-slate-200 select-all">
                    <span>{qrInfo.token}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(qrInfo.token);
                        setVerifyTokenInput(qrInfo.token);
                        alertService.toast('success', 'Token copied');
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  {language === 'lo'
                    ? 'ສາມາດໃຊ້ກ້ອງມືຖື ຫຼື ເຄື່ອງສະແກນ QR ອ່ານເພື່ອກວດສອບຄວາມຖືກຕ້ອງໄດ້ທັນທີ.'
                    : 'Scan with smartphone camera to instantly verify authenticity.'}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-10">
                {language === 'lo' ? 'ກະລຸນາເລືອກເອກະສານເພື່ອສ້າງ QR' : 'Select a document to generate QR'}
              </p>
            )}
          </div>

          {/* Live QR Verification Simulator (Simulates Mobile Scan) */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold">
                {language === 'lo' ? 'ລະບົບກວດສອບເອກະສານ (Verification Portal)' : 'Public Document Authenticator'}
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              {language === 'lo'
                ? 'ທົດສອບກວດສອບຄວາມຖືກຕ້ອງຂອງເອກະສານດ້ວຍການປ້ອນ Token ຫຼື ເລກທີທະບຽນ'
                : 'Test verify any LHSE document authenticity by token or registration number'}
            </p>

            <form onSubmit={handleVerifyToken} className="flex gap-2">
              <input
                type="text"
                placeholder={language === 'lo' ? 'ປ້ອນ Verification Token ຫຼື ເລກທີ...' : 'Paste token or reg number...'}
                value={verifyTokenInput}
                onChange={e => setVerifyTokenInput(e.target.value)}
                className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={verifying}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-60"
              >
                {verifying ? '...' : (language === 'lo' ? 'ກວດສອບ' : 'Verify')}
              </button>
            </form>

            {/* Verification Result Output */}
            {verificationResult && (
              <div className={`p-4 rounded-xl border text-xs animate-fadeIn ${
                verificationResult.verified
                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                  : 'bg-red-950/60 border-red-500/60 text-red-200'
              }`}>
                <div className="flex items-center space-x-2 font-bold mb-2">
                  {verificationResult.verified ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                  <span className="text-sm">
                    {verificationResult.verified
                      ? (language === 'lo' ? 'ເອກະສານຖືກຕ້ອງແທ້ 100%' : 'OFFICIAL DOCUMENT VERIFIED')
                      : (language === 'lo' ? 'ບໍ່ສາມາດຢືນຢັນເອກະສານໄດ້' : 'VERIFICATION FAILED')}
                  </span>
                </div>

                <p className="text-[11px] mb-3 text-slate-300">
                  {language === 'lo' ? verificationResult.messageLo : verificationResult.messageEn}
                </p>

                {verificationResult.document && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-700/60 text-[11px]">
                    <div><span className="text-slate-400">Reg No:</span> <strong className="text-white font-mono">{verificationResult.document.regNumber}</strong></div>
                    <div><span className="text-slate-400">Title:</span> <span className="text-white">{verificationResult.document.title}</span></div>
                    <div><span className="text-slate-400">Dept:</span> <span className="text-white">{verificationResult.document.departmentLo}</span></div>
                    {verificationResult.signature && (
                      <div className="mt-2 pt-2 border-t border-slate-700/60">
                        <div><span className="text-slate-400">Signer:</span> <strong className="text-emerald-300">{verificationResult.signature.signerNameLo}</strong> ({verificationResult.signature.signerTitle})</div>
                        <div><span className="text-slate-400">Signed At:</span> <span className="text-slate-300 font-mono">{verificationResult.signature.signedAt}</span></div>
                        <div className="truncate"><span className="text-slate-400">SHA-256:</span> <span className="text-slate-400 font-mono text-[10px]">{verificationResult.signature.documentSha256}</span></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
