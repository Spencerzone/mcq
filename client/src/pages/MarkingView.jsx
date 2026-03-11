import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import ExportButton, { exportStudent, exportTest } from '../components/ExportButton.jsx';

const OPTIONS = ['A', 'B', 'C', 'D'];

export default function MarkingView() {
  const { testId } = useParams();
  const [test, setTest] = useState(null);
  const [students, setStudents] = useState([]);
  const [currentStudentIdx, setCurrentStudentIdx] = useState(0);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showKey, setShowKey] = useState(false);
  // Track which students have unsaved changes being debounced
  const saveTimers = useRef({});

  useEffect(() => {
    api.getMarks(testId).then(data => {
      setTest(data.test);
      setStudents(data.students);
      // Find first student with unanswered questions
      const firstUnfinished = data.students.findIndex(s => s.answers.some(a => !a));
      setCurrentStudentIdx(Math.max(0, firstUnfinished === -1 ? 0 : firstUnfinished));
    }).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, [testId]);

  const currentStudent = students[currentStudentIdx];

  function setAnswer(studentIdx, qIdx, letter) {
    setStudents(prev => {
      const next = [...prev];
      const s = { ...next[studentIdx], answers: [...next[studentIdx].answers] };
      s.answers[qIdx] = letter;
      next[studentIdx] = s;
      return next;
    });
    // Debounce save
    const sid = students[studentIdx].id;
    clearTimeout(saveTimers.current[sid]);
    saveTimers.current[sid] = setTimeout(() => {
      setStudents(current => {
        const s = current[studentIdx];
        api.saveMarks(testId, sid, s.answers).catch(console.error);
        return current;
      });
    }, 400);
  }

  const handleKey = useCallback((e) => {
    if (!test || !currentStudent) return;
    // Ignore if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const n = Number(e.key);
    if (n >= 1 && n <= 4) {
      e.preventDefault();
      const letter = OPTIONS[n - 1];
      setAnswer(currentStudentIdx, currentQIdx, letter);
      // Advance to next question, or if done, move to next student
      if (currentQIdx < test.num_questions - 1) {
        setCurrentQIdx(prev => prev + 1);
      }
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setCurrentQIdx(prev => Math.min(prev + 1, test.num_questions - 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setCurrentQIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'PageDown' || e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      goToStudent(currentStudentIdx + 1);
    } else if (e.key === 'PageUp' || e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      goToStudent(currentStudentIdx - 1);
    }
  }, [test, currentStudent, currentStudentIdx, currentQIdx]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  function goToStudent(idx) {
    if (idx < 0 || idx >= students.length) return;
    setCurrentStudentIdx(idx);
    // Jump to first unanswered question for this student
    const firstUnanswered = students[idx].answers.findIndex(a => !a);
    setCurrentQIdx(firstUnanswered === -1 ? 0 : firstUnanswered);
  }

  function getScore(student) {
    if (!test) return { score: 0, total: 0 };
    const key = test.answer_key;
    const score = student.answers.filter((a, i) => a && key[i] && a === key[i]).length;
    return { score, total: test.num_questions };
  }

  function isStudentDone(student) {
    return student.answers.every(Boolean);
  }

  function scoreClass(score, total) {
    const pct = total ? score / total : 0;
    if (pct >= 0.7) return 'score-high';
    if (pct >= 0.5) return 'score-mid';
    return 'score-low';
  }

  if (loading) return <div className="page"><p>Loading...</p></div>;
  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>;
  if (!test) return null;

  const key = test.answer_key;

  return (
    <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link to={`/classes/${test.class_id}`} style={{ color: '#6b7280', fontSize: '0.85rem', textDecoration: 'none' }}>
          ← Back
        </Link>
        <span style={{ fontWeight: 700 }}>{test.name}</span>
        <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{test.num_questions} questions</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowKey(v => !v)}>
            {showKey ? 'Hide' : 'Show'} answer key
          </button>
          <ExportButton label="Export class CSV" onClick={() => exportTest(students, test)} />
        </div>
      </div>

      <div className="marking-layout" style={{ flex: 1, overflow: 'hidden' }}>
        {/* Student list sidebar */}
        <div className="student-list">
          <div style={{ padding: '0.5rem 1rem 0.25rem', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Students ({students.length})
          </div>
          {students.map((s, idx) => {
            const { score, total } = getScore(s);
            const done = isStudentDone(s);
            return (
              <div
                key={s.id}
                className={`student-item ${idx === currentStudentIdx ? 'active' : ''} ${done ? 'done' : ''}`}
                onClick={() => goToStudent(idx)}
              >
                <div>{s.name}</div>
                {s.student_ref && <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{s.student_ref}</div>}
                <div style={{ fontSize: '0.75rem', color: done ? '#059669' : '#9ca3af', marginTop: '0.1rem' }}>
                  {s.answers.filter(Boolean).length}/{total} answered
                  {done && key.some(Boolean) && ` · ${score}/${total}`}
                </div>
              </div>
            );
          })}
        </div>

        {/* Main marking area */}
        <div className="marking-main">
          {currentStudent && (
            <>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{currentStudent.name}</h2>
                  {currentStudent.student_ref && (
                    <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>ID: {currentStudent.student_ref}</span>
                  )}
                </div>
                <div className="flex gap-1 items-center">
                  {(() => { const { score, total } = getScore(currentStudent); return key.some(Boolean) ? (
                    <span className={`score-pill ${scoreClass(score, total)}`}>{score}/{total} ({Math.round(score/total*100)}%)</span>
                  ) : null; })()}
                  <ExportButton label="Export student" onClick={() => exportStudent(currentStudent, test)} />
                  <button className="btn btn-secondary btn-sm" disabled={currentStudentIdx === 0} onClick={() => goToStudent(currentStudentIdx - 1)}>← Prev</button>
                  <button className="btn btn-secondary btn-sm" disabled={currentStudentIdx === students.length - 1} onClick={() => goToStudent(currentStudentIdx + 1)}>Next →</button>
                </div>
              </div>

              <div className="card mb-2" style={{ padding: '0.6rem 1rem' }}>
                <span className="kbd-hint">
                  <kbd>1</kbd>=A <kbd>2</kbd>=B <kbd>3</kbd>=C <kbd>4</kbd>=D to answer &nbsp;·&nbsp;
                  <kbd>←</kbd><kbd>→</kbd> navigate questions &nbsp;·&nbsp;
                  <kbd>Tab</kbd>/<kbd>Shift+Tab</kbd> next/prev student
                </span>
              </div>

              {/* Current question highlight */}
              <div className="card mb-2" style={{ background: '#eef2ff', borderColor: '#c7d2fe' }}>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.25rem' }}>Current question</div>
                <div className="flex items-center gap-2">
                  <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Q{currentQIdx + 1}</span>
                  <div className="answer-options">
                    {OPTIONS.map((opt, i) => {
                      const selected = currentStudent.answers[currentQIdx] === opt;
                      const correct = key[currentQIdx] === opt;
                      let cls = 'answer-btn';
                      if (selected && correct && showKey) cls += ' correct';
                      else if (selected && !correct && showKey && key[currentQIdx]) cls += ' wrong';
                      else if (selected) cls += ' selected';
                      else if (correct && showKey) cls += ' correct';
                      return (
                        <button
                          key={opt}
                          className={cls}
                          onClick={() => { setAnswer(currentStudentIdx, currentQIdx, opt); }}
                          title={`${opt} (press ${i+1})`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {showKey && key[currentQIdx] && (
                    <span style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 600 }}>
                      Correct: {key[currentQIdx]}
                    </span>
                  )}
                </div>
              </div>

              {/* All questions grid */}
              <div className="question-grid">
                {Array.from({ length: test.num_questions }, (_, i) => {
                  const answered = currentStudent.answers[i];
                  const correct = key[i];
                  const isCurrent = i === currentQIdx;
                  const isCorrect = answered && correct && answered === correct;
                  const isWrong = answered && correct && answered !== correct;
                  return (
                    <div
                      key={i}
                      className={`question-card${isCurrent ? ' current' : ''}${answered ? ' answered' : ''}`}
                      onClick={() => setCurrentQIdx(i)}
                    >
                      <div className="question-num">Q{i + 1}</div>
                      <div className="answer-options">
                        {OPTIONS.map((opt, oi) => {
                          const sel = answered === opt;
                          const corr = correct === opt;
                          let cls = 'answer-btn';
                          if (sel && corr && showKey) cls += ' correct';
                          else if (sel && !corr && showKey && correct) cls += ' wrong';
                          else if (sel) cls += ' selected';
                          else if (corr && showKey) cls += ' correct';
                          return (
                            <button
                              key={opt}
                              className={cls}
                              onClick={e => { e.stopPropagation(); setAnswer(currentStudentIdx, i, opt); setCurrentQIdx(i); }}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {students.length === 0 && (
            <div className="empty">
              <p>No students in this class yet.</p>
              <Link to={`/classes/${test.class_id}`} className="btn btn-primary mt-2">Add students</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
