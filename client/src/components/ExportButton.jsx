import React from 'react';
import Papa from 'papaparse';

// Export per-student: rows = questions
export function exportStudent(student, test) {
  const key = test.answer_key;
  const answers = student.answers;
  const rows = Array.from({ length: test.num_questions }, (_, i) => ({
    Question: `Q${i + 1}`,
    Correct_Answer: key[i] || '',
    Student_Answer: answers[i] || '',
    Correct: key[i] && answers[i] ? (answers[i] === key[i] ? 'Yes' : 'No') : ''
  }));
  const score = answers.filter((a, i) => a && key[i] && a === key[i]).length;
  const csv = Papa.unparse(rows);
  download(csv, `${student.name}_${test.name}.csv`);
}

// Export per-test/class: rows = students
export function exportTest(students, test) {
  const key = test.answer_key;
  const rows = students.map(s => {
    const answers = s.answers;
    const score = answers.filter((a, i) => a && key[i] && a === key[i]).length;
    const attempted = answers.filter(Boolean).length;
    const row = { Name: s.name, Student_ID: s.student_ref || '' };
    answers.forEach((a, i) => { row[`Q${i + 1}`] = a || ''; });
    row.Score = `${score}/${test.num_questions}`;
    row.Percentage = attempted > 0 ? `${Math.round(score / test.num_questions * 100)}%` : '';
    return row;
  });
  const csv = Papa.unparse(rows);
  download(csv, `${test.name}_results.csv`);
}

function download(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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
