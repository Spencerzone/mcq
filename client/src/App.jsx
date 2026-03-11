import React, { createContext, useContext, useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ClassView from './pages/ClassView.jsx';
import TestSetup from './pages/TestSetup.jsx';
import MarkingView from './pages/MarkingView.jsx';

export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function Nav() {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  async function handleLogout() {
    await signOut(auth);
    navigate('/login');
  }

  return (
    <nav>
      <Link to="/" className="logo">MCQ Marking</Link>
      <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{user.email}</span>
      <button onClick={handleLogout}>Log out</button>
    </nav>
  );
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      <HashRouter>
        <Nav />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/classes/:classId" element={<PrivateRoute><ClassView /></PrivateRoute>} />
          <Route path="/tests/:testId/setup" element={<PrivateRoute><TestSetup /></PrivateRoute>} />
          <Route path="/tests/:testId/mark" element={<PrivateRoute><MarkingView /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthContext.Provider>
  );
}
