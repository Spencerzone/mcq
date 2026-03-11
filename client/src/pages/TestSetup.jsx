import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

const OPTIONS = ['A', 'B', 'C', 'D'];

export default function TestSetup() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [answerKey, setAnswerKey] = useState([]);
  const [focusedQ, setFocusedQ] = useState(0); // index of focused question for keyboard nav
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getTest(testId).then(t => {
      setTest(t);
      setAnswerKey(t.answer_key);
    }).catch(err => setError(err.message));
  }, [testId]);

  const handleKey = useCallback((e) => {
    if (!test) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 4) {
      e.preventDefault();
      const letter = OPTIONS[n - 1];
      setAnswerKey(prev => {
        const next = [...prev];
        next[focusedQ] = letter;
        return next;
      });
      // Advance to next question
      setFocusedQ(prev => Math.min(prev + 1, test.num_questions - 1));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedQ(prev => Math.min(prev + 1, test.num_questions - 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedQ(prev => Math.max(prev - 1, 0));
    }
  }, [test, focusedQ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  async function save() {
    setSaving(true);
    try {
      await api.updateTest(testId, { answer_key: answerKey });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function setAnswer(qIdx, letter) {
    setAnswerKey(prev => {
      const next = [...prev];
      next[qIdx] = letter;
      return next;
    });
    setFocusedQ(qIdx);
  }

  if (!test) return <div className="page"><p>{error || 'Loading...'}</p></div>;

  const classId = test.class_id;
  const answered = answerKey.filter(Boolean).length;

  return (
    <div className="page container">
      <div className="breadcrumb">
        <Link to="/">My Classes</Link> / <Link to={`/classes/${classId}`}>Class</Link> / {test.name}
      </div>
      <div className="page-header">
        <div>
          <h1>Answer Key — {test.name}</h1>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.25rem' }}>
            {answered}/{test.num_questions} answers set
          </p>
        </div>
        <div className="flex gap-1 items-center">
          {saved && <span className="badge badge-green">Saved!</span>}
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save answer key'}
          </button>
          <Link to={`/tests/${testId}/mark`} className="btn btn-success">→ Start marking</Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card mb-2">
        <p className="kbd-hint" style={{ marginBottom: '0.5rem' }}>
          Use <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd> for A B C D · <kbd>←</kbd> <kbd>→</kbd> to navigate questions
        </p>
        <p style={{ fontSize: '0.82rem', color: '#6b7280' }}>
          Click a question to focus it, then type 1-4. The highlighted question advances automatically.
        </p>
      </div>

      <div className="key-grid">
        {Array.from({ length: test.num_questions }, (_, i) => (
          <div
            key={i}
            className={`key-item card ${focusedQ === i ? 'current' : ''}`}
            style={{ cursor: 'pointer', margin: 0, padding: '0.5rem 0.75rem' }}
            onClick={() => setFocusedQ(i)}
          >
            <span>Q{i + 1}</span>
            <div className="answer-options">
              {OPTIONS.map(opt => (
                <button
                  key={opt}
                  className={`answer-btn${answerKey[i] === opt ? ' selected' : ''}`}
                  onClick={e => { e.stopPropagation(); setAnswer(i, opt); }}
                  title={`Q${i+1} = ${opt}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mt-2">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save answer key'}
        </button>
        <Link to={`/classes/${classId}`} className="btn btn-secondary">Back to class</Link>
      </div>
    </div>
  );
}
