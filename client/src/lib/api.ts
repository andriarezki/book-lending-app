export type Role = 'admin' | 'member';

export interface User {
  id: number;
  name: string;
  role: Role;
}

export interface Book {
  id: number;
  title: string;
  author: string;
  category: string;
  year: number | null;
  copies: number;
  available: number;
}

export type BookInput = Omit<Book, 'id' | 'available'>;

export interface Loan {
  id: number;
  book_id: number;
  user_id: number;
  title: string;
  author: string;
  member: string;
  borrowed_at: string;
  due_at: string;
  returned_at: string | null;
  overdue: boolean;
}

export interface Stats {
  titles: number;
  copies: number;
  members: number;
  onLoan: number;
  overdue: number;
  perMonth: { month: string; loans: number }[];
  topCategories: { category: string; loans: number }[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: string }).error ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export const api = {
  me: () => call<User>('GET', '/auth/me'),
  login: (email: string, password: string) => call<User>('POST', '/auth/login', { email, password }),
  logout: () => call<void>('POST', '/auth/logout'),
  books: (params: { q?: string; category?: string; available?: boolean }) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.category) qs.set('category', params.category);
    if (params.available) qs.set('available', '1');
    return call<Book[]>('GET', `/books?${qs}`);
  },
  categories: () => call<string[]>('GET', '/books/categories'),
  addBook: (b: BookInput) => call<Book>('POST', '/books', b),
  updateBook: (id: number, b: BookInput) => call<Book>('PUT', `/books/${id}`, b),
  deleteBook: (id: number) => call<void>('DELETE', `/books/${id}`),
  loans: (mine = false) => call<Loan[]>('GET', `/loans${mine ? '?mine=1' : ''}`),
  borrow: (bookId: number) => call<Loan>('POST', '/loans', { bookId }),
  returnLoan: (id: number) => call<Loan>('POST', `/loans/${id}/return`),
  stats: () => call<Stats>('GET', '/stats'),
  users: () => call<(User & { email: string })[]>('GET', '/users'),
};

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
