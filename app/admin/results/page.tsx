'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const TERMS = ['First Term', 'Second Term', 'Third Term'];
const currentYear = new Date().getFullYear();
const SESSIONS = Array.from({ length: 5 }, (_, i) => {
  const year = currentYear - i;
  return `${year}/${year + 1}`;
});

interface Result {
  id: string;
  term: string;
  session: string;
  is_published: boolean;
  publish_at: string | null;
  published_at: string | null;
  created_at: string;
  students: { admission_no: string; full_name: string; class: string } | null;
}

interface BulkReport {
  total: number;
  uploaded: number;
  failed: number;
  failures: { filename: string; reason: string }[];
}

interface StudentOption {
  id: string;
  admission_no: string;
  full_name: string;
  class: string;
}

function StatusBadge({ result }: { result: Result }) {
  if (result.is_published)
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">✅ Published</span>;
  if (result.publish_at)
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">📅 Scheduled</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">⏳ Draft</span>;
}

export default function AdminResultsPage() {
  const [tab, setTab] = useState<'list' | 'single' | 'bulk'>('list');
  const [results, setResults] = useState<Result[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Single upload
  const [studentSearch, setStudentSearch] = useState('');
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [singleForm, setSingleForm] = useState({ term: '', session: '', publish_mode: 'unpublished', publish_at: '' });
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleMsg, setSingleMsg] = useState('');

  // Bulk upload
  const [bulkForm, setBulkForm] = useState({ term: '', session: '', publish_mode: 'unpublished', publish_at: '' });
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkReport, setBulkReport] = useState<BulkReport | null>(null);

  // Reupload modal
  const [reuploadTarget, setReuploadTarget] = useState<Result | null>(null);
  const [reuploadFile, setReuploadFile] = useState<File | null>(null);
  const [reuploadLoading, setReuploadLoading] = useState(false);
  const [reuploadMsg, setReuploadMsg] = useState('');
  const reuploadInputRef = useRef<HTMLInputElement>(null);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/results?limit=100');
      const data = await res.json();
      setResults(data.results ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const searchStudents = async (q: string) => {
    if (q.length < 2) { setStudentOptions([]); return; }
    const res = await fetch(`/api/admin/students?search=${encodeURIComponent(q)}&limit=10`);
    const data = await res.json();
    setStudentOptions(data.students ?? []);
  };

  const handleSingleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !singleFile) return;
    setSingleLoading(true); setSingleMsg('');
    const fd = new FormData();
    fd.append('pdf', singleFile);
    fd.append('student_id', selectedStudent.id);
    fd.append('term', singleForm.term);
    fd.append('session', singleForm.session);
    fd.append('publish_mode', singleForm.publish_mode);
    if (singleForm.publish_at) fd.append('publish_at', singleForm.publish_at);
    try {
      const res = await fetch('/api/admin/results', { method: 'POST', body: fd });
      if (res.ok) {
        setSingleMsg('✅ Result uploaded successfully!');
        setSelectedStudent(null); setStudentSearch(''); setSingleFile(null);
        setSingleForm({ term: '', session: '', publish_mode: 'unpublished', publish_at: '' });
        fetchResults();
      } else {
        const d = await res.json();
        setSingleMsg(`❌ Error: ${d.error}`);
      }
    } catch { setSingleMsg('❌ Network error'); }
    finally { setSingleLoading(false); }
  };

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkFile) return;
    setBulkLoading(true); setBulkReport(null);
    const fd = new FormData();
    fd.append('zip_file', bulkFile);
    fd.append('term', bulkForm.term);
    fd.append('session', bulkForm.session);
    fd.append('publish_mode', bulkForm.publish_mode);
    if (bulkForm.publish_at) fd.append('publish_at', bulkForm.publish_at);
    try {
      const res = await fetch('/api/admin/results', { method: 'POST', body: fd });
      const data = await res.json();
      setBulkReport(data);
      if (res.ok) fetchResults();
    } catch {
      setBulkReport({ total: 0, uploaded: 0, failed: 1, failures: [{ filename: 'unknown', reason: 'Network error' }] });
    } finally { setBulkLoading(false); }
  };

  const handleAction = async (id: string, action: string, publish_at?: string) => {
    await fetch('/api/admin/results', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, publish_at }),
    });
    fetchResults();
  };

  const handleBulkAction = async (action: string) => {
    if (!selectedIds.size) return;
    await fetch('/api/admin/results', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds), action }),
    });
    setSelectedIds(new Set()); fetchResults();
  };

  const handleDelete = async (id: string, studentName: string) => {
    if (!confirm(`Delete result for ${studentName}? This will permanently remove the PDF from storage.`)) return;
    const res = await fetch(`/api/admin/results?id=${id}`, { method: 'DELETE' });
    if (res.ok) fetchResults();
    else alert('Failed to delete result. Please try again.');
  };

  const handleReupload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reuploadTarget || !reuploadFile) return;
    setReuploadLoading(true); setReuploadMsg('');
    const fd = new FormData();
    fd.append('pdf', reuploadFile);
    fd.append('student_id', reuploadTarget.students ? (reuploadTarget as unknown as { student_id: string }).student_id : '');
    // We need student_id — fetch it from the result record
    // Since we store student relation, we'll pass result_id and handle server-side
    // Actually, let's pass what we know and use the existing POST (upsert) logic
    fd.append('result_id', reuploadTarget.id);
    fd.append('term', reuploadTarget.term);
    fd.append('session', reuploadTarget.session);
    fd.append('publish_mode', reuploadTarget.is_published ? 'now' : 'unpublished');

    try {
      const res = await fetch('/api/admin/results/reupload', { method: 'POST', body: fd });
      if (res.ok) {
        setReuploadMsg('✅ Result replaced successfully!');
        setTimeout(() => { setReuploadTarget(null); setReuploadMsg(''); setReuploadFile(null); fetchResults(); }, 1500);
      } else {
        const d = await res.json();
        setReuploadMsg(`❌ ${d.error}`);
      }
    } catch { setReuploadMsg('❌ Network error'); }
    finally { setReuploadLoading(false); }
  };

  const PublishFields = ({ form, setForm }: { form: typeof singleForm; setForm: (f: typeof singleForm) => void }) => (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Publish Mode</label>
        <select value={form.publish_mode} onChange={(e) => setForm({ ...form, publish_mode: e.target.value })}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1]">
          <option value="unpublished">Unpublished (draft)</option>
          <option value="now">Publish Now</option>
          <option value="scheduled">Schedule</option>
        </select>
      </div>
      {form.publish_mode === 'scheduled' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Publish At *</label>
          <input type="datetime-local" value={form.publish_at}
            onChange={(e) => setForm({ ...form, publish_at: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4169E1]" required />
        </div>
      )}
    </>
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-garamond text-2xl font-bold text-[#1a1a2e]">Results Management</h1>
        <p className="text-gray-500 text-sm mt-1">Upload, replace, and manage student result PDFs</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {[{ key: 'list', label: `All Results (${total})` }, { key: 'single', label: 'Upload Single' }, { key: 'bulk', label: 'Bulk ZIP Upload' }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-[#1a1a2e] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Single Upload ── */}
      {tab === 'single' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-w-lg">
          <div className="bg-[#4169E1] px-5 py-4">
            <h2 className="font-semibold text-white">Upload Single Result</h2>
            <p className="text-blue-100 text-xs mt-0.5">If a result already exists for this student/term/session, it will be replaced.</p>
          </div>
          <form onSubmit={handleSingleUpload} className="px-5 py-5 space-y-4">
            {singleMsg && (
              <div className={`p-3 rounded-md text-sm ${singleMsg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {singleMsg}
              </div>
            )}
            {/* Student search */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
              {selectedStudent ? (
                <div className="flex items-center gap-2 border border-gray-300 rounded-md px-3 py-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{selectedStudent.full_name}</p>
                    <p className="text-xs text-gray-500">{selectedStudent.admission_no} — {selectedStudent.class}</p>
                  </div>
                  <button type="button" onClick={() => { setSelectedStudent(null); setStudentSearch(''); }}
                    className="text-gray-400 hover:text-red-500 text-xs font-medium">Clear</button>
                </div>
              ) : (
                <>
                  <input type="text" value={studentSearch}
                    onChange={(e) => { setStudentSearch(e.target.value); searchStudents(e.target.value); }}
                    placeholder="Search student by name or admission no..."
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4169E1]" />
                  {studentOptions.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-44 overflow-y-auto">
                      {studentOptions.map((s) => (
                        <button key={s.id} type="button"
                          onClick={() => { setSelectedStudent(s); setStudentSearch(''); setStudentOptions([]); }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0">
                          <p className="font-medium">{s.full_name}</p>
                          <p className="text-xs text-gray-500">{s.admission_no} — {s.class}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Term *</label>
                <select value={singleForm.term} onChange={(e) => setSingleForm({ ...singleForm, term: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1]" required>
                  <option value="">— Term —</option>
                  {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Session *</label>
                <select value={singleForm.session} onChange={(e) => setSingleForm({ ...singleForm, session: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1]" required>
                  <option value="">— Session —</option>
                  {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Result PDF *</label>
              <input type="file" accept="application/pdf"
                onChange={(e) => setSingleFile(e.target.files?.[0] ?? null)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm file:mr-3 file:py-1 file:px-3 file:border-0 file:rounded file:bg-blue-50 file:text-blue-700 file:text-xs" required />
            </div>
            <PublishFields form={singleForm} setForm={setSingleForm} />
            <button type="submit" disabled={singleLoading || !selectedStudent}
              className="w-full bg-[#4169E1] hover:bg-[#2c4fc9] disabled:bg-gray-400 text-white font-semibold py-2.5 rounded-md text-sm">
              {singleLoading ? 'Uploading...' : 'Upload Result'}
            </button>
          </form>
        </div>
      )}

      {/* ── Bulk Upload ── */}
      {tab === 'bulk' && (
        <div className="max-w-lg space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-[#4169E1] px-5 py-4">
              <h2 className="font-semibold text-white">Bulk Upload (ZIP)</h2>
              <p className="text-blue-100 text-xs mt-0.5">Existing results for matched students will be replaced.</p>
            </div>
            <form onSubmit={handleBulkUpload} className="px-5 py-5 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
                <p className="font-semibold mb-1">ZIP structure:</p>
                <code className="text-xs block bg-white px-2 py-1 rounded border border-blue-100">
                  results.zip<br />
                  ├── RC-2024-001.pdf<br />
                  └── RC-2024-002.pdf
                </code>
                <p className="text-xs text-blue-600 mt-1">Each PDF named with the student's admission number</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Term *</label>
                  <select value={bulkForm.term} onChange={(e) => setBulkForm({ ...bulkForm, term: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1]" required>
                    <option value="">— Term —</option>
                    {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Session *</label>
                  <select value={bulkForm.session} onChange={(e) => setBulkForm({ ...bulkForm, session: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4169E1]" required>
                    <option value="">— Session —</option>
                    {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP File *</label>
                <input type="file" accept=".zip"
                  onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm file:mr-3 file:py-1 file:px-3 file:border-0 file:rounded file:bg-blue-50 file:text-blue-700 file:text-xs" required />
              </div>
              <PublishFields form={bulkForm} setForm={setBulkForm} />
              <button type="submit" disabled={bulkLoading || !bulkFile}
                className="w-full bg-[#4169E1] hover:bg-[#2c4fc9] disabled:bg-gray-400 text-white font-semibold py-2.5 rounded-md text-sm">
                {bulkLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Uploading...
                  </span>
                ) : 'Upload ZIP'}
              </button>
            </form>
          </div>
          {bulkReport && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="font-semibold text-[#1a1a2e] mb-3">Upload Report</h3>
              <div className="border border-gray-200 rounded-md overflow-hidden text-sm">
                <div className="px-4 py-2.5 flex justify-between border-b border-gray-100">
                  <span className="text-gray-600">Total files</span><span className="font-bold">{bulkReport.total}</span>
                </div>
                <div className="px-4 py-2.5 flex justify-between border-b border-gray-100 bg-green-50">
                  <span className="text-green-700">✅ Uploaded</span><span className="font-bold text-green-700">{bulkReport.uploaded}</span>
                </div>
                <div className={`px-4 py-2.5 flex justify-between ${bulkReport.failed > 0 ? 'bg-red-50' : ''}`}>
                  <span className={bulkReport.failed > 0 ? 'text-red-600' : 'text-gray-400'}>❌ Failed</span>
                  <span className={`font-bold ${bulkReport.failed > 0 ? 'text-red-600' : 'text-gray-400'}`}>{bulkReport.failed}</span>
                </div>
              </div>
              {bulkReport.failures.length > 0 && (
                <div className="mt-3 space-y-1">
                  {bulkReport.failures.map((f, i) => (
                    <p key={i} className="text-xs text-red-500"><span className="font-mono font-medium">{f.filename}</span> → {f.reason}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Results List ── */}
      {tab === 'list' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {selectedIds.size > 0 && (
            <div className="bg-blue-50 border-b border-blue-200 px-5 py-3 flex items-center gap-3 flex-wrap">
              <span className="text-sm text-blue-700 font-medium">{selectedIds.size} selected</span>
              <button onClick={() => handleBulkAction('publish')}
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-md">Publish All</button>
              <button onClick={() => handleBulkAction('unpublish')}
                className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-medium px-3 py-1.5 rounded-md">Unpublish All</button>
              <button onClick={() => setSelectedIds(new Set())} className="text-gray-500 text-xs hover:text-gray-700 ml-auto">Clear</button>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin w-6 h-6 text-[#4169E1]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📄</p>
              <p className="text-sm">No results uploaded yet</p>
              <button onClick={() => setTab('single')} className="mt-3 text-[#4169E1] text-sm hover:underline">Upload a result →</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 w-8">
                      <input type="checkbox" className="rounded"
                        checked={selectedIds.size === results.length && results.length > 0}
                        onChange={(e) => setSelectedIds(e.target.checked ? new Set(results.map((r) => r.id)) : new Set())} />
                    </th>
                    {['Student', 'Admission No', 'Class', 'Term', 'Session', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input type="checkbox" className="rounded"
                          checked={selectedIds.has(r.id)}
                          onChange={() => {
                            const n = new Set(selectedIds);
                            n.has(r.id) ? n.delete(r.id) : n.add(r.id);
                            setSelectedIds(n);
                          }} />
                      </td>
                      <td className="px-4 py-3 font-medium text-[#1a1a2e]">{r.students?.full_name ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[#4169E1]">{r.students?.admission_no ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{r.students?.class ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{r.term}</td>
                      <td className="px-4 py-3 text-gray-600">{r.session}</td>
                      <td className="px-4 py-3"><StatusBadge result={r} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
                          {!r.is_published && (
                            <button onClick={() => handleAction(r.id, 'publish')} className="text-green-600 hover:underline">Publish</button>
                          )}
                          {r.is_published && (
                            <button onClick={() => handleAction(r.id, 'unpublish')} className="text-yellow-600 hover:underline">Unpublish</button>
                          )}
                          {!r.is_published && !r.publish_at && (
                            <button onClick={() => {
                              const dt = prompt('Schedule (YYYY-MM-DDTHH:MM):');
                              if (dt) handleAction(r.id, 'schedule', dt);
                            }} className="text-blue-500 hover:underline">Schedule</button>
                          )}
                          {/* Reupload button */}
                          <button
                            onClick={() => { setReuploadTarget(r); setReuploadFile(null); setReuploadMsg(''); }}
                            className="text-purple-600 hover:underline"
                          >
                            Replace PDF
                          </button>
                          {/* Delete button */}
                          <button
                            onClick={() => handleDelete(r.id, r.students?.full_name ?? 'this student')}
                            className="text-red-500 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Reupload Modal ── */}
      {reuploadTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-purple-600 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-white text-sm">Replace Result PDF</h2>
                <p className="text-purple-200 text-xs mt-0.5">
                  {reuploadTarget.students?.full_name} — {reuploadTarget.term} {reuploadTarget.session}
                </p>
              </div>
              <button onClick={() => setReuploadTarget(null)} className="text-purple-200 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleReupload} className="px-5 py-5 space-y-4">
              {reuploadMsg && (
                <div className={`p-3 rounded-md text-sm ${reuploadMsg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {reuploadMsg}
                </div>
              )}
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800">
                ⚠️ This will permanently replace the existing PDF. The publish state will be preserved.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New PDF File *</label>
                <input
                  ref={reuploadInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setReuploadFile(e.target.files?.[0] ?? null)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm file:mr-3 file:py-1 file:px-3 file:border-0 file:rounded file:bg-purple-50 file:text-purple-700 file:text-xs"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={reuploadLoading || !reuploadFile}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-2.5 rounded-md text-sm"
                >
                  {reuploadLoading ? 'Replacing...' : 'Replace PDF'}
                </button>
                <button type="button" onClick={() => setReuploadTarget(null)}
                  className="border border-gray-300 text-gray-700 font-medium px-4 py-2 rounded-md text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
