import React, { useState, useEffect } from 'react';
import { api, studentDisplayName } from '../api.js';
import { exportStudentAllTests } from './ExportButton.jsx';

export default function StudentProfile({ student, classId, className, onSave, onClose }) {
  const [firstName, setFirstName] = useState(student.first_name ?? (student.name ? student.name.split(' ').slice(0, -1).join(' ') : ''));
  const [lastName, setLastName] = useState(student.last_name ?? (student.name ? student.name.split(' ').slice(-1)[0] : ''));
  const [studentRef, setStudentRef] = useState(student.student_ref || '');
  const [marks, setMarks] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getStudentMarks(classId, student.id)
      .then(setMarks)
      .catch(() => setMarks([]));
  }, [classId, student.id]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await api.updateStudent(classId, student.id, firstName.trim(), lastName.trim(), studentRef.trim());
      onSave({ ...student, first_name: firstName.trim(), last_name: lastName.trim(), student_ref: studentRef.trim() });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function scoreClass(score, total) {
    if (!total) return '';
    const pct = score / total;
    if (pct >= 0.7) return 'score-high';
    if (pct >= 0.5) return 'score-mid';
    return 'score-low';
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div className="card" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Student Profile</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>

        <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
          Class: <strong>{className}</strong>
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Edit form */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>First name</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)} autoFocus />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Last name</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>Student ID / reference</label>
          <input value={studentRef} onChange={e => setStudentRef(e.target.value)} placeholder="Optional" />
        </div>

        <div className="flex gap-1 mb-2">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-secondary" onClick={() => exportStudentAllTests({ ...student, first_name: firstName, last_name: lastName }, classId)}>
            Export student
          </button>
        </div>

        {/* Test results */}
        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '1rem 0 0.75rem' }} />
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>Test Results</h3>

        {marks === null && <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Loading…</p>}
        {marks && marks.length === 0 && <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No tests in this class yet.</p>}
        {marks && marks.length > 0 && (
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Answered</th>
                  <th>Score</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {marks.map(({ test, answered, score, hasKey }) => (
                  <tr key={test.id}>
                    <td>{test.name}</td>
                    <td style={{ color: answered === test.num_questions ? '#059669' : '#6b7280' }}>
                      {answered}/{test.num_questions}
                    </td>
                    <td>
                      {hasKey
                        ? <span className={`score-pill ${scoreClass(score, test.num_questions)}`}>{score}/{test.num_questions}</span>
                        : <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>No key set</span>
                      }
                    </td>
                    <td>
                      {hasKey && answered > 0
                        ? `${Math.round(score / test.num_questions * 100)}%`
                        : '—'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
