import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import StudentImport from '../components/StudentImport.jsx';

export default function ClassView() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [cls, setCls] = useState(null);
  const [students, setStudents] = useState([]);
  const [tests, setTests] = useState([]);
  const [tab, setTab] = useState('students');
  const [showImport, setShowImport] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentRef, setNewStudentRef] = useState('');
  const [newTestName, setNewTestName] = useState('');
  const [newTestQ, setNewTestQ] = useState(10);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [classId]);

  async function load() {
    try {
      const [classes, studs, tsts] = await Promise.all([
        api.getClasses(),
        api.getStudents(classId),
        api.getTests(classId)
      ]);
      const found = classes.find(c => c.id === Number(classId));
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

  async function addStudent(e) {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    try {
      const s = await api.createStudent(classId, newStudentName.trim(), newStudentRef.trim());
      setStudents(prev => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)));
      setNewStudentName('');
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
      setStudents(prev => [...prev, ...created].sort((a, b) => a.name.localeCompare(b.name)));
      setShowImport(false);
    } catch (err) { setError(err.message); }
  }

  async function createTest(e) {
    e.preventDefault();
    if (!newTestName.trim() || !newTestQ) return;
    try {
      const t = await api.createTest(Number(classId), newTestName.trim(), Number(newTestQ));
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

  if (loading) return <div className="page"><p>Loading...</p></div>;

  return (
    <div className="page container">
      {showImport && <StudentImport onImport={handleImport} onClose={() => setShowImport(false)} />}

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
              <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>
                ↑ Import students
              </button>
            </div>
            <form onSubmit={addStudent} className="flex gap-1">
              <input
                style={{ flex: 2, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6 }}
                placeholder="Full name"
                value={newStudentName}
                onChange={e => setNewStudentName(e.target.value)}
              />
              <input
                style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6 }}
                placeholder="ID / ref (optional)"
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
                    <th>#</th>
                    <th>Name</th>
                    <th>Student ID</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.id}>
                      <td style={{ color: '#9ca3af', width: 40 }}>{i + 1}</td>
                      <td>{s.name}</td>
                      <td style={{ color: '#6b7280' }}>{s.student_ref || '—'}</td>
                      <td style={{ width: 60 }}>
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
                type="number"
                min={1} max={200}
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
              {tests.map(t => (
                <div key={t.id} className="card flex items-center justify-between">
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: '0.15rem' }}>
                      {t.num_questions} questions &nbsp;·&nbsp;
                      {t.answer_key.filter(Boolean).length}/{t.num_questions} answers set
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Link to={`/tests/${t.id}/setup`} className="btn btn-secondary btn-sm">Answer key</Link>
                    <Link to={`/tests/${t.id}/mark`} className="btn btn-primary btn-sm">Mark</Link>
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
