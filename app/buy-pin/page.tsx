'use client';

import { useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';

declare global {
  interface Window {
    PaystackPop: {
      setup: (options: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

const TERMS = ['First Term', 'Second Term', 'Third Term'];
const currentYear = new Date().getFullYear();
const SESSIONS = Array.from({ length: 5 }, (_, i) => {
  const year = currentYear - i;
  return `${year}/${year + 1}`;
});

const PIN_PRICE = parseInt(process.env.NEXT_PUBLIC_PIN_PRICE_KOBO ?? '50000', 10) / 100;

export default function BuyPinPage() {
  const [form, setForm] = useState({
    full_name: '',
    admission_no: '',
    email: '',
    phone: '',
    term: '',
    session: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          admission_no: form.admission_no.trim().toUpperCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to initialize payment. Please try again.');
        return;
      }

      // Open Paystack popup
      const handler = window.PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
        email: form.email,
        amount: PIN_PRICE * 100, // kobo
        ref: data.reference,
        metadata: {
          admission_no: form.admission_no.trim().toUpperCase(),
          full_name: form.full_name,
          term: form.term,
          session: form.session,
          phone: form.phone,
        },
        onClose: () => {
          setLoading(false);
          setError('Payment window closed. Please try again.');
        },
        callback: (response: { reference: string }) => {
          // Redirect to callback page
          window.location.href = `/payment/callback?reference=${response.reference}`;
        },
      });

      handler.openIframe();
    } catch {
      setError('A network error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <>
      <Script src="https://js.paystack.co/v1/inline.js" strategy="lazyOnload" />

      <div className="min-h-screen flex flex-col">
        {/* Nav */}
        <nav className="bg-[#1a1a2e] text-white shadow-lg">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FFD700] flex items-center justify-center font-bold text-[#1a1a2e] text-sm">
                RC
              </div>
              <div>
                <p className="font-semibold text-sm leading-tight">Rehoboth College</p>
                <p className="text-xs text-[#FFD700] leading-tight">Result Portal</p>
              </div>
            </div>
            <Link href="/" className="text-blue-300 hover:text-white text-sm">
              ← Check Result
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <div className="bg-gradient-to-r from-[#1a1a2e] via-[#252545] to-[#1a1a2e] text-white py-6 px-4 text-center">
          <h1 className="font-garamond text-2xl font-bold text-[#FFD700]">Purchase Result PIN</h1>
          <p className="text-gray-300 text-sm mt-1">
            Securely pay for and receive your result-checking PIN via email
          </p>
        </div>

        {/* Content */}
        <main className="flex-1 px-4 py-10">
          <div className="max-w-5xl mx-auto grid md:grid-cols-[1fr_360px] gap-8">
            {/* Info panel */}
            <div className="space-y-6">
              {/* How it works */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="font-garamond text-xl font-semibold text-[#1a1a2e] mb-4">
                  How It Works
                </h2>
                <ol className="space-y-4">
                  {[
                    { step: '1', title: 'Fill the form', desc: 'Enter your details and select your term/session' },
                    { step: '2', title: 'Make payment', desc: `Pay ₦${PIN_PRICE.toLocaleString()} securely via Paystack` },
                    { step: '3', title: 'Receive your PIN', desc: 'Your PIN is instantly sent to your email' },
                    { step: '4', title: 'Check your result', desc: 'Use the PIN on the result-check page' },
                  ].map((item) => (
                    <li key={item.step} className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-full bg-[#4169E1] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {item.step}
                      </span>
                      <div>
                        <p className="font-semibold text-sm text-gray-800">{item.title}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{item.desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* PIN details */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                <h3 className="font-semibold text-[#1a1a2e] text-sm mb-3">PIN Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between border-b border-blue-100 pb-2">
                    <span className="text-gray-600">PIN Price</span>
                    <span className="font-semibold text-[#4169E1]">₦{PIN_PRICE.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-blue-100 pb-2">
                    <span className="text-gray-600">Usage Limit</span>
                    <span className="font-semibold">5 times</span>
                  </div>
                  <div className="flex justify-between border-b border-blue-100 pb-2">
                    <span className="text-gray-600">Student Lock</span>
                    <span className="font-semibold">After first use</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Delivery</span>
                    <span className="font-semibold">Instant via Email</span>
                  </div>
                </div>
              </div>

              {/* Security note */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
                <span className="text-green-600 text-lg">🔒</span>
                <div className="text-sm text-green-800">
                  <p className="font-semibold">Secure Payment</p>
                  <p className="mt-0.5 text-green-700">
                    All payments are processed securely by Paystack. Your card details are never stored.
                  </p>
                </div>
              </div>
            </div>

            {/* Purchase form */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden h-fit">
              <div className="bg-[#4169E1] px-6 py-4">
                <h2 className="font-garamond text-xl text-white font-semibold">Purchase Form</h2>
                <p className="text-blue-100 text-xs mt-1">All fields are required</p>
              </div>

              <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3">
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-md px-4 py-3">
                    <p className="text-green-700 text-sm font-medium">{success}</p>
                  </div>
                )}

                {[
                  { name: 'full_name', label: 'Full Name', placeholder: 'As on school records', type: 'text' },
                  { name: 'admission_no', label: 'Admission Number', placeholder: 'RC-2024-001', type: 'text' },
                  { name: 'email', label: 'Email Address', placeholder: 'PIN will be sent here', type: 'email' },
                  { name: 'phone', label: 'Phone Number', placeholder: '08012345678', type: 'tel' },
                ].map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type={field.type}
                      name={field.name}
                      value={form[field.name as keyof typeof form]}
                      onChange={handleChange}
                      placeholder={field.placeholder}
                      className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
                      required
                    />
                  </div>
                ))}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Term <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="term"
                    value={form.term}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
                    required
                  >
                    <option value="">— Select Term —</option>
                    {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Academic Session <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="session"
                    value={form.session}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
                    required
                  >
                    <option value="">— Select Session —</option>
                    {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="bg-gray-50 rounded-md p-3 flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Amount</span>
                  <span className="text-lg font-bold text-[#4169E1]">₦{PIN_PRICE.toLocaleString()}</span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#4169E1] hover:bg-[#2c4fc9] disabled:bg-gray-400 text-white font-semibold py-3 rounded-md text-sm"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'Proceed to Payment →'
                  )}
                </button>
              </form>
            </div>
          </div>
        </main>

        <footer className="bg-[#1a1a2e] text-gray-400 text-xs text-center py-4">
          <p>© {new Date().getFullYear()} Rehoboth College. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
}
