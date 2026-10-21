import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import BookForm from '../components/BookForm';
import { api, type Book, type BookInput } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Catalogue() {
  const { user } = useAuth();
  const admin = user?.role === 'admin';
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [editing, setEditing] = useState<Book | 'new' | null>(null);
  const [notice, setNotice] = useState('');
  const query = useDeferredValue(q);

  const books = useQuery({
    queryKey: ['books', query, category, onlyAvailable],
    queryFn: () => api.books({ q: query, category, available: onlyAvailable }),
  });
  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['books'] });
    void qc.invalidateQueries({ queryKey: ['categories'] });
    void qc.invalidateQueries({ queryKey: ['loans'] });
  };
  const borrow = useMutation({
    mutationFn: api.borrow,
    onSuccess: () => { setNotice('Borrowed. Find it under My loans.'); refresh(); },
    onError: (e) => setNotice(e.message),
  });
  const remove = useMutation({
    mutationFn: api.deleteBook,
    onSuccess: refresh,
    onError: (e) => setNotice(e.message),
  });

  async function save(input: BookInput) {
    if (editing === 'new') await api.addBook(input);
    else if (editing) await api.updateBook(editing.id, input);
    setEditing(null);
    refresh();
  }

  return (
    <section>
      <div className="head">
        <h1>Catalogue</h1>
        {admin && <button className="primary" onClick={() => setEditing('new')}>+ Add book</button>}
      </div>
      <div className="filters">
        <input className="search" type="search" placeholder="Search title or author…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.data?.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} /> Available only</label>
      </div>
      {notice && <p className="notice" onClick={() => setNotice('')}>{notice}</p>}
      {books.isLoading ? <p className="muted">Loading…</p> : (
        <table>
          <thead><tr><th>Title</th><th>Author</th><th>Category</th><th>Year</th><th>Available</th><th /></tr></thead>
          <tbody>
            {books.data?.map((b) => (
              <tr key={b.id}>
                <td className="strong">{b.title}</td>
                <td>{b.author}</td>
                <td><span className="pill">{b.category}</span></td>
                <td>{b.year ?? '–'}</td>
                <td><span className={b.available > 0 ? 'ok' : 'bad'}>{b.available} / {b.copies}</span></td>
                <td className="actions">
                  <button disabled={b.available === 0 || borrow.isPending} onClick={() => borrow.mutate(b.id)}>Borrow</button>
                  {admin && <button onClick={() => setEditing(b)}>Edit</button>}
                  {admin && <button className="danger" onClick={() => confirm(`Delete "${b.title}"?`) && remove.mutate(b.id)}>Delete</button>}
                </td>
              </tr>
            ))}
            {books.data?.length === 0 && <tr><td colSpan={6} className="muted">No books match your search.</td></tr>}
          </tbody>
        </table>
      )}
      {editing && <BookForm initial={editing === 'new' ? undefined : editing} onSave={save} onCancel={() => setEditing(null)} />}
    </section>
  );
}
