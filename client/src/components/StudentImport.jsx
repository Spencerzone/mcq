import React, { useState, useRef } from 'react';
import Papa from 'papaparse';

export default function StudentImport({ onImport, onClose }) {
  const [tab, setTab] = useState('paste'); // 'paste' | 'csv'
  const [pasteText, setPasteText] = useState('');
  const [csvRows, setCsvRows] = useState(null);
  const [nameCol, setNameCol] = useState('');
  const [refCol, setRefCol] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef();

  function parsePaste() {
    const lines = pasteText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) { setError('No names found'); return; }
    onImport(lines.map(name => ({ name, student_ref: '' })));
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (!result.data.length) { setError('No data found in file'); return; }
        setCsvRows(result.data);
        const cols = Object.keys(result.data[0]);
        // Auto-detect common column names
        const nameGuess = cols.find(c => /name/i.test(c)) || cols[0];
        const refGuess = cols.find(c => /id|ref|number|num/i.test(c)) || '';
        setNameCol(nameGuess);
        setRefCol(refGuess);
      },
      error: () => setError('Failed to parse CSV file')
    });
  }

  function importCsv() {
    if (!nameCol) { setError('Please select the name column'); return; }
    const students = csvRows
      .map(row => ({ name: row[nameCol]?.trim(), student_ref: refCol ? row[refCol]?.trim() : '' }))
      .filter(s => s.name);
    if (!students.length) { setError('No valid students found'); return; }
    onImport(students);
  }

  const cols = csvRows ? Object.keys(csvRows[0]) : [];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div className="card" style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto' }}>
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
                placeholder={"Alice Smith\nBob Jones\nCarol White"}
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
            </div>
            <div className="flex gap-1">
              <button className="btn btn-primary" onClick={parsePaste}>Import {pasteText.split('\n').filter(l => l.trim()).length} students</button>
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
                  <label>Column containing student names *</label>
                  <select value={nameCol} onChange={e => setNameCol(e.target.value)}>
                    {cols.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Column for student ID/reference (optional)</label>
                  <select value={refCol} onChange={e => setRefCol(e.target.value)}>
                    <option value="">— None —</option>
                    {cols.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
                  Preview: {csvRows.slice(0, 3).map(r => r[nameCol]).join(', ')}{csvRows.length > 3 ? ` ... +${csvRows.length - 3} more` : ''}
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
