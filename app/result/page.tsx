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
  const [pdfUrl, setPdfUrl] = useState('');
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const refreshUrl = useCallback(async () => {
    try {
      const res = await fetch('/api/get-pdf-url', { cache: 'no-store' });
      if (res.status === 401) {
        setExpired(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setPdfUrl(data.signed_url);
      }
    } catch {
      // Silently fail — will expire naturally
    }
  }, []);

  useEffect(() => {
    // Load from sessionStorage
    const stored = sessionStorage.getItem('result_student');

    if (!stored) {
      router.replace('/');
      return;
    }

    try {
      const data = JSON.parse(stored);
      setStudent(data);
      setPdfUrl(data.signed_url);
      setLoading(false);

      // Refresh signed URL every 90 seconds (before 120s expiry)
      refreshTimerRef.current = setInterval(refreshUrl, 90 * 1000);
    } catch {
      router.replace('/');
    }

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [router, refreshUrl]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="text-center">
          <svg className="animate-spin w-8 h-8 text-[#4169E1] mx-auto" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="mt-3 text-gray-500 text-sm">Loading result...</p>
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

  const printDate = new Date().toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      {/* Print stylesheet */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-header { display: block !important; }
          nav.site-header { display: none !important; }
          body { background: white; }
          .print-watermark::after {
            content: "OFFICIAL RESULT — NOT VALID WITHOUT SCHOOL STAMP AND SIGNATURE";
            display: block;
            text-align: center;
            font-size: 10px;
            color: #666;
            padding-top: 12px;
          }
          @page { size: A4; margin: 15mm; }
        }
      `}</style>

      <div className="min-h-screen flex flex-col bg-[#F5F5F5]">
        {/* Navigation */}
        <nav className="site-header bg-[#1a1a2e] text-white no-print">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FFD700] flex items-center justify-center font-bold text-[#1a1a2e] text-sm">
                RC
              </div>
              <div>
                <p className="font-semibold text-sm">Rehoboth College</p>
                <p className="text-xs text-[#FFD700]">Official Result Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="bg-[#FFD700] hover:bg-[#d4af00] text-[#1a1a2e] font-semibold px-4 py-2 rounded-md text-sm flex items-center gap-1"
              >
                🖨 Print Result
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

        {/* Print header (only visible during print) */}
        <div className="print-header hidden">
          <div style={{ textAlign: 'center', borderBottom: '2px solid #4169E1', paddingBottom: '12px', marginBottom: '12px' }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', color: '#1a1a2e' }}>REHOBOTH COLLEGE</h1>
            <p style={{ fontSize: '11px', color: '#666' }}>OFFICIAL ACADEMIC RESULT</p>
          </div>
        </div>

        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
          {/* Official header banner */}
          <div className="bg-[#1a1a2e] text-white rounded-t-lg px-6 py-4 text-center">
            <h1 className="font-garamond text-2xl font-bold text-[#FFD700] tracking-wide">
              REHOBOTH COLLEGE
            </h1>
            <p className="text-xs uppercase tracking-widest text-gray-300 mt-1">
              OFFICIAL RESULT PORTAL
            </p>
          </div>

          {/* Student Info Panel */}
          <div className="bg-white border border-gray-200 px-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'STUDENT NAME', value: student.full_name },
                { label: 'ADMISSION NUMBER', value: student.admission_no },
                { label: 'CLASS', value: student.class },
                { label: 'TERM', value: student.term },
                { label: 'SESSION', value: student.session },
                { label: 'DATE PRINTED', value: printDate },
              ].map((item) => (
                <div key={item.label} className="border-b border-gray-100 pb-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">{item.label}</p>
                  <p className="font-garamond text-base font-semibold text-[#1a1a2e] mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* PDF Viewer */}
          <div
            className="bg-white border border-gray-200 border-t-0 rounded-b-lg overflow-hidden pdf-viewer"
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between no-print">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Result Document
              </span>
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                Secure View
              </span>
            </div>

            {pdfUrl ? (
              <iframe
                src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                className="w-full border-none"
                style={{ height: '80vh', minHeight: '600px' }}
                title="Result PDF"
                sandbox="allow-same-origin allow-scripts"
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400">
                <p className="text-sm">Loading result document...</p>
              </div>
            )}
          </div>

          {/* Print watermark area */}
          <div className="print-watermark hidden" />

          {/* Actions */}
          <div className="mt-4 flex items-center justify-between no-print">
            <p className="text-xs text-gray-400">
              Result session active. Auto-refreshes every 90 seconds.
            </p>
            <button
              onClick={handlePrint}
              className="bg-[#4169E1] hover:bg-[#2c4fc9] text-white font-semibold px-5 py-2.5 rounded-md text-sm flex items-center gap-2"
            >
              🖨 Print Result
            </button>
          </div>
        </main>

        <footer className="bg-[#1a1a2e] text-gray-400 text-xs text-center py-3 no-print">
          <p>© {new Date().getFullYear()} Rehoboth College. Official Result Portal.</p>
        </footer>
      </div>
    </>
  );
}
