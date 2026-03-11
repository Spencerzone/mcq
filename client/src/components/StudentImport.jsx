import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { splitName } from '../api.js';

export default function StudentImport({ onImport, onClose }) {
  const [tab, setTab] = useState('paste');
  const [pasteText, setPasteText] = useState('');
  const [csvRows, setCsvRows] = useState(null);
  // CSV column mapping — user can pick a combined name col OR separate first/last cols
  const [nameMode, setNameMode] = useState('combined'); // 'combined' | 'split'
  const [nameCol, setNameCol] = useState('');
  const [firstNameCol, setFirstNameCol] = useState('');
  const [lastNameCol, setLastNameCol] = useState('');
  const [refCol, setRefCol] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef();

  function parsePaste() {
    const lines = pasteText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) { setError('No names found'); return; }
    onImport(lines.map(line => ({ ...splitName(line), student_ref: '' })));
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (!result.data.length) { setError('No data found in file'); return; }
        setCsvRows(result.data);
        const cols = Object.keys(result.data[0]);
        // Auto-detect column names
        const firstGuess = cols.find(c => /first.?name|forename|given/i.test(c)) || '';
        const lastGuess = cols.find(c => /last.?name|surname|family/i.test(c)) || '';
        const fullGuess = cols.find(c => /^name$|full.?name|student.?name/i.test(c)) || cols[0];
        const refGuess = cols.find(c => /\bid\b|ref|number|num|roll/i.test(c)) || '';
        if (firstGuess && lastGuess) {
          setNameMode('split');
          setFirstNameCol(firstGuess);
          setLastNameCol(lastGuess);
        } else {
          setNameMode('combined');
          setNameCol(fullGuess);
        }
        setRefCol(refGuess);
      },
      error: () => setError('Failed to parse CSV file')
    });
  }

  function importCsv() {
    if (nameMode === 'combined' && !nameCol) { setError('Please select the name column'); return; }
    if (nameMode === 'split' && !firstNameCol && !lastNameCol) { setError('Please select at least one name column'); return; }
    const students = csvRows
      .map(row => {
        if (nameMode === 'split') {
          return {
            first_name: row[firstNameCol]?.trim() || '',
            last_name: row[lastNameCol]?.trim() || '',
            student_ref: refCol ? row[refCol]?.trim() : '',
          };
        }
        return { ...splitName(row[nameCol]?.trim()), student_ref: refCol ? row[refCol]?.trim() : '' };
      })
      .filter(s => s.first_name || s.last_name);
    if (!students.length) { setError('No valid students found'); return; }
    onImport(students);
  }

  const cols = csvRows ? Object.keys(csvRows[0]) : [];
  const pasteCount = pasteText.split('\n').filter(l => l.trim()).length;

  // Preview for CSV
  function csvPreview() {
    return csvRows.slice(0, 3).map(r => {
      if (nameMode === 'split') return [r[firstNameCol], r[lastNameCol]].filter(Boolean).join(' ');
      return r[nameCol] || '';
    }).filter(Boolean).join(', ');
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }}>
        <div className="flex items-center justify-between mb-2">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Import Students</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="tabs">
          <div className={`tab ${tab === 'paste' ? 'active' : ''}`} onClick={() => setTab('paste')}>Paste names</div>
          <div className={`tab ${tab === 'csv' ? 'active' : ''}`} onClick={() => setTab('csv')}>Upload CSV</div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {tab === 'paste' && (
          <div>
            <div className="form-group">
              <label>Paste student names (one per line)</label>
              <textarea
                rows={10}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={"Alice Smith\nBob Jones\nSmith, Carol"}
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
            </div>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.75rem' }}>
              Names are split automatically. Use "Last, First" or "First Last" format.
            </p>
            <div className="flex gap-1">
              <button className="btn btn-primary" onClick={parsePaste}>Import {pasteCount} student{pasteCount !== 1 ? 's' : ''}</button>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}

        {tab === 'csv' && (
          <div>
            <div className="form-group">
              <label>Select CSV or spreadsheet file</label>
              <input type="file" accept=".csv,.tsv,.txt" ref={fileRef} onChange={handleFile} />
              <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>
                Export from Excel/Google Sheets as CSV, then upload here.
              </p>
            </div>

            {csvRows && (
              <>
                <div className="form-group">
                  <label>Name columns</label>
                  <div className="flex gap-1" style={{ marginBottom: '0.5rem' }}>
                    <label style={{ fontWeight: 400, display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                      <input type="radio" checked={nameMode === 'combined'} onChange={() => setNameMode('combined')} /> Combined (Full Name)
                    </label>
                    <label style={{ fontWeight: 400, display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                      <input type="radio" checked={nameMode === 'split'} onChange={() => setNameMode('split')} /> Separate (First + Last)
                    </label>
                  </div>

                  {nameMode === 'combined' && (
                    <select value={nameCol} onChange={e => setNameCol(e.target.value)}>
                      {cols.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                  {nameMode === 'split' && (
                    <div className="flex gap-1">
                      <select value={firstNameCol} onChange={e => setFirstNameCol(e.target.value)} style={{ flex: 1 }}>
                        <option value="">— First name —</option>
                        {cols.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select value={lastNameCol} onChange={e => setLastNameCol(e.target.value)} style={{ flex: 1 }}>
                        <option value="">— Last name —</option>
                        {cols.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Student ID / reference (optional)</label>
                  <select value={refCol} onChange={e => setRefCol(e.target.value)}>
                    <option value="">— None —</option>
                    {cols.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
                  Preview: {csvPreview()}{csvRows.length > 3 ? ` … +${csvRows.length - 3} more` : ''}
                </p>
                <div className="flex gap-1">
                  <button className="btn btn-primary" onClick={importCsv}>Import {csvRows.length} students</button>
                  <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
