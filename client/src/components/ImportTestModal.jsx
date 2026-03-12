import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';

export default function ImportTestModal({ currentClassId, onImport, onClose }) {
  const [mode, setMode] = useState('file');
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classTests, setClassTests] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingTests, setLoadingTests] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    if (mode !== 'class') return;
    setLoadingClasses(true);
    api.getClasses()
      .then(cls => setClasses(cls.filter(c => c.id !== currentClassId)))
      .catch(e => setError(e.message))
      .finally(() => setLoadingClasses(false));
  }, [mode]);

  useEffect(() => {
    if (!selectedClassId) { setClassTests([]); return; }
    setLoadingTests(true);
    api.getTests(selectedClassId)
      .then(setClassTests)
      .catch(e => setError(e.message))
      .finally(() => setLoadingTests(false));
  }, [selectedClassId]);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.name || !data.num_questions) throw new Error('Missing name or num_questions');
        const num = Number(data.num_questions);
        const key = Array.isArray(data.answer_key) ? data.answer_key : Array(num).fill(null);
        onImport({ name: data.name, num_questions: num, answer_key: key });
      } catch (err) {
        setError('Invalid template: ' + err.message);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '85vh', overflow: 'auto' }}>
        <div className="flex items-center justify-between mb-2">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Import Test</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="tabs" style={{ marginBottom: '1rem' }}>
          <div className={`tab ${mode === 'file' ? 'active' : ''}`} onClick={() => setMode('file')}>
            From file
          </div>
          <div className={`tab ${mode === 'class' ? 'active' : ''}`} onClick={() => setMode('class')}>
            From another class
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {mode === 'file' && (
          <div>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
              Upload a <strong>.json</strong> template file previously exported from this app.
              The test name, number of questions, and answer key will all be restored.
            </p>
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFile} />
            <button className="btn btn-primary" onClick={() => fileRef.current.click()}>
              Choose template file…
            </button>
          </div>
        )}

        {mode === 'class' && (
          <div>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
              Copy a test (including its answer key) from one of your other classes.
            </p>

            {loadingClasses && <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Loading classes…</p>}

            {!loadingClasses && classes.length === 0 && (
              <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No other classes found.</p>
            )}

            {classes.length > 0 && (
              <div className="form-group">
                <label>Class</label>
                <select
                  value={selectedClassId}
                  onChange={e => { setSelectedClassId(e.target.value); setClassTests([]); }}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.9rem' }}
                >
                  <option value="">— select a class —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {loadingTests && <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Loading tests…</p>}

            {!loadingTests && selectedClassId && classTests.length === 0 && (
              <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No tests in this class.</p>
            )}

            {classTests.length > 0 && (
              <div>
                <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>Click a test to import it:</p>
                {classTests.map(t => (
                  <div
                    key={t.id}
                    onClick={() => onImport({ name: t.name, num_questions: t.num_questions, answer_key: t.answer_key })}
                    style={{
                      border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem 1rem',
                      marginBottom: '0.5rem', cursor: 'pointer', background: 'white',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.15rem' }}>
                      {t.num_questions} questions &nbsp;·&nbsp;
                      {t.answer_key.filter(Boolean).length}/{t.num_questions} answers set
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
