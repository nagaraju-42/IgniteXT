'use client';

import React, { useState, useRef } from 'react';
import { 
  CameraIcon, 
  UploadIcon, 
  CheckCircleIcon, 
  Loader2Icon, 
  XIcon, 
  SparklesIcon, 
  CalendarIcon, 
  AlertCircleIcon,
  ChevronRightIcon
} from 'lucide-react';
import { scanHallTicket, saveExamTimetable, HallTicketScanResult, TimetableEntry } from '@/lib/hallTicketScanner';

interface HallTicketScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: HallTicketScanResult) => void;
}

export function HallTicketScannerModal({ isOpen, onClose, onSuccess }: HallTicketScannerModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [result, setResult] = useState<HallTicketScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setError(null);
      setResult(null);
    }
  };

  const handleStartScan = async () => {
    if (!file) return;
    setIsScanning(true);
    setError(null);
    setScanStep('Running On-Device ML Kit OCR...');

    try {
      const scanOutput = await scanHallTicket(file);
      setResult(scanOutput);
      setIsScanning(false);
    } catch (err: any) {
      console.error(err);
      setError('Could not parse the hall ticket image clearly. Please ensure good lighting or enter details manually.');
      setIsScanning(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    // Save timetable to localStorage
    if (result.timetable && result.timetable.length > 0) {
      saveExamTimetable(result.timetable);
    }
    onSuccess(result);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 animate-in fade-in duration-300">
      <div className="bg-[var(--paper)] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border-[2px] border-[var(--rule-strong)] flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 pb-3 border-b border-[var(--rule)] bg-[var(--paper-card)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#D7E600] border-[1.5px] border-[var(--ink)] shadow-[2px_2px_0_var(--ink)] flex items-center justify-center">
              <CameraIcon className="w-5 h-5 text-[var(--ink)]" />
            </div>
            <div>
              <h2 className="font-bold text-[17px] text-[var(--ink)] leading-tight">
                Scan Hall Ticket
              </h2>
              <p className="text-[11px] text-[var(--ink-soft)]">
                Instant ML Kit OCR · Auto-Sorts Exam Timetable
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--ink-soft)] hover:bg-[var(--paper-deep)] transition-colors cursor-pointer"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex flex-col gap-4 flex-1">
          {!result && (
            <>
              {/* Photo Upload Zone */}
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                capture="environment"
                onChange={handleFileChange}
                className="hidden" 
              />

              {!previewUrl ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[var(--ink)] rounded-2xl p-6 bg-[var(--paper-deep)] flex flex-col items-center justify-center text-center gap-2.5 cursor-pointer hover:bg-[var(--paper-card)] transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-[#D7E600] flex items-center justify-center border-[1.5px] border-[var(--ink)] shadow-[2px_2px_0_var(--ink)]">
                    <UploadIcon className="w-6 h-6 text-[var(--ink)]" />
                  </div>
                  <div>
                    <span className="font-bold text-[14px] text-[var(--ink)] block">
                      Choose Photo or Take Picture
                    </span>
                    <span className="text-[11.5px] text-[var(--ink-soft)]">
                      Supports JPG, PNG of your Hall Ticket or Timetable
                    </span>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border-[1.5px] border-[var(--rule-strong)] bg-black/5 aspect-[4/3] flex items-center justify-center">
                  <img 
                    src={previewUrl} 
                    alt="Hall Ticket preview" 
                    className="max-h-full max-w-full object-contain"
                  />
                  <button 
                    onClick={() => { setFile(null); setPreviewUrl(null); }}
                    className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80 transition-colors"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Informational Benefits Pill */}
              <div className="bg-[#D7E600]/15 border border-[#D7E600] rounded-xl p-3 flex items-start gap-2.5">
                <SparklesIcon className="w-4 h-4 text-[var(--ink)] shrink-0 mt-0.5" />
                <div className="text-[11.5px] text-[var(--ink)] leading-relaxed">
                  <strong>Zero-effort setup:</strong> Automatically detects your <strong>Roll Number</strong>, <strong>Regulation (R22)</strong>, <strong>Branch (CSE)</strong>, and maps <strong>Live Exam Countdowns</strong> to each subject on your home screen!
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2 text-red-600 text-[12px]">
                  <AlertCircleIcon className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Scan Action Button */}
              {previewUrl && (
                <button
                  type="button"
                  onClick={handleStartScan}
                  disabled={isScanning}
                  className="w-full bg-[#D7E600] text-[var(--ink)] font-bold text-[14px] py-3 rounded-xl border-[1.5px] border-[var(--ink)] shadow-[2px_2px_0_var(--ink)] flex items-center justify-center gap-2 hover:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50"
                >
                  {isScanning ? (
                    <>
                      <Loader2Icon className="w-4 h-4 animate-spin" />
                      <span>{scanStep || 'Scanning...'}</span>
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-4 h-4" />
                      <span>Scan & Extract Details</span>
                    </>
                  )}
                </button>
              )}
            </>
          )}

          {/* Scanned Results View */}
          {result && (
            <div className="flex flex-col gap-3.5 animate-in fade-in duration-300">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-2.5 text-emerald-800">
                <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-[12px] leading-tight">
                  <span className="font-bold">Hall Ticket Scanned!</span>
                  <p className="text-[10.5px] text-emerald-700 mt-0.5">
                    {result.usedGemini ? 'Enhanced with Gemini AI Backup' : 'Parsed instantly via On-Device ML Kit'}
                  </p>
                </div>
              </div>

              {/* Detected Profile Attributes */}
              <div className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-3 bg-[var(--paper-deep)] flex flex-col gap-2">
                <div className="flex justify-between items-center text-[12px] pb-1.5 border-b border-[var(--rule)]">
                  <span className="text-[var(--ink-soft)] font-medium">Roll Number:</span>
                  <span className="font-mono font-bold text-[var(--ink)]">{result.roll || 'Not detected'}</span>
                </div>
                <div className="flex justify-between items-center text-[12px] pb-1.5 border-b border-[var(--rule)]">
                  <span className="text-[var(--ink-soft)] font-medium">Regulation:</span>
                  <span className="font-mono font-bold text-[var(--ink)]">{result.regulation || 'R22'}</span>
                </div>
                <div className="flex justify-between items-center text-[12px] pb-1.5 border-b border-[var(--rule)]">
                  <span className="text-[var(--ink-soft)] font-medium">Branch:</span>
                  <span className="font-mono font-bold text-[var(--ink)]">{result.branch || 'CSE'}</span>
                </div>
                <div className="flex justify-between items-center text-[12px]">
                  <span className="text-[var(--ink-soft)] font-medium">Semester:</span>
                  <span className="font-mono font-bold text-[var(--ink)]">Sem {result.semester || 7}</span>
                </div>
              </div>

              {/* Detected Timetable */}
              {result.timetable && result.timetable.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <CalendarIcon className="w-3.5 h-3.5 text-[var(--ink)]" />
                    <span className="text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider">
                      Detected Exam Timetable ({result.timetable.length})
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                    {result.timetable.map((entry, idx) => (
                      <div 
                        key={idx}
                        className="p-2.5 rounded-lg border border-[var(--rule-strong)] bg-[var(--paper)] flex justify-between items-center text-[11.5px]"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-mono font-bold text-[var(--ink)]">{entry.subject_code}</span>
                          {entry.subject_name && (
                            <span className="text-[var(--ink-soft)] block truncate text-[11px]">
                              {entry.subject_name}
                            </span>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="font-mono font-bold text-[var(--ink)] block">
                            {entry.exam_date || 'Date TBD'}
                          </span>
                          {entry.exam_time && (
                            <span className="text-[10px] text-[var(--ink-soft)] block">
                              {entry.exam_time}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Apply / Confirmation Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--rule-strong)] text-[var(--ink-soft)] text-[12px] font-bold hover:bg-[var(--paper-deep)] cursor-pointer"
                >
                  Rescan
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="flex-1 bg-[#D7E600] text-[var(--ink)] font-bold text-[13.5px] py-2.5 rounded-xl border-[1.5px] border-[var(--ink)] shadow-[2px_2px_0_var(--ink)] flex items-center justify-center gap-1.5 cursor-pointer hover:translate-y-[1px] transition-all"
                >
                  <span>Apply & Save Timetable</span>
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
