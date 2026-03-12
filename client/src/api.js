import {
  collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc,
  writeBatch, query, orderBy
} from 'firebase/firestore';
import { db, auth } from './firebase.js';

function uid() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

// Path helpers
function classesRef() { return collection(db, 'users', uid(), 'classes'); }
function classRef(cid) { return doc(db, 'users', uid(), 'classes', cid); }
function studentsRef(cid) { return collection(db, 'users', uid(), 'classes', cid, 'students'); }
function studentRef(cid, sid) { return doc(db, 'users', uid(), 'classes', cid, 'students', sid); }
function testsRef(cid) { return collection(db, 'users', uid(), 'classes', cid, 'tests'); }
function testRef(cid, tid) { return doc(db, 'users', uid(), 'classes', cid, 'tests', tid); }
function responsesRef(cid, tid) { return collection(db, 'users', uid(), 'classes', cid, 'tests', tid, 'responses'); }
function responseRef(cid, tid, sid) { return doc(db, 'users', uid(), 'classes', cid, 'tests', tid, 'responses', sid); }

function snap(s) { return { id: s.id, ...s.data() }; }
function snaps(qs) { return qs.docs.map(snap); }

// Tests use a composite ID ("classId__docId") so getTest/updateTest/deleteTest
// can resolve the Firestore path without needing classId passed separately.
function encodeTestId(classId, docId) { return `${classId}__${docId}`; }
function decodeTestId(testId) {
  const i = testId.indexOf('__');
  return [testId.slice(0, i), testId.slice(i + 2)];
}

// Display helper — handles both new {first_name, last_name} and legacy {name}
export function studentDisplayName(s) {
  if (s && (s.first_name !== undefined || s.last_name !== undefined)) {
    return `${s.first_name || ''} ${s.last_name || ''}`.trim();
  }
  return s?.name || '';
}

