import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, Check, ArrowRight, Filter, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export type DashboardPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'custom';

export interface PeriodFilterBarProps {
  currentPeriod: DashboardPeriod;
  startDate?: string;
  endDate?: string;
  onPeriodChange: (period: DashboardPeriod) => void;
  onCustomRangeApply?: (startDate: string, endDate: string) => void;
  className?: string;
}

export const PeriodFilterBar: React.FC<PeriodFilterBarProps> = ({
  currentPeriod,
  startDate = '',
  endDate = '',
  onPeriodChange,
  onCustomRangeApply,
  className = '',
}) => {
  const { language } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [customStart, setCustomStart] = useState(startDate || '2026-10-01');
  const [customEnd, setCustomEnd] = useState(endDate || '2026-11-06');
  const [showCustomInputs, setShowCustomInputs] = useState(currentPeriod === 'custom');

  useEffect(() => {
    if (startDate) setCustomStart(startDate);
    if (endDate) setCustomEnd(endDate);
  }, [startDate, endDate]);

  useEffect(() => {
    setShowCustomInputs(currentPeriod === 'custom');
  }, [currentPeriod]);

  const periods: Array<{ id: DashboardPeriod; labelLo: string; labelEn: string; descLo: string; descEn: string }> = [
    { id: 'daily', labelLo: 'ມື້ນີ້ (Daily)', labelEn: 'Daily (Today)', descLo: 'ສະຖິຕິສະເພາະມື້ນີ້', descEn: 'Documents for today' },
    { id: 'weekly', labelLo: '7 ວັນຜ່ານມາ (Weekly)', labelEn: 'Weekly (Last 7 Days)', descLo: 'ຮອບ 1 ອາທິດຜ່ານມາ', descEn: 'Last 7 calendar days' },
    { id: 'monthly', labelLo: '30 ວັນຜ່ານມາ (Monthly)', labelEn: 'Monthly (Last 30 Days)', descLo: 'ຮອບ 1 ເດືອນຜ່ານມາ', descEn: 'Last 30 days' },
    { id: 'quarterly', labelLo: 'ໄຕຣມາດ (Quarterly - 90 ວັນ)', labelEn: 'Quarterly (Last 90 Days)', descLo: 'ຮອບ 90 ວັນຜ່ານມາ', descEn: 'Last 90 days' },
    { id: 'half_yearly', labelLo: '6 ເດືອນ (Half-Yearly)', labelEn: 'Half-Yearly (180 Days)', descLo: 'ເຄິ່ງປີຜ່ານມາ', descEn: 'Last 180 days' },
    { id: 'yearly', labelLo: 'ປີ 2026 (Yearly)', labelEn: 'Yearly (365 Days)', descLo: 'ສະຖິຕິຕະຫຼອດປີ', descEn: 'Full year 365 days' },
    { id: 'custom', labelLo: 'ກຳນົດຊ່ວງວັນທີເອງ (Custom Range)', labelEn: 'Custom Date Range', descLo: 'ເລືອກວັນທີເລີ່ມຕົ້ນ ແລະ ສິ້ນສຸດ', descEn: 'Select custom start & end date' },
  ];

  const currentPeriodObj = periods.find(p => p.id === currentPeriod) || periods[3];

  const handleSelectPeriod = (periodId: DashboardPeriod) => {
    setIsOpen(false);
    onPeriodChange(periodId);
    if (periodId === 'custom') {
      setShowCustomInputs(true);
      if (onCustomRangeApply && customStart && customEnd) {
        onCustomRangeApply(customStart, customEnd);
      }
    } else {
      setShowCustomInputs(false);
    }
  };

  const handleApplyCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customStart || !customEnd) return;
    if (customStart > customEnd) {
      alert(language === 'lo' ? 'ວັນທີເລີ່ມຕົ້ນຕ້ອງບໍ່ກາຍວັນທີສິ້ນສຸດ' : 'Start date cannot be after end date');
      return;
    }
    if (currentPeriod !== 'custom') {
      onPeriodChange('custom');
    }
    if (onCustomRangeApply) {
      onCustomRangeApply(customStart, customEnd);
    }
  };

  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-2 ${className}`}>
      {/* Multi-Period Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center justify-between space-x-2.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-xl border border-slate-300 shadow-xs transition cursor-pointer min-w-[200px]"
        >
          <div className="flex items-center space-x-2 truncate">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="truncate">
              {language === 'lo' ? currentPeriodObj.labelLo : currentPeriodObj.labelEn}
            </span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-fadeIn">
              <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {language === 'lo' ? 'ເລືອກຊ່ວງເວລາການສະແດງຜົນ' : 'Select Reporting Period'}
              </div>
              <div className="max-h-80 overflow-y-auto py-1">
                {periods.map(p => {
                  const isSelected = currentPeriod === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPeriod(p.id)}
                      className={`w-full px-3.5 py-2 text-left flex items-start justify-between hover:bg-blue-50/70 transition cursor-pointer ${
                        isSelected ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-medium">
                          {language === 'lo' ? p.labelLo : p.labelEn}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {language === 'lo' ? p.descLo : p.descEn}
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Custom Date Range Picker: visible when 'custom' is active or toggled */}
      {(showCustomInputs || currentPeriod === 'custom') && (
        <form
          onSubmit={handleApplyCustom}
          className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-50 border border-slate-200 rounded-xl"
        >
          <div className="flex items-center space-x-1 pl-2 pr-1">
            <span className="text-[11px] text-slate-500 font-medium">
              {language === 'lo' ? 'ແຕ່:' : 'From:'}
            </span>
            <input
              type="date"
              required
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="px-2 py-1 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-1 px-1">
            <span className="text-[11px] text-slate-500 font-medium">
              {language === 'lo' ? 'ຫາ:' : 'To:'}
            </span>
            <input
              type="date"
              required
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="px-2 py-1 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition flex items-center space-x-1 cursor-pointer"
          >
            <Filter className="w-3 h-3" />
            <span>{language === 'lo' ? 'ນຳໃຊ້' : 'Apply'}</span>
          </button>
        </form>
      )}
    </div>
  );
};
