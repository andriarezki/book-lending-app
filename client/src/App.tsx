import type { ReactElement } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Catalogue from './pages/Catalogue';
import Dashboard from './pages/Dashboard';
import Loans from './pages/Loans';
import Login from './pages/Login';
import Members from './pages/Members';

function AdminOnly({ children }: { children: ReactElement }) {
  const { user } = useAuth();
  return user?.role === 'admin' ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { user, loading, logout } = useAuth();
  if (loading) return <div className="center muted">Loading…</div>;
  if (!user) return <Login />;
  const admin = user.role === 'admin';

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">📚 Book Lending</span>
        <nav>
          {admin && <NavLink to="/dashboard">Dashboard</NavLink>}
          <NavLink to="/" end>Catalogue</NavLink>
          <NavLink to="/loans">{admin ? 'Loans' : 'My loans'}</NavLink>
          {admin && <NavLink to="/members">Members</NavLink>}
        </nav>
        <span className="who">
          {user.name} <small className="tag">{user.role}</small>
          <button className="link" onClick={() => void logout()}>Sign out</button>
        </span>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Catalogue />} />
          <Route path="/loans" element={<Loans />} />
          <Route path="/dashboard" element={<AdminOnly><Dashboard /></AdminOnly>} />
          <Route path="/members" element={<AdminOnly><Members /></AdminOnly>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
