'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const TERMS = ['First Term', 'Second Term', 'Third Term'];
const currentYear = new Date().getFullYear();
const SESSIONS = Array.from({ length: 5 }, (_, i) => {
  const year = currentYear - i;
  return `${year}/${year + 1}`;
});

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Invalid admission number or PIN.',
  PIN_INACTIVE: 'This PIN has been deactivated. Please contact the school.',
  PIN_LIMIT_EXCEEDED: 'This PIN has reached its maximum usage limit.',
  PIN_BELONGS_TO_ANOTHER_STUDENT: 'This PIN belongs to another student.',
  NO_RESULT_FOUND: 'No result found for the selected term and session.',
  RESULT_NOT_YET_PUBLISHED:
    'Results for this term have not been published yet. Please check back later.',
  RATE_LIMITED: 'Too many requests. Please wait a minute and try again.',
};

export default function HomePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    admission_no: '',
    pin_code: '',
    term: '',
    session: '',
  });
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [studentName, setStudentName] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          admission_no: form.admission_no.trim().toUpperCase(),
          pin_code: form.pin_code.trim().toUpperCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(ERROR_MESSAGES[data.error] ?? 'An error occurred. Please try again.');
        return;
      }

      // Store student info in sessionStorage for result page display
      sessionStorage.setItem(
        'result_student',
        JSON.stringify({
          ...data.student,
          term: form.term,
          session: form.session,
          signed_url: data.signed_url,
        })
      );

      router.push('/result');
    } catch {
      setError('A network error occurred. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="bg-[#1a1a2e] text-white shadow-lg" role="navigation">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo placeholder */}
            <div className="w-10 h-10 rounded-full bg-[#FFD700] flex items-center justify-center font-bold text-[#1a1a2e] text-sm">
              RC
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">Rehoboth College</p>
              <p className="text-xs text-[#FFD700] leading-tight">Result Portal</p>
            </div>
          </div>
          <Link
            href="/buy-pin"
            className="bg-[#4169E1] hover:bg-[#2c4fc9] text-white text-sm font-medium px-4 py-2 rounded-md"
          >
            Buy PIN
          </Link>
        </div>
      </nav>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-[#1a1a2e] via-[#252545] to-[#1a1a2e] text-white py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="font-garamond text-3xl md:text-4xl font-bold text-[#FFD700] mb-2">
            REHOBOTH COLLEGE
          </h1>
          <p className="text-sm md:text-base text-gray-300 uppercase tracking-widest">
            Official Student Result Checking Portal
          </p>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
              Secure Portal
            </span>
            <span>|</span>
            <span>PIN-Protected Access</span>
            <span>|</span>
            <span>Official Results Only</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {/* Card header */}
            <div className="bg-[#4169E1] px-6 py-4">
              <h2 className="font-garamond text-xl text-white font-semibold">Check Your Result</h2>
              <p className="text-blue-100 text-xs mt-1">
                Enter your details below to access your academic result
              </p>
            </div>

            {/* Card body */}
            <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
              {/* Error message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 flex items-start gap-2">
                  <span className="text-red-500 text-base mt-0.5">⚠</span>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {/* Admission Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admission Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="admission_no"
                  value={form.admission_no}
                  onChange={handleChange}
                  placeholder="e.g. RC-2024-001"
                  className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm font-mono-custom uppercase focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent"
                  required
                  autoComplete="off"
                />
              </div>

              {/* PIN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PIN <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    name="pin_code"
                    value={form.pin_code}
                    onChange={handleChange}
                    placeholder="XXXX-XXXX-XXXX"
                    className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm font-mono-custom uppercase pr-10 focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent"
                    required
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                    aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                  >
                    {showPin ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>

              {/* Term */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Term <span className="text-red-500">*</span>
                </label>
                <select
                  name="term"
                  value={form.term}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent"
                  required
                >
                  <option value="">— Select Term —</option>
                  {TERMS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Session */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Academic Session <span className="text-red-500">*</span>
                </label>
                <select
                  name="session"
                  value={form.session}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent"
                  required
                >
                  <option value="">— Select Session —</option>
                  {SESSIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#4169E1] hover:bg-[#2c4fc9] disabled:bg-[#a0aec0] text-white font-semibold py-3 rounded-md text-sm mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verifying...
                  </span>
                ) : (
                  'Check Result'
                )}
              </button>

              <p className="text-center text-sm text-gray-500 pt-2">
                Don't have a PIN?{' '}
                <Link href="/buy-pin" className="text-[#4169E1] hover:underline font-medium">
                  Buy one here →
                </Link>
              </p>
            </form>
          </div>

          {/* Info cards */}
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[
              { icon: '🔒', title: 'Secure', text: 'PIN-protected access' },
              { icon: '📄', title: 'Official', text: 'Authenticated results' },
              { icon: '🖨️', title: 'Printable', text: 'A4 print support' },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="text-xl mb-1">{item.icon}</div>
                <p className="text-xs font-semibold text-gray-700">{item.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#1a1a2e] text-gray-400 text-xs text-center py-4 px-4">
        <p className="font-garamond text-[#FFD700] text-sm mb-1">Rehoboth College</p>
        <p>Official Academic Result Portal</p>
        <p className="mt-1">© {new Date().getFullYear()} Rehoboth College. All rights reserved.</p>
      </footer>
    </div>
  );
}
