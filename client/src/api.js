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
    const qs = await getDocs(query(studentsRef(classId), orderBy('name')));
    return snaps(qs).map(s => ({ ...s, class_id: classId }));
  },

  createStudent: async (classId, name, student_ref) => {
    const ref = await addDoc(studentsRef(classId), { name, student_ref: student_ref || '' });
    return { id: ref.id, class_id: classId, name, student_ref: student_ref || '' };
  },

  importStudents: async (classId, students) => {
    const batch = writeBatch(db);
    const results = students.filter(s => s.name).map(s => {
      const ref = doc(studentsRef(classId));
      batch.set(ref, { name: s.name, student_ref: s.student_ref || '' });
      return { id: ref.id, class_id: classId, name: s.name, student_ref: s.student_ref || '' };
    });
    await batch.commit();
    return results;
  },

  updateStudent: async (classId, studentId, name, student_ref) => {
    await updateDoc(studentRef(classId, studentId), { name, student_ref: student_ref || '' });
    return { ok: true };
  },

  deleteStudent: async (classId, studentId) => {
    await deleteDoc(studentRef(classId, studentId));
    return { ok: true };
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
      getDocs(query(studentsRef(classId), orderBy('name'))),
      getDocs(responsesRef(classId, tid)),
    ]);
    if (!testSnap.exists()) throw new Error('Test not found');
    const testData = { id: testId, class_id: classId, ...testSnap.data(), answer_key: testSnap.data().answer_key || [] };
    const responseMap = {};
    responsesSnap.docs.forEach(d => { responseMap[d.id] = d.data().answers; });
    const students = studentsSnap.docs.map(d => ({
      id: d.id, class_id: classId, ...d.data(),
      answers: responseMap[d.id] || Array(testData.num_questions).fill(null),
    }));
    return { test: testData, students };
  },

  saveMarks: async (testId, studentId, answers) => {
    const [classId, tid] = decodeTestId(testId);
    await setDoc(responseRef(classId, tid, studentId), { answers });
    return { ok: true };
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
