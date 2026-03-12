import React from 'react';
import Papa from 'papaparse';
import { api, studentDisplayName } from '../api.js';

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
      rows.push({
        Test: '',
        Question: `Q${i + 1}`,
        Correct_Answer: test.answer_key[i] || '',
        Student_Answer: answers[i] || '',
        Correct: test.answer_key[i] && answers[i]
          ? (answers[i] === test.answer_key[i] ? 'Yes' : 'No')
          : '',
      });
    }
    // Summary row for this test
    rows.push({
      Test: '',
      Question: 'TOTAL',
      Correct_Answer: '',
      Student_Answer: `${answered}/${test.num_questions} answered`,
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
    const score = answers.filter((a, i) => a && key[i] && a === key[i]).length;
    const answered = answers.filter(Boolean).length;
    const row = {
      First_Name: s.first_name || s.name || '',
      Last_Name: s.last_name || '',
      Student_ID: s.student_ref || '',
    };
    answers.forEach((a, i) => { row[`Q${i + 1}`] = a || ''; });
    if (hasKey) {
      row.Score = score;
      row.Total = test.num_questions;
      row.Percentage = answered > 0 ? `${Math.round(score / test.num_questions * 100)}%` : '';
    } else {
      row.Answered = `${answered}/${test.num_questions}`;
    }
    return row;
  };

  // Answer key row at the top
  const keyRow = { First_Name: '-- Answer Key --', Last_Name: '', Student_ID: '' };
  key.forEach((k, i) => { keyRow[`Q${i + 1}`] = k || ''; });
  if (hasKey) { keyRow.Score = ''; keyRow.Total = ''; keyRow.Percentage = ''; }
  else { keyRow.Answered = ''; }

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
      const score = answers.filter((a, i) => a && test.answer_key[i] && a === test.answer_key[i]).length;
      const answered = answers.filter(Boolean).length;
      row[`${test.name} - Answered`] = `${answered}/${test.num_questions}`;
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
