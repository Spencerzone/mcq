import React, { createContext, useContext, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <nav>
      <Link to="/" className="logo">MCQ Marking</Link>
      <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{user}</span>
      <button onClick={() => { logout(); navigate('/login'); }}>Log out</button>
    </nav>
  );
}

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [user, setUser] = useState(() => localStorage.getItem('username'));

  function login(token, username) {
    localStorage.setItem('token', token);
    localStorage.setItem('username', username);
    setUser(username);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <BrowserRouter>
        <Nav />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/classes/:classId" element={<PrivateRoute><ClassView /></PrivateRoute>} />
          <Route path="/tests/:testId/setup" element={<PrivateRoute><TestSetup /></PrivateRoute>} />
          <Route path="/tests/:testId/mark" element={<PrivateRoute><MarkingView /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
