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

  // Fetch the PDF and turn it into a local blob URL
  // This bypasses ALL iframe-blocking headers from Supabase Storage
  const loadPdfAsBlob = useCallback(async (url: string) => {
    setPdfError(false);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch PDF');
      const blob = await res.blob();
      // Revoke previous blob URL to free memory
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
    } catch {
      // Will expire naturally
    }
  }, [loadPdfAsBlob]);

  useEffect(() => {
    const stored = sessionStorage.getItem('result_student');
    if (!stored) { router.replace('/'); return; }

    try {
      const data = JSON.parse(stored);
      setStudent(data);
      setSignedUrl(data.signed_url);
      // Load PDF immediately as blob
      loadPdfAsBlob(data.signed_url).then(() => setLoading(false));
      // Refresh signed URL every 90s (before 120s expiry)
      refreshTimerRef.current = setInterval(refreshUrl, 90 * 1000);
    } catch {
      router.replace('/');
    }

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, [router, refreshUrl, loadPdfAsBlob]);

  // Print: open the signed URL in a new tab and trigger print there
  // This prints only the clean PDF — no portal chrome, no student info panel
  const handlePrint = async () => {
    try {
      // Use latest signed URL (refresh first to guarantee it's fresh)
      const res = await fetch('/api/get-pdf-url', { cache: 'no-store' });
      const freshUrl = res.ok ? (await res.json()).signed_url : signedUrl;
      const win = window.open(freshUrl, '_blank');
      if (win) {
        win.onload = () => {
          win.focus();
          win.print();
        };
      }
    } catch {
      // Fallback: open current blob URL
      const win = window.open(blobUrl, '_blank');
      if (win) { win.onload = () => { win.focus(); win.print(); }; }
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
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-yellow-50 flex items-center justify-center">
            <span className="text-2xl">⏰</span>
          </div>
          <h2 className="font-garamond text-xl font-semibold text-[#1a1a2e]">Session Expired</h2>
          <p className="text-gray-500 text-sm mt-2">
            Your result session has expired. Please re-enter your PIN to view the result again.
          </p>
          <button
            onClick={() => { sessionStorage.removeItem('result_student'); router.push('/'); }}
            className="mt-5 bg-[#4169E1] hover:bg-[#2c4fc9] text-white font-semibold px-6 py-2.5 rounded-md text-sm"
          >
            Re-enter PIN
          </button>
        </div>
      </div>
    );
  }

  if (!student) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F5]">
      {/* Navigation */}
      <nav className="bg-[#1a1a2e] text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#FFD700] flex items-center justify-center font-bold text-[#1a1a2e] text-sm flex-shrink-0">
              RC
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">Rehoboth College</p>
              <p className="text-xs text-[#FFD700] leading-tight">{student.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-[#FFD700] hover:bg-[#d4af00] text-[#1a1a2e] font-semibold px-4 py-2 rounded-md text-sm flex items-center gap-1.5"
            >
              🖨 <span className="hidden sm:inline">Print Result</span><span className="sm:hidden">Print</span>
            </button>
            <button
              onClick={() => { sessionStorage.removeItem('result_student'); router.push('/'); }}
              className="text-gray-300 hover:text-white text-xs px-3 py-2 border border-gray-600 rounded-md"
            >
              Exit
            </button>
          </div>
        </div>
      </nav>

      {/* Result info strip */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span className="text-gray-500">
            <span className="font-medium text-[#1a1a2e]">{student.term}</span>
          </span>
          <span className="text-gray-300 hidden sm:inline">|</span>
          <span className="text-gray-500">
            <span className="font-medium text-[#1a1a2e]">{student.session}</span>
          </span>
          <span className="text-gray-300 hidden sm:inline">|</span>
          <span className="text-gray-500">
            Admission: <span className="font-mono font-medium text-[#4169E1]">{student.admission_no}</span>
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
            Secure Session
          </span>
        </div>
      </div>

      {/* PDF Viewer — full height, blob URL bypasses all Chrome/mobile blocking */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4">
        <div
          className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm"
          onContextMenu={(e) => e.preventDefault()}
        >
          {pdfError ? (
            // Fallback if blob fetch fails — offer direct open
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <span className="text-5xl mb-4">📄</span>
              <h3 className="font-semibold text-[#1a1a2e] mb-2">Result Ready</h3>
              <p className="text-gray-500 text-sm mb-5 max-w-xs">
                Your result could not be displayed inline on this browser.
                Click below to open it directly.
              </p>
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#4169E1] hover:bg-[#2c4fc9] text-white font-semibold px-6 py-3 rounded-md text-sm"
              >
                Open Result PDF
              </a>
              <p className="text-xs text-gray-400 mt-3">Opens in a new tab — use your browser's print button to print</p>
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

        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-gray-400">Session auto-refreshes every 90 seconds.</p>
          <button
            onClick={handlePrint}
            className="bg-[#4169E1] hover:bg-[#2c4fc9] text-white font-semibold px-5 py-2 rounded-md text-sm flex items-center gap-2"
          >
            🖨 Print Result
          </button>
        </div>
      </main>

      <footer className="bg-[#1a1a2e] text-gray-400 text-xs text-center py-3 mt-2">
        <p>© {new Date().getFullYear()} Rehoboth College. Official Result Portal.</p>
      </footer>
    </div>
  );
}
