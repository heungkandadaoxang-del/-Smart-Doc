import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { DocumentRecord } from '../../types/index.js';
import {
  ArrowLeft,
  FileText,
  Filter,
  Building,
  Clock,
  Shield,
  AlertCircle,
  FileCheck,
  Search,
  Download,
  CheckCircle,
} from 'lucide-react';

interface FilteredRecordsViewProps {
  filterCriteria: {
    dept_code?: string;
    dept_id?: string;
    doc_type?: string;
    workflow_status?: string;
    confidentiality?: string;
    priority?: string;
    period?: string;
    startDate?: string;
    endDate?: string;
    label?: string;
  };
  onBack: () => void;
}

export const FilteredRecordsView: React.FC<FilteredRecordsViewProps> = ({
  filterCriteria,
  onBack,
}) => {
  const { fetchWithAuth, language, t } = useAuth();
  const [records, setRecords] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadRecords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCriteria.dept_code) params.set('dept_code', filterCriteria.dept_code);
      if (filterCriteria.dept_id) params.set('dept_id', filterCriteria.dept_id);
      if (filterCriteria.doc_type) params.set('doc_type', filterCriteria.doc_type);
      if (filterCriteria.workflow_status) params.set('workflow_status', filterCriteria.workflow_status);
      if (filterCriteria.confidentiality) params.set('confidentiality', filterCriteria.confidentiality);
      if (filterCriteria.priority) params.set('priority', filterCriteria.priority);
      if (filterCriteria.period) params.set('period', filterCriteria.period);
      if (filterCriteria.startDate) params.set('startDate', filterCriteria.startDate);
      if (filterCriteria.endDate) params.set('endDate', filterCriteria.endDate);

      const res = await fetchWithAuth(`/api/dashboard/filtered-records?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.records);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [filterCriteria]);

  const filtered = records.filter(r =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.reg_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.sender && r.sender.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center space-x-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold mb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{language === 'lo' ? 'ກັບຄືນສູ່ Dashboard' : 'Back to Dashboard'}</span>
          </button>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <span>{language === 'lo' ? 'ລາຍການເອກະສານຕາມເງື່ອນໄຂ' : 'Filtered Document Records'}</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
              {records.length} {language === 'lo' ? 'ສະບັບ' : 'records'}
            </span>
          </h1>

          {/* Unboxed Metadata Filter Indicators */}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500">
            <span>{language === 'lo' ? 'ເງື່ອນໄຂກັ່ນຕອງຈາກ Chart:' : 'Active Chart Drill-down Criteria:'}</span>
            {filterCriteria.label && (
              <span className="font-semibold text-slate-800">
                "{filterCriteria.label}"
              </span>
            )}
            {filterCriteria.dept_code && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-blue-600 font-bold">ພະແນກ: {filterCriteria.dept_code}</span>
              </>
            )}
            {filterCriteria.doc_type && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-slate-800">ປະເພດ: {filterCriteria.doc_type}</span>
              </>
            )}
            {filterCriteria.workflow_status && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-slate-800">ສະຖານະ: {filterCriteria.workflow_status}</span>
              </>
            )}
            {filterCriteria.confidentiality && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-slate-800">ຊັ້ນຄວາມລັບ: {filterCriteria.confidentiality}</span>
              </>
            )}
            {filterCriteria.priority && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-slate-800">ລະດັບຄວາມຮີບດ່ວນ: {filterCriteria.priority}</span>
              </>
            )}
            {filterCriteria.startDate && filterCriteria.endDate && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px] font-semibold">
                  {filterCriteria.startDate} ຫາ {filterCriteria.endDate}
                </span>
              </>
            )}
            {filterCriteria.period && !filterCriteria.startDate && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-slate-700">{filterCriteria.period}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={language === 'lo' ? 'ຄົ້ນຫາໃນລາຍການ...' : 'Search within records...'}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">{language === 'lo' ? 'ເລກທີລົງທະບຽນ' : 'Reg Number'}</th>
                <th className="py-3 px-4">{language === 'lo' ? 'ຫົວຂໍ້ເອກະສານ' : 'Document Title'}</th>
                <th className="py-3 px-4">{language === 'lo' ? 'ພະແນກ' : 'Department'}</th>
                <th className="py-3 px-4">{language === 'lo' ? 'ປະເພດ' : 'Type'}</th>
                <th className="py-3 px-4">{language === 'lo' ? 'ຊັ້ນຄວາມລັບ' : 'Confidentiality'}</th>
                <th className="py-3 px-4">{language === 'lo' ? 'ສະຖານະ' : 'Workflow'}</th>
                <th className="py-3 px-4">{language === 'lo' ? 'ວັນທີ' : 'Date'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    {language === 'lo' ? 'ບໍ່ພົບເອກະສານທີ່ກົງກັບເງື່ອນໄຂ' : 'No document records match these filters'}
                  </td>
                </tr>
              ) : (
                filtered.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                      {doc.reg_number}
                    </td>
                    <td className="py-3.5 px-4 max-w-md">
                      <div className="font-semibold text-slate-900 line-clamp-1">{doc.title}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">
                        {language === 'lo' ? 'ຜູ້ສົ່ງ:' : 'From:'} {doc.sender || 'LHSE'}
                        {doc.recipient && ` → ${doc.recipient}`}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-700">{doc.dept_name_lo || doc.dept_id}</span>
                      {doc.dept_code && (
                        <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {doc.dept_code}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-medium text-slate-700">{doc.doc_type}</span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          doc.confidentiality === 'PUBLIC'
                            ? 'bg-slate-100 text-slate-700'
                            : doc.confidentiality === 'INTERNAL'
                            ? 'bg-blue-100 text-blue-700'
                            : doc.confidentiality === 'CONFIDENTIAL'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {doc.confidentiality}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          doc.workflow_status === 'COMPLETED' || doc.workflow_status === 'SIGNED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : doc.workflow_status === 'APPROVED'
                            ? 'bg-blue-100 text-blue-700'
                            : doc.workflow_status === 'IN_REVIEW'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {doc.workflow_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {doc.doc_date}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