// Split a full name string into first/last. Handles "Last, First" and "First Last" formats.
export function splitName(fullName) {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return { first_name: '', last_name: '' };
  if (trimmed.includes(',')) {
    const comma = trimmed.indexOf(',');
    return {
      last_name: trimmed.slice(0, comma).trim(),
      first_name: trimmed.slice(comma + 1).trim(),
    };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  return { first_name: parts.slice(0, -1).join(' '), last_name: parts[parts.length - 1] };
}

export const api = {
  // Classes
  getClasses: async () => snaps(await getDocs(classesRef())),

  getClass: async (id) => {
    const s = await getDoc(classRef(id));
    if (!s.exists()) return null;
    return { id: s.id, ...s.data() };
  },

  createClass: async (name) => {
    const ref = await addDoc(classesRef(), { name });
    return { id: ref.id, name };
  },

  updateClass: async (id, name) => {
    await updateDoc(classRef(id), { name });
    return { id, name };
  },

  deleteClass: async (id) => {
    await _deleteClassSubcollections(id);
    await deleteDoc(classRef(id));
    return { ok: true };
  },

  // Students
  getStudents: async (classId) => {
    const qs = await getDocs(studentsRef(classId));
    return snaps(qs).map(s => ({ ...s, class_id: classId }));
  },

  createStudent: async (classId, first_name, last_name, student_ref) => {
    const data = { first_name: first_name || '', last_name: last_name || '', student_ref: student_ref || '' };
    const ref = await addDoc(studentsRef(classId), data);
    return { id: ref.id, class_id: classId, ...data };
  },

  importStudents: async (classId, students) => {
    const batch = writeBatch(db);
    const results = students
      .filter(s => s.first_name || s.last_name || s.name)
      .map(s => {
        const ref = doc(studentsRef(classId));
        // Accept either new {first_name, last_name} or legacy {name}
        const data = s.first_name !== undefined
          ? { first_name: s.first_name || '', last_name: s.last_name || '', student_ref: s.student_ref || '' }
          : { ...splitName(s.name), student_ref: s.student_ref || '' };
        batch.set(ref, data);
        return { id: ref.id, class_id: classId, ...data };
      });
    await batch.commit();
    return results;
  },

  updateStudent: async (classId, studentId, first_name, last_name, student_ref) => {
    await updateDoc(studentRef(classId, studentId), {
      first_name: first_name || '',
      last_name: last_name || '',
      student_ref: student_ref || '',
    });
    return { ok: true };
  },

  deleteStudent: async (classId, studentId) => {
    await deleteDoc(studentRef(classId, studentId));
    return { ok: true };
  },

  // Fetch all test results for one student in a class
  getStudentMarks: async (classId, studentId) => {
    const testsSnap = await getDocs(testsRef(classId));
    const tests = testsSnap.docs.map(d => ({
      id: encodeTestId(classId, d.id),
      ...d.data(),
      answer_key: d.data().answer_key || [],
    }));
    const responseSnaps = await Promise.all(
      testsSnap.docs.map(d => getDoc(responseRef(classId, d.id, studentId)))
    );
    return tests.map((test, i) => {
      const answers = responseSnaps[i].exists()
        ? responseSnaps[i].data().answers
        : Array(test.num_questions).fill(null);
      const answered = answers.filter(a => a && a !== '-').length;
      const score = answers.filter((a, j) => a && test.answer_key[j] && a === test.answer_key[j]).length;
      const hasKey = test.answer_key.some(Boolean);
      return { test, answers, answered, score, hasKey };
    });
  },

  // Tests
  getTests: async (classId) => {
    const qs = await getDocs(testsRef(classId));
    return qs.docs.map(d => ({
      id: encodeTestId(classId, d.id),
      class_id: classId,
      ...d.data(),
      answer_key: d.data().answer_key || [],
    }));
  },

  getTest: async (testId) => {
    const [classId, tid] = decodeTestId(testId);
    const s = await getDoc(testRef(classId, tid));
    if (!s.exists()) throw new Error('Test not found');
    return { id: testId, class_id: classId, ...s.data(), answer_key: s.data().answer_key || [] };
  },

  createTest: async (classId, name, num_questions) => {
    const answer_key = Array(Number(num_questions)).fill(null);
    const ref = await addDoc(testsRef(classId), { name, num_questions: Number(num_questions), answer_key });
    return { id: encodeTestId(classId, ref.id), class_id: classId, name, num_questions: Number(num_questions), answer_key };
  },

  updateTest: async (testId, updates) => {
    const [classId, tid] = decodeTestId(testId);
    const data = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.num_questions !== undefined) data.num_questions = updates.num_questions;
    if (updates.answer_key !== undefined) data.answer_key = updates.answer_key;
    await updateDoc(testRef(classId, tid), data);
    return { ok: true };
  },

  deleteTest: async (testId) => {
    const [classId, tid] = decodeTestId(testId);
    const resSnap = await getDocs(responsesRef(classId, tid));
    const batch = writeBatch(db);
    resSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(testRef(classId, tid));
    await batch.commit();
    return { ok: true };
  },

  // Marks
  getMarks: async (testId) => {
    const [classId, tid] = decodeTestId(testId);
    const [testSnap, studentsSnap, responsesSnap] = await Promise.all([
      getDoc(testRef(classId, tid)),
      getDocs(studentsRef(classId)),
      getDocs(responsesRef(classId, tid)),
    ]);
    if (!testSnap.exists()) throw new Error('Test not found');
    const testData = { id: testId, class_id: classId, ...testSnap.data(), answer_key: testSnap.data().answer_key || [] };
    const responseMap = {};
    responsesSnap.docs.forEach(d => { responseMap[d.id] = d.data().answers; });
    const students = studentsSnap.docs
      .map(d => ({
        id: d.id, class_id: classId, ...d.data(),
        answers: responseMap[d.id] || Array(testData.num_questions).fill(null),
      }))
      .sort((a, b) => studentDisplayName(a).localeCompare(studentDisplayName(b)));
    return { test: testData, students };
  },

  saveMarks: async (testId, studentId, answers) => {
    const [classId, tid] = decodeTestId(testId);
    await setDoc(responseRef(classId, tid, studentId), { answers });
    return { ok: true };
  },

  // Fetch all tests + all responses for a whole class in one go
  getAllClassMarks: async (classId) => {
    const [studsSnap, testsSnap] = await Promise.all([
      getDocs(studentsRef(classId)),
      getDocs(testsRef(classId)),
    ]);
    const students = studsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => studentDisplayName(a).localeCompare(studentDisplayName(b)));
    const allResponseSnaps = await Promise.all(
      testsSnap.docs.map(d => getDocs(responsesRef(classId, d.id)))
    );
    const tests = testsSnap.docs.map((d, i) => {
      const responseMap = {};
      allResponseSnaps[i].docs.forEach(r => { responseMap[r.id] = r.data().answers; });
      return {
        id: encodeTestId(classId, d.id),
        name: d.data().name,
        num_questions: d.data().num_questions,
        answer_key: d.data().answer_key || [],
        responseMap,
      };
    });
    return { students, tests };
  },
};

async function _deleteClassSubcollections(classId) {
  const [studSnap, testsSnap] = await Promise.all([
    getDocs(studentsRef(classId)),
    getDocs(testsRef(classId)),
  ]);
  const responseSnaps = await Promise.all(
    testsSnap.docs.map(t => getDocs(responsesRef(classId, t.id)))
  );
  const batch = writeBatch(db);
  studSnap.docs.forEach(d => batch.delete(d.ref));
  testsSnap.docs.forEach((t, i) => {
    responseSnaps[i].docs.forEach(r => batch.delete(r.ref));
    batch.delete(t.ref);
  });
  await batch.commit();
}
