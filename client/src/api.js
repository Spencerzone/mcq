const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra };
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  register: (username, password) => request('POST', '/auth/register', { username, password }),
  login: (username, password) => request('POST', '/auth/login', { username, password }),

  // Classes
  getClasses: () => request('GET', '/classes'),
  createClass: (name) => request('POST', '/classes', { name }),
  updateClass: (id, name) => request('PUT', `/classes/${id}`, { name }),
  deleteClass: (id) => request('DELETE', `/classes/${id}`),

  // Students
  getStudents: (classId) => request('GET', `/classes/${classId}/students`),
  createStudent: (classId, name, student_ref) => request('POST', `/classes/${classId}/students`, { name, student_ref }),
  importStudents: (classId, students) => request('POST', `/classes/${classId}/students/import`, { students }),
  updateStudent: (classId, studentId, name, student_ref) => request('PUT', `/classes/${classId}/students/${studentId}`, { name, student_ref }),
  deleteStudent: (classId, studentId) => request('DELETE', `/classes/${classId}/students/${studentId}`),

  // Tests
  getTests: (classId) => request('GET', `/tests/class/${classId}`),
  getTest: (testId) => request('GET', `/tests/${testId}`),
  createTest: (class_id, name, num_questions) => request('POST', '/tests', { class_id, name, num_questions }),
  updateTest: (id, updates) => request('PUT', `/tests/${id}`, updates),
  deleteTest: (id) => request('DELETE', `/tests/${id}`),

  // Marks
  getMarks: (testId) => request('GET', `/marks/test/${testId}`),
  saveMarks: (testId, studentId, answers) => request('PUT', `/marks/test/${testId}/student/${studentId}`, { answers }),
};
