'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface StudentData {
  id: string;
  admission_no: string;
  full_name: string;
  class: string;
  term: string;
  session: string;
  signed_url: string;
  pin_usage_count: number;
  pin_usage_limit: number;
}

export default function ResultPage() {
  const router = useRouter();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [blobUrl, setBlobUrl] = useState('');
  const [signedUrl, setSignedUrl] = useState('');
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pdfError, setPdfError] = useState(false);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const blobUrlRef = useRef('');

  const loadPdfAsBlob = useCallback(async (url: string) => {
    setPdfError(false);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const newBlobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = newBlobUrl;
      setBlobUrl(newBlobUrl);
    } catch {
      setPdfError(true);
    }
  }, []);

  const refreshUrl = useCallback(async () => {
    try {
      const res = await fetch('/api/get-pdf-url', { cache: 'no-store' });
      if (res.status === 401) { setExpired(true); return; }
      if (res.ok) {
        const data = await res.json();
        setSignedUrl(data.signed_url);
        await loadPdfAsBlob(data.signed_url);
      }
    } catch { /* expire naturally */ }
  }, [loadPdfAsBlob]);

  useEffect(() => {
    const stored = sessionStorage.getItem('result_student');
    if (!stored) { router.replace('/'); return; }
    try {
      const data: StudentData = JSON.parse(stored);
      setStudent(data);
      setSignedUrl(data.signed_url);
      loadPdfAsBlob(data.signed_url).then(() => setLoading(false));
      refreshTimerRef.current = setInterval(refreshUrl, 90_000);
    } catch { router.replace('/'); }

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, [router, refreshUrl, loadPdfAsBlob]);

  // Print: open raw signed URL in new tab — prints ONLY the PDF, nothing else
  const handlePrint = async () => {
    try {
      const res = await fetch('/api/get-pdf-url', { cache: 'no-store' });
      const freshUrl = res.ok ? (await res.json()).signed_url : signedUrl;
      const win = window.open(freshUrl, '_blank');
      if (win) win.onload = () => { win.focus(); win.print(); };
    } catch {
      const win = window.open(blobUrl, '_blank');
      if (win) win.onload = () => { win.focus(); win.print(); };
    }
  };

  const handleOpenPdf = async () => {
    try {
      const res = await fetch('/api/get-pdf-url', { cache: 'no-store' });
      const freshUrl = res.ok ? (await res.json()).signed_url : signedUrl;
      window.open(freshUrl, '_blank');
    } catch {
      window.open(blobUrl, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="text-center">
          <svg className="animate-spin w-8 h-8 text-[#4169E1] mx-auto" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="mt-3 text-gray-500 text-sm">Loading your result...</p>
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] px-4">
        <div className="bg-white rounded-lg border border-gray-200 p-8 max-w-sm w-full text-center">
          <span className="text-4xl">⏰</span>
          <h2 className="font-garamond text-xl font-semibold text-[#1a1a2e] mt-4">Session Expired</h2>
          <p className="text-gray-500 text-sm mt-2">Your result session has expired. Please re-enter your PIN to view again.</p>
          <button onClick={() => { sessionStorage.removeItem('result_student'); router.push('/'); }}
            className="mt-5 bg-[#4169E1] hover:bg-[#2c4fc9] text-white font-semibold px-6 py-2.5 rounded-md text-sm">
            Re-enter PIN
          </button>
        </div>
      </div>
    );
  }

  if (!student) return null;

  const usagesLeft = student.pin_usage_limit - student.pin_usage_count;
  const usagePct = (student.pin_usage_count / student.pin_usage_limit) * 100;

  return (
    <>
      {/* Print styles: hides buttons/actions, keeps nav + result */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
          @page { size: A4; margin: 10mm; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="min-h-screen flex flex-col bg-[#F5F5F5]">

        {/* ── Navigation bar — visible on screen AND on print ── */}
        <nav className="bg-[#1a1a2e] text-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#FFD700] flex items-center justify-center font-bold text-[#1a1a2e] text-sm flex-shrink-0">RC</div>
              <div>
                <p className="font-semibold text-sm leading-tight">Rehoboth College</p>
                <p className="text-xs text-[#FFD700] leading-tight">Official Result Portal</p>
              </div>
            </div>
            {/* Buttons hidden on print */}
            <div className="flex items-center gap-2 no-print">
              <button onClick={handlePrint}
                className="bg-[#FFD700] hover:bg-[#d4af00] text-[#1a1a2e] font-semibold px-4 py-2 rounded-md text-sm flex items-center gap-1.5">
                🖨 <span className="hidden sm:inline">Print</span>
              </button>
              <button onClick={handleOpenPdf}
                className="bg-white/10 hover:bg-white/20 text-white text-sm px-3 py-2 rounded-md border border-white/20">
                Open PDF
              </button>
              <button onClick={() => { sessionStorage.removeItem('result_student'); router.push('/'); }}
                className="text-gray-300 hover:text-white text-xs px-3 py-2 border border-gray-600 rounded-md">
                Exit
              </button>
            </div>
            {/* Print-only label */}
            <div className="print-only text-xs text-gray-300">
              Printed: {new Date().toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </nav>

        {/* ── Result info strip — visible on screen AND print ── */}
        <div className="bg-white border-b border-gray-200" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <span className="text-sm text-gray-500">Student: <span className="font-semibold text-[#1a1a2e]">{student.full_name}</span></span>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="text-sm text-gray-500">Adm. No: <span className="font-mono font-semibold text-[#4169E1]">{student.admission_no}</span></span>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="text-sm text-gray-500">Class: <span className="font-semibold text-[#1a1a2e]">{student.class}</span></span>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="text-sm text-gray-500">{student.term} &mdash; <span className="font-semibold text-[#1a1a2e]">{student.session}</span></span>

            {/* PIN usage — right side */}
            <div className="ml-auto flex items-center gap-2 no-print">
              <div className="text-right">
                <p className="text-xs text-gray-400 leading-none">PIN Usage</p>
                <p className="text-xs font-semibold text-[#1a1a2e] leading-none mt-0.5">
                  {student.pin_usage_count}/{student.pin_usage_limit} uses
                  {usagesLeft <= 1 && <span className="text-red-500 ml-1">({usagesLeft} left)</span>}
                </p>
              </div>
              <div className="w-12 bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${usagePct >= 80 ? 'bg-red-500' : usagePct >= 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            </div>

            {/* PIN usage — print version (plain text, always visible during print) */}
            <div className="print-only ml-auto text-xs text-gray-500">
              PIN used: {student.pin_usage_count}/{student.pin_usage_limit}
            </div>

            {/* Secure badge — screen only */}
            <span className="ml-2 flex items-center gap-1 text-xs text-green-600 font-medium no-print">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>Secure
            </span>
          </div>
        </div>

        {/* ── PDF Viewer ── */}
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4">
          <div
            className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm"
            onContextMenu={(e) => e.preventDefault()}
          >
            {pdfError ? (
              // Fallback: blob fetch failed (very rare — usually Safari private mode)
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <span className="text-5xl mb-4">📄</span>
                <h3 className="font-semibold text-[#1a1a2e] mb-2">Result Ready</h3>
                <p className="text-gray-500 text-sm mb-5 max-w-xs">
                  Your result could not display inline on this browser. Open it directly below.
                </p>
                <button
                  onClick={handleOpenPdf}
                  className="bg-[#4169E1] hover:bg-[#2c4fc9] text-white font-semibold px-6 py-3 rounded-md text-sm"
                >
                  Open Result PDF
                </button>
                <p className="text-xs text-gray-400 mt-3">Use your browser's print button to print after opening</p>
              </div>
            ) : blobUrl ? (
              <iframe
                src={blobUrl}
                className="w-full border-none block"
                style={{ height: '82vh', minHeight: '500px' }}
                title="Your Result"
              />
            ) : (
              <div className="flex items-center justify-center h-64">
                <svg className="animate-spin w-6 h-6 text-[#4169E1]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between no-print">
            <p className="text-xs text-gray-400">Session auto-refreshes. {usagesLeft} PIN use(s) remaining.</p>
            <div className="flex items-center gap-2">
              <button onClick={handleOpenPdf}
                className="border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-4 py-2 rounded-md text-sm">
                Open PDF
              </button>
              <button onClick={handlePrint}
                className="bg-[#4169E1] hover:bg-[#2c4fc9] text-white font-semibold px-5 py-2 rounded-md text-sm flex items-center gap-2">
                🖨 Print Result
              </button>
            </div>
          </div>
        </main>

        <footer className="bg-[#1a1a2e] text-gray-400 text-xs text-center py-3 mt-2 no-print">
          <p>© {new Date().getFullYear()} Rehoboth College. Official Result Portal.</p>
        </footer>
      </div>
    </>
  );
}
