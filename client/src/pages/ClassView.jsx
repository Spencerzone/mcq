import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api, studentDisplayName } from '../api.js';
import StudentImport from '../components/StudentImport.jsx';
import StudentProfile from '../components/StudentProfile.jsx';
import TestAnalysis from '../components/TestAnalysis.jsx';
import ExportButton, { exportClassAllTests } from '../components/ExportButton.jsx';

export default function ClassView() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [cls, setCls] = useState(null);
  const [students, setStudents] = useState([]);
  const [tests, setTests] = useState([]);
  const [tab, setTab] = useState('students');
  const [showImport, setShowImport] = useState(false);
  const [profileStudent, setProfileStudent] = useState(null);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newStudentRef, setNewStudentRef] = useState('');
  const [newTestName, setNewTestName] = useState('');
  const [newTestQ, setNewTestQ] = useState(10);
  const [editingTestId, setEditingTestId] = useState(null);
  const [editingTestName, setEditingTestName] = useState('');
  const [analysisTest, setAnalysisTest] = useState(null);
  const [sort, setSort] = useState({ col: 'last_name', dir: 'asc' });
  const editInputRef = useRef();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [classId]);

  async function load() {
    try {
      const [found, studs, tsts] = await Promise.all([
        api.getClass(classId),
        api.getStudents(classId),
        api.getTests(classId)
      ]);
      if (!found) { navigate('/'); return; }
      setCls(found);
      setStudents(studs);
      setTests(tsts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Sorted students
  function sortValue(s, col) {
    if (col === 'first_name') return (s.first_name || s.name || '').toLowerCase();
    if (col === 'last_name') return (s.last_name || '').toLowerCase();
    if (col === 'student_ref') return (s.student_ref || '').toLowerCase();
    return '';
  }
  const sortedStudents = [...students].sort((a, b) => {
    const av = sortValue(a, sort.col), bv = sortValue(b, sort.col);
    return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  function toggleSort(col) {
    setSort(prev => prev.col === col
      ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: 'asc' });
  }

  function SortIcon({ col }) {
    if (sort.col !== col) return <span style={{ color: '#d1d5db', marginLeft: 4 }}>↕</span>;
    return <span style={{ color: '#4f46e5', marginLeft: 4 }}>{sort.dir === 'asc' ? '↑' : '↓'}</span>;
  }

  async function addStudent(e) {
    e.preventDefault();
    if (!newFirstName.trim() && !newLastName.trim()) return;
    try {
      const s = await api.createStudent(classId, newFirstName.trim(), newLastName.trim(), newStudentRef.trim());
      setStudents(prev => [...prev, s]);
      setNewFirstName('');
      setNewLastName('');
      setNewStudentRef('');
    } catch (err) { setError(err.message); }
  }

  async function deleteStudent(id) {
    if (!confirm('Remove this student?')) return;
    try {
      await api.deleteStudent(classId, id);
      setStudents(prev => prev.filter(s => s.id !== id));
    } catch (err) { setError(err.message); }
  }

  async function handleImport(importedStudents) {
    try {
      const created = await api.importStudents(classId, importedStudents);
      setStudents(prev => [...prev, ...created]);
      setShowImport(false);
    } catch (err) { setError(err.message); }
  }

  function handleProfileSave(updated) {
    setStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
    setProfileStudent(null);
  }

  async function createTest(e) {
    e.preventDefault();
    if (!newTestName.trim() || !newTestQ) return;
    try {
      const t = await api.createTest(classId, newTestName.trim(), Number(newTestQ));
      setTests(prev => [...prev, t]);
      setNewTestName('');
      setNewTestQ(10);
    } catch (err) { setError(err.message); }
  }

  async function deleteTest(id) {
    if (!confirm('Delete this test and all its marks?')) return;
    try {
      await api.deleteTest(id);
      setTests(prev => prev.filter(t => t.id !== id));
    } catch (err) { setError(err.message); }
  }

  function startEditTest(t) {
    setEditingTestId(t.id);
    setEditingTestName(t.name);
    setTimeout(() => editInputRef.current?.focus(), 0);
  }

  async function saveTestName(id) {
    const name = editingTestName.trim();
    if (!name) { setEditingTestId(null); return; }
    try {
      await api.updateTest(id, { name });
      setTests(prev => prev.map(t => t.id === id ? { ...t, name } : t));
    } catch (err) { setError(err.message); }
    setEditingTestId(null);
  }

  if (loading) return <div className="page"><p>Loading…</p></div>;

  return (
    <div className="page container">
      {showImport && <StudentImport onImport={handleImport} onClose={() => setShowImport(false)} />}
      {profileStudent && (
        <StudentProfile
          student={profileStudent}
          classId={classId}
          className={cls?.name}
          onSave={handleProfileSave}
          onClose={() => setProfileStudent(null)}
        />
      )}
      {analysisTest && (
        <TestAnalysis test={analysisTest} onClose={() => setAnalysisTest(null)} />
      )}

      <div className="breadcrumb"><Link to="/">My Classes</Link> / {cls?.name}</div>
      <div className="page-header">
        <h1>{cls?.name}</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="tabs">
        <div className={`tab ${tab === 'students' ? 'active' : ''}`} onClick={() => setTab('students')}>
          Students ({students.length})
        </div>
        <div className={`tab ${tab === 'tests' ? 'active' : ''}`} onClick={() => setTab('tests')}>
          Tests ({tests.length})
        </div>
      </div>

      {tab === 'students' && (
        <div>
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <strong style={{ fontSize: '0.9rem' }}>Add student</strong>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>↑ Import students</button>
            </div>
            <form onSubmit={addStudent} className="flex gap-1">
              <input
                style={{ flex: 1.2, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6 }}
                placeholder="First name"
                value={newFirstName}
                onChange={e => setNewFirstName(e.target.value)}
              />
              <input
                style={{ flex: 1.2, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6 }}
                placeholder="Last name"
                value={newLastName}
                onChange={e => setNewLastName(e.target.value)}
              />
              <input
                style={{ flex: 0.8, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6 }}
                placeholder="ID (optional)"
                value={newStudentRef}
                onChange={e => setNewStudentRef(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">Add</button>
            </form>
          </div>

          {students.length === 0 ? (
            <div className="empty">
              <div style={{ fontSize: '2rem' }}>👤</div>
              <p>No students yet. Add them above or import from a list.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('first_name')}>
                      First name <SortIcon col="first_name" />
                    </th>
                    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('last_name')}>
                      Last name <SortIcon col="last_name" />
                    </th>
                    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('student_ref')}>
                      Student ID <SortIcon col="student_ref" />
                    </th>
                    <th style={{ width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((s, i) => (
                    <tr key={s.id}>
                      <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                      <td>
                        <button
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#4f46e5', fontWeight: 500 }}
                          onClick={() => setProfileStudent(s)}
                        >
                          {s.first_name || s.name || '—'}
                        </button>
                      </td>
                      <td>
                        <button
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#4f46e5', fontWeight: 500 }}
                          onClick={() => setProfileStudent(s)}
                        >
                          {s.last_name || '—'}
                        </button>
                      </td>
                      <td style={{ color: '#6b7280' }}>{s.student_ref || '—'}</td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteStudent(s.id)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'tests' && (
        <div>
          <div className="card">
            <strong style={{ fontSize: '0.9rem', display: 'block', marginBottom: '0.75rem' }}>Create test</strong>
            <form onSubmit={createTest} className="flex gap-1 items-center">
              <input
                style={{ flex: 2, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6 }}
                placeholder="Test name (e.g. Chapter 3 Quiz)"
                value={newTestName}
                onChange={e => setNewTestName(e.target.value)}
              />
              <input
                type="number" min={1} max={200}
                style={{ flex: 0.5, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6 }}
                placeholder="Questions"
                value={newTestQ}
                onChange={e => setNewTestQ(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">Create</button>
            </form>
          </div>

          {tests.length === 0 ? (
            <div className="empty">
              <div style={{ fontSize: '2rem' }}>📝</div>
              <p>No tests yet. Create one above.</p>
            </div>
          ) : (
            <div>
              <div className="flex" style={{ justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                <ExportButton
                  label="Export all test results"
                  onClick={() => exportClassAllTests(classId, cls?.name)}
                />
              </div>
              {tests.map(t => (
                <div key={t.id} className="card flex items-center justify-between">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {editingTestId === t.id ? (
                      <input
                        ref={editInputRef}
                        value={editingTestName}
                        onChange={e => setEditingTestName(e.target.value)}
                        onBlur={() => saveTestName(t.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveTestName(t.id);
                          if (e.key === 'Escape') setEditingTestId(null);
                        }}
                        style={{ fontWeight: 600, fontSize: '1rem', width: '100%', padding: '0.15rem 0.4rem', border: '1px solid #4f46e5', borderRadius: 4 }}
                      />
                    ) : (
                      <div
                        style={{ fontWeight: 600, cursor: 'text', display: 'inline-block' }}
                        onClick={() => startEditTest(t)}
                        title="Click to rename"
                      >
                        {t.name} <span style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: 400 }}>✎</span>
                      </div>
                    )}
                    <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: '0.15rem' }}>
                      {t.num_questions} questions &nbsp;·&nbsp;
                      {t.answer_key.filter(Boolean).length}/{t.num_questions} answers set
                    </div>
                  </div>
                  <div className="flex gap-1" style={{ marginLeft: '1rem' }}>
                    <Link to={`/tests/${t.id}/setup`} className="btn btn-secondary btn-sm">Answer key</Link>
                    <Link to={`/tests/${t.id}/mark`} className="btn btn-primary btn-sm">Mark</Link>
                    <button className="btn btn-secondary btn-sm" onClick={() => setAnalysisTest(t)}>Analysis</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteTest(t.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
