import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Dashboard() {
  const [classes, setClasses] = useState([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.getClasses();
      setClasses(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function createClass(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const cls = await api.createClass(newName.trim());
      setClasses(prev => [...prev, cls]);
      setNewName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function deleteClass(id) {
    if (!confirm('Delete this class and all its students and tests?')) return;
    try {
      await api.deleteClass(id);
      setClasses(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="page"><p>Loading...</p></div>;

  return (
    <div className="page container">
      <div className="page-header">
        <h1>My Classes</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <form onSubmit={createClass} className="flex gap-1 items-center">
          <input
            className="flex-1"
            style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6 }}
            placeholder="New class name (e.g. Year 10 Maths)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={creating}>
            + Add Class
          </button>
        </form>
      </div>

      {classes.length === 0 ? (
        <div className="empty">
          <div style={{ fontSize: '3rem' }}>📚</div>
          <p>No classes yet. Create your first class above.</p>
        </div>
      ) : (
        <div>
          {classes.map(cls => (
            <div key={cls.id} className="card flex items-center justify-between" style={{ cursor: 'default' }}>
              <div>
                <Link to={`/classes/${cls.id}`} style={{ fontWeight: 600, fontSize: '1.05rem', color: '#4f46e5', textDecoration: 'none' }}>
                  {cls.name}
                </Link>
              </div>
              <div className="flex gap-1">
                <Link to={`/classes/${cls.id}`} className="btn btn-secondary btn-sm">Open</Link>
                <button className="btn btn-danger btn-sm" onClick={() => deleteClass(cls.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
