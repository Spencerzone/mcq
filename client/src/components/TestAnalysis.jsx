import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { exportTestAnalysis } from './ExportButton.jsx';

const OPTIONS = ['A', 'B', 'C', 'D'];

function computeStats(values) {
  const n = values.length;
  if (!n) return { n: 0, mean: null, median: null, mode: [], stdDev: null };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 === 1
    ? sorted[Math.floor(n / 2)]
    : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const freq = {};
  values.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
  const maxFreq = Math.max(...Object.values(freq));
  const mode = Object.keys(freq)
    .filter(k => freq[k] === maxFreq)
    .map(Number)
    .sort((a, b) => a - b);
  const stdDev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  return { n, mean, median, mode, stdDev };
}

function buildAnalysis(test, students) {
  const hasKey = test.answer_key.some(Boolean);
  const answeredStudents = students.filter(s => s.answers.some(Boolean));

  // Test-level: score per student who answered at least one question
  const scores = hasKey
    ? answeredStudents.map(s =>
        s.answers.filter((a, i) => a && test.answer_key[i] && a === test.answer_key[i]).length
      )
    : [];
  const testStats = computeStats(scores);

  // Per-question stats
  const questionStats = Array.from({ length: test.num_questions }, (_, i) => {
    const counts = { A: 0, B: 0, C: 0, D: 0 };
    let answered = 0;
    students.forEach(s => {
      const ans = s.answers[i];
      if (ans && counts[ans] !== undefined) { counts[ans]++; answered++; }
    });

    // Binary 0/1 per student who answered this question
    let qMean = null, qMedian = null, qStdDev = null;
    if (hasKey && test.answer_key[i] && answered > 0) {
      const binary = students
        .filter(s => s.answers[i])
        .map(s => s.answers[i] === test.answer_key[i] ? 1 : 0);
      const s = computeStats(binary);
      qMean = s.mean;
      qMedian = s.median;
      qStdDev = s.stdDev;
    }

    const sorted = OPTIONS
      .map(o => ({ option: o, count: counts[o] }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count || a.option.localeCompare(b.option));

    return {
      q: i + 1,
      correct: test.answer_key[i] || null,
      counts,
      answered,
      top: sorted[0] || null,
      second: sorted[1] || null,
      mean: qMean,
      median: qMedian,
      stdDev: qStdDev,
    };
  });

  return { test, hasKey, testStats, questionStats, numStudents: students.length };
}

export default function TestAnalysis({ test, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getMarks(test.id)
      .then(({ test: t, students }) => setData(buildAnalysis(t, students)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [test.id]);

  const fmt2 = v => (v === null || v === undefined) ? '—' : v.toFixed(2);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div className="card" style={{ width: '100%', maxWidth: 820, maxHeight: '90vh', overflow: 'auto' }}>
        <div className="flex items-center justify-between mb-2">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Analysis: {test.name}</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>

        {loading && <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Loading…</p>}
        {error && <div className="alert alert-error">{error}</div>}

        {data && (
          <>
            {/* Test-level statistics */}
            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', marginBottom: '0.6rem' }}>
              Test Statistics
            </h3>
            {!data.hasKey ? (
              <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                No answer key set — score statistics unavailable.
              </p>
            ) : (
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Students marked', val: data.testStats.n },
                  { label: 'Mean', val: data.testStats.mean !== null ? `${fmt2(data.testStats.mean)} / ${data.test.num_questions}` : '—' },
                  { label: 'Median', val: data.testStats.median !== null ? `${data.testStats.median} / ${data.test.num_questions}` : '—' },
                  { label: 'Mode', val: data.testStats.mode.length ? data.testStats.mode.join(', ') : '—' },
                  { label: 'Std deviation', val: fmt2(data.testStats.stdDev) },
                ].map(({ label, val }) => (
                  <div key={label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.55rem 0.9rem', minWidth: 115, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: '#6b7280', marginBottom: '0.15rem' }}>{label}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{val}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Per-question analysis */}
            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', marginBottom: '0.6rem' }}>
              Per-Question Analysis
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <div className="card" style={{ padding: 0, minWidth: 540 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Q</th>
                      <th>Key</th>
                      <th style={{ textAlign: 'right' }}>A</th>
                      <th style={{ textAlign: 'right' }}>B</th>
                      <th style={{ textAlign: 'right' }}>C</th>
                      <th style={{ textAlign: 'right' }}>D</th>
                      <th>Most selected</th>
                      <th>2nd most</th>
                      {data.hasKey && (
                        <>
                          <th style={{ textAlign: 'right' }} title="Proportion of answerers who were correct">Mean %</th>
                          <th style={{ textAlign: 'right' }} title="Standard deviation of binary correct/incorrect score">SD</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.questionStats.map(qs => {
                      const badge = (entry) => {
                        if (!entry) return <span style={{ color: '#9ca3af' }}>—</span>;
                        const isCorrect = qs.correct && entry.option === qs.correct;
                        const color = qs.correct
                          ? (isCorrect ? '#059669' : '#dc2626')
                          : '#374151';
                        return (
                          <span style={{ fontWeight: 700, color }}>
                            {entry.option}{' '}
                            <span style={{ fontWeight: 400, fontSize: '0.78rem', color: '#6b7280' }}>
                              ({entry.count})
                            </span>
                          </span>
                        );
                      };

                      const meanPct = qs.mean !== null ? Math.round(qs.mean * 100) : null;
                      const meanColor = meanPct === null ? '#374151'
                        : meanPct >= 70 ? '#059669'
                        : meanPct >= 50 ? '#d97706'
                        : '#dc2626';

                      return (
                        <tr key={qs.q}>
                          <td style={{ fontWeight: 600 }}>Q{qs.q}</td>
                          <td style={{ color: qs.correct ? '#374151' : '#9ca3af', fontWeight: qs.correct ? 600 : 400 }}>
                            {qs.correct || '—'}
                          </td>
                          {OPTIONS.map(o => (
                            <td key={o} style={{
                              textAlign: 'right',
                              fontWeight: qs.correct === o ? 700 : 400,
                              color: qs.correct === o ? '#059669' : '#374151',
                            }}>
                              {qs.counts[o] || 0}
                            </td>
                          ))}
                          <td>{badge(qs.top)}</td>
                          <td>{badge(qs.second)}</td>
                          {data.hasKey && (
                            <>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: meanColor }}>
                                {meanPct !== null ? `${meanPct}%` : '—'}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {qs.stdDev !== null ? qs.stdDev.toFixed(2) : '—'}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => exportTestAnalysis(data, test.name)}>
                ↓ Export analysis
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
