import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@demo.local');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="card login" onSubmit={submit}>
        <h1>📚 Book Lending</h1>
        <p className="muted">Sign in to browse and borrow books.</p>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="hint">Demo: <code>admin@demo.local</code> or <code>sari@demo.local</code>, password <code>demo1234</code></p>
      </form>
    </div>
  );
}
