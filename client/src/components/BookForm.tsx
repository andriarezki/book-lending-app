import { useState, type FormEvent } from 'react';
import type { Book, BookInput } from '../lib/api';

interface Props {
  initial?: Book;
  onSave: (b: BookInput) => Promise<unknown>;
  onCancel: () => void;
}

export default function BookForm({ initial, onSave, onCancel }: Props) {
  const [form, setForm] = useState<BookInput>({
    title: initial?.title ?? '',
    author: initial?.author ?? '',
    category: initial?.category ?? '',
    year: initial?.year ?? null,
    copies: initial?.copies ?? 1,
  });
  const [error, setError] = useState('');
  const set = <K extends keyof BookInput>(k: K, v: BookInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  return (
    <div className="modal-bg" onClick={onCancel}>
      <form className="card modal" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Edit book' : 'Add book'}</h2>
        <label>Title<input value={form.title} onChange={(e) => set('title', e.target.value)} required /></label>
        <label>Author<input value={form.author} onChange={(e) => set('author', e.target.value)} required /></label>
        <label>Category<input value={form.category} onChange={(e) => set('category', e.target.value)} required /></label>
        <div className="row">
          <label>Year<input type="number" value={form.year ?? ''} onChange={(e) => set('year', e.target.value ? Number(e.target.value) : null)} /></label>
          <label>Copies<input type="number" min={0} value={form.copies} onChange={(e) => set('copies', Number(e.target.value))} required /></label>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button className="primary">Save</button>
        </div>
      </form>
    </div>
  );
}
