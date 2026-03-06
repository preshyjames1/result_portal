'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

const TERMS = ['First Term', 'Second Term', 'Third Term'];
const currentYear = new Date().getFullYear();
const SESSIONS = Array.from({ length: 5 }, (_, i) => {
  const year = currentYear - i;
  return `${year}/${year + 1}`;
});
const CLASSES = ['JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3'];

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Invalid admission number or PIN. Please check and try again.',
  PIN_INACTIVE: 'This PIN has been deactivated. Please contact the school.',
  PIN_LIMIT_EXCEEDED: 'This PIN has reached its maximum usage limit.',
  PIN_BELONGS_TO_ANOTHER_STUDENT: 'This PIN belongs to another student.',
  NO_RESULT_FOUND: 'No result found for the selected term and session.',
  RESULT_NOT_YET_PUBLISHED: 'Results for this term have not been published yet. Please check back later.',
  RATE_LIMITED: 'Too many attempts. Please wait a minute and try again.',
};

export default function HomePage() {
  const router = useRouter();
  const [form, setForm] = useState({ admission_no: '', pin_code: '', class: '', term: '', session: '' });
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
          admission_no: form.admission_no.trim().toUpperCase(),
          pin_code: form.pin_code.trim().toUpperCase(),
          term: form.term,
          session: form.session,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(ERROR_MESSAGES[data.error] ?? 'An error occurred. Please try again.');
        return;
      }
      sessionStorage.setItem('result_student', JSON.stringify({
        ...data.student,
        class: form.class || data.student.class,
        term: form.term,
        session: form.session,
        signed_url: data.signed_url,
        pin_usage_count: data.pin_usage_count,
        pin_usage_limit: data.pin_usage_limit,
      }));
      router.push('/result');
    } catch {
      setError('A network error occurred. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation — no Buy PIN button */}
      <nav className="bg-[#1a1a2e] text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Image src="/logo.png" alt="Rehoboth College" width={40} height={40}
            className="rounded-full bg-white p-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm leading-tight">Rehoboth College</p>
            <p className="text-xs text-[#FFD700] leading-tight">Official Result Portal</p>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-gradient-to-r from-[#1a1a2e] via-[#252545] to-[#1a1a2e] text-white py-6 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="font-garamond text-3xl md:text-4xl font-bold text-[#FFD700] mb-1">REHOBOTH COLLEGE</h1>
          <p className="text-sm text-gray-300 uppercase tracking-widest">Official Student Result Checking Portal</p>
          <p className="text-xs text-gray-500 italic mt-1">Motto: Godliness, Foundation for Excellence</p>
        </div>
      </div>

      {/* Main content — 2-column on desktop */}
      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

            {/* ── LEFT: Instructions panel ── */}
            <div className="lg:col-span-2 space-y-4">
              {/* How to check */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-[#4169E1] px-4 py-3">
                  <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                    📋 How to Check Your Result
                  </h3>
                </div>
                <ol className="px-4 py-4 space-y-3">
                  {[
                    { n: '1', title: 'Get your PIN', desc: 'Purchase a result-checking PIN from the school office or online via the link below.' },
                    { n: '2', title: 'Enter your details', desc: 'Fill in your Admission Number, Class, Term, and Academic Session on the form.' },
                    { n: '3', title: 'Enter your PIN', desc: 'Type your 16-character PIN. You can enter it with or without the dashes.' },
                    { n: '4', title: 'View your result', desc: 'Click "Check Result" to load your official result sheet.' },
                    { n: '5', title: 'Print if needed', desc: 'Use the Print button to print a clean copy of your result.' },
                  ].map((step) => (
                    <li key={step.n} className="flex gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#4169E1] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {step.n}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-[#1a1a2e]">{step.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{step.desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* PIN usage info */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-[#FFD700] px-4 py-3">
                  <h3 className="font-semibold text-[#1a1a2e] text-sm flex items-center gap-2">
                    🔑 About Your PIN
                  </h3>
                </div>
                <div className="px-4 py-4 space-y-3 text-sm text-gray-600">
                  <p className="flex gap-2"><span className="text-[#4169E1]">▸</span> Each PIN can be used <strong>5 times</strong> to view a result.</p>
                  <p className="flex gap-2"><span className="text-[#4169E1]">▸</span> A PIN is <strong>locked to the first student</strong> who uses it. Keep your PIN private.</p>
                  <p className="flex gap-2"><span className="text-[#4169E1]">▸</span> PINs are <strong>term-specific</strong> — a First Term PIN cannot be used for Second Term results.</p>
                  <p className="flex gap-2"><span className="text-[#4169E1]">▸</span> If your PIN is exhausted, you can purchase a new one.</p>
                </div>
              </div>

              {/* Buy PIN */}
              <div className="bg-[#1a1a2e] rounded-lg px-4 py-4 text-center">
                <p className="text-white text-sm font-semibold mb-1">Don&apos;t have a PIN yet?</p>
                <p className="text-gray-400 text-xs mb-3">Purchase online and receive it instantly by email</p>
                <Link href="/buy-pin"
                  className="inline-block bg-[#FFD700] hover:bg-[#d4af00] text-[#1a1a2e] font-bold px-5 py-2.5 rounded-md text-sm">
                  Buy a PIN — ₦500
                </Link>
              </div>
            </div>

            {/* ── RIGHT: Result checking form ── */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-[#4169E1] px-6 py-4">
                  <h2 className="font-garamond text-xl text-white font-semibold">Check Your Result</h2>
                  <p className="text-blue-100 text-xs mt-1">Fill in all fields accurately to access your result</p>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">⚠</span>
                      <p className="text-red-700 text-sm">{error}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Admission Number <span className="text-red-500">*</span>
                    </label>
                    <input type="text" name="admission_no" value={form.admission_no} onChange={handleChange}
                      placeholder="e.g. RC-2024-001"
                      className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
                      required autoComplete="off" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Class <span className="text-red-500">*</span>
                    </label>
                    <select name="class" value={form.class} onChange={handleChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
                      required>
                      <option value="">— Select Class —</option>
                      {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Term <span className="text-red-500">*</span>
                      </label>
                      <select name="term" value={form.term} onChange={handleChange}
                        className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
                        required>
                        <option value="">— Term —</option>
                        {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Session <span className="text-red-500">*</span>
                      </label>
                      <select name="session" value={form.session} onChange={handleChange}
                        className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
                        required>
                        <option value="">— Session —</option>
                        {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      PIN <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input type={showPin ? 'text' : 'password'} name="pin_code" value={form.pin_code}
                        onChange={handleChange}
                        placeholder="Enter 16-character PIN (dashes optional)"
                        className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm font-mono uppercase pr-16 focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
                        required autoComplete="off" />
                      <button type="button" onClick={() => setShowPin(!showPin)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-medium">
                        {showPin ? 'HIDE' : 'SHOW'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      You can enter your PIN as <span className="font-mono">ABCD1234EFGH5678</span> or <span className="font-mono">ABCD-1234-EFGH-5678</span>
                    </p>
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full bg-[#4169E1] hover:bg-[#2c4fc9] disabled:bg-[#a0aec0] text-white font-semibold py-3 rounded-md text-sm mt-1">
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Verifying...
                      </span>
                    ) : 'Check Result →'}
                  </button>

                  <p className="text-center text-sm text-gray-500 pt-1">
                    Don&apos;t have a PIN?{' '}
                    <Link href="/buy-pin" className="text-[#4169E1] hover:underline font-medium">Buy one here →</Link>
                  </p>
                </form>
              </div>
            </div>

          </div>
        </div>
      </main>

      <footer className="bg-[#1a1a2e] text-gray-400 text-xs text-center py-4 px-4 mt-4">
        <p className="font-garamond text-[#FFD700] text-sm mb-1">Rehoboth College</p>
        <p>Official Academic Result Portal</p>
        <p className="mt-1">© {new Date().getFullYear()} Rehoboth College. All rights reserved.</p>
      </footer>
    </div>
  );
}
