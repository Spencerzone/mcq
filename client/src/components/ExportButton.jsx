import React from 'react';
import Papa from 'papaparse';
import { api, studentDisplayName } from '../api.js';

// Export analysis modal data for a test
export function exportTestAnalysis(analysisData, testName) {
  const { test, hasKey, testStats, questionStats } = analysisData;

  // Section 1: test-level summary
  const summaryRows = [{ Metric: 'Students marked', Value: testStats.n }];
  if (hasKey) {
    summaryRows.push(
      { Metric: 'Mean score', Value: testStats.mean !== null ? testStats.mean.toFixed(2) : '' },
      { Metric: 'Median score', Value: testStats.median ?? '' },
      { Metric: 'Mode score(s)', Value: testStats.mode.join(', ') },
      { Metric: 'Std deviation', Value: testStats.stdDev !== null ? testStats.stdDev.toFixed(2) : '' },
    );
  }

  // Section 2: per-question rows
  const qRows = questionStats.map(qs => {
    const row = {
      Question: `Q${qs.q}`,
      Correct_Answer: qs.correct || '',
      Count_A: qs.counts.A,
      Count_B: qs.counts.B,
      Count_C: qs.counts.C,
      Count_D: qs.counts.D,
      Most_Selected: qs.top ? `${qs.top.option} (${qs.top.count})` : '',
      Second_Most_Selected: qs.second ? `${qs.second.option} (${qs.second.count})` : '',
    };
    if (hasKey) {
      row['Mean_%'] = qs.mean !== null ? `${Math.round(qs.mean * 100)}%` : '';
      row['Median'] = qs.median !== null ? qs.median : '';
      row['Std_Dev'] = qs.stdDev !== null ? qs.stdDev.toFixed(2) : '';
    }
    return row;
  });

  const csv =
    'Test Summary\n' + Papa.unparse(summaryRows) +
    '\n\nQuestion Analysis\n' + Papa.unparse(qRows);

  download(csv, `${testName}_analysis.csv`);
}

// Export one student's results across ALL their tests in this class
export async function exportStudentAllTests(student, classId) {
  const marks = await api.getStudentMarks(classId, student.id);
  if (!marks.length) return;

  const name = studentDisplayName(student);
  const rows = [];

  for (const { test, answers, score, answered, hasKey } of marks) {
    // Section header row
    rows.push({ Test: test.name, Question: '', Correct_Answer: '', Student_Answer: '', Correct: '' });
    // Per-question rows
    for (let i = 0; i < test.num_questions; i++) {
      const a = answers[i];
      const studentAns = (a && a !== '-') ? a : '';
      rows.push({
        Test: '',
        Question: `Q${i + 1}`,
        Correct_Answer: test.answer_key[i] || '',
        Student_Answer: studentAns,
        Correct: test.answer_key[i] && studentAns
          ? (studentAns === test.answer_key[i] ? 'Yes' : 'No')
          : '',
      });
    }
    // Summary row for this test
    rows.push({
      Test: '',
      Question: 'TOTAL',
      Correct_Answer: '',
      Student_Answer: '',
      Correct: hasKey ? `${score}/${test.num_questions} (${Math.round(score / test.num_questions * 100)}%)` : 'No answer key',
    });
    // Blank separator
    rows.push({ Test: '', Question: '', Correct_Answer: '', Student_Answer: '', Correct: '' });
  }

  download(Papa.unparse(rows), `${name}_all_tests.csv`);
}

// Export one test: rows = students, with answer key row prepended, score as separate columns
export function exportTest(students, test) {
  const key = test.answer_key;
  const hasKey = key.some(Boolean);

  const makeRow = (s, answers) => {
    const score = answers.filter((a, i) => a && a !== '-' && key[i] && a === key[i]).length;
    const row = {
      First_Name: s.first_name || s.name || '',
      Last_Name: s.last_name || '',
      Student_ID: s.student_ref || '',
    };
    answers.forEach((a, i) => { row[`Q${i + 1}`] = (a && a !== '-') ? a : ''; });
    if (hasKey) {
      row.Score = score;
      row.Total = test.num_questions;
      row.Percentage = `${Math.round(score / test.num_questions * 100)}%`;
    }
    return row;
  };

  // Answer key row at the top
  const keyRow = { First_Name: '-- Answer Key --', Last_Name: '', Student_ID: '' };
  key.forEach((k, i) => { keyRow[`Q${i + 1}`] = k || ''; });
  if (hasKey) { keyRow.Score = ''; keyRow.Total = ''; keyRow.Percentage = ''; }

  const rows = [keyRow, ...students.map(s => makeRow(s, s.answers))];
  download(Papa.unparse(rows), `${test.name}_results.csv`);
}

// Export ALL tests for a class: one row per student, grouped by test
export async function exportClassAllTests(classId, className) {
  const { students, tests } = await api.getAllClassMarks(classId);
  if (!tests.length || !students.length) return;

  const rows = students.map(s => {
    const row = {
      First_Name: s.first_name || s.name || '',
      Last_Name: s.last_name || '',
      Student_ID: s.student_ref || '',
    };
    let totalScore = 0, totalMax = 0;
    for (const test of tests) {
      const answers = test.responseMap[s.id] || Array(test.num_questions).fill(null);
      const hasKey = test.answer_key.some(Boolean);
      const score = answers.filter((a, i) => a && a !== '-' && test.answer_key[i] && a === test.answer_key[i]).length;
      if (hasKey) {
        row[`${test.name} - Score`] = score;
        row[`${test.name} - Total`] = test.num_questions;
        row[`${test.name} - %`] = `${Math.round(score / test.num_questions * 100)}%`;
        totalScore += score;
        totalMax += test.num_questions;
      }
    }
    if (totalMax > 0) {
      row['Overall Score'] = totalScore;
      row['Overall Total'] = totalMax;
      row['Overall %'] = `${Math.round(totalScore / totalMax * 100)}%`;
    }
    return row;
  });

  download(Papa.unparse(rows), `${className}_all_results.csv`);
}

function download(csv, filename) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportButton({ label, onClick, className = 'btn btn-secondary btn-sm' }) {
  return (
    <button className={className} onClick={onClick} title="Export CSV">
      ↓ {label}
    </button>
  );
}
