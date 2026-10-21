import Database from 'better-sqlite3';

export type Role = 'admin' | 'member';

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
}

export interface BookRow {
  id: number;
  title: string;
  author: string;
  category: string;
  year: number | null;
  copies: number;
}

export interface LoanRow {
  id: number;
  book_id: number;
  user_id: number;
  borrowed_at: string;
  due_at: string;
  returned_at: string | null;
}

export type DB = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member'))
);
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT NOT NULL,
  year INTEGER,
  copies INTEGER NOT NULL DEFAULT 1 CHECK (copies >= 0)
);
CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  borrowed_at TEXT NOT NULL,
  due_at TEXT NOT NULL,
  returned_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_loans_open ON loans(book_id) WHERE returned_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
`;

export function openDb(file = process.env.DB_FILE ?? 'data/library.db'): DB {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
