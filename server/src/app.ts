import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { clearSession, readSession, requireAuth, requireRole, setSession } from './auth.js';
import type { BookRow, DB, LoanRow, UserRow } from './db.js';

export const LOAN_DAYS = 14;
export const MAX_OPEN_LOANS = 3;

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const bookSchema = z.object({
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60),
  year: z.number().int().min(1000).max(2100).nullable().default(null),
  copies: z.number().int().min(0).max(999).default(1),
});
const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  available: z.enum(['1', '0']).optional(),
});
const idParam = z.coerce.number().int().positive();

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type BookWithStock = BookRow & { available: number };

const BOOK_SELECT = `
  SELECT b.*, b.copies - COALESCE(o.open, 0) AS available
  FROM books b
  LEFT JOIN (SELECT book_id, COUNT(*) AS open FROM loans WHERE returned_at IS NULL GROUP BY book_id) o
    ON o.book_id = b.id`;

export function createApp(db: DB) {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(readSession);

  const findBook = (id: number): BookWithStock => {
    const book = db.prepare(`${BOOK_SELECT} WHERE b.id = ?`).get(id) as BookWithStock | undefined;
    if (!book) throw new HttpError(404, 'Book not found.');
    return book;
  };

  // ---- auth
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as UserRow | undefined;
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      throw new HttpError(401, 'Wrong email or password.');
    }
    const session = { id: user.id, name: user.name, role: user.role };
    setSession(res, session);
    res.json(session);
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSession(res);
    res.status(204).end();
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json(req.user);
  });

  // ---- books
  app.get('/api/books', requireAuth, (req, res) => {
    const { q, category, available } = listQuery.parse(req.query);
    const where: string[] = [];
    const args: (string | number)[] = [];
    if (q) {
      where.push('(b.title LIKE ? OR b.author LIKE ?)');
      args.push(`%${q}%`, `%${q}%`);
    }
    if (category) {
      where.push('b.category = ?');
      args.push(category);
    }
    let sql = BOOK_SELECT + (where.length ? ` WHERE ${where.join(' AND ')}` : '');
    if (available === '1') sql = `SELECT * FROM (${sql}) WHERE available > 0`;
    res.json(db.prepare(`${sql} ORDER BY title`).all(...args));
  });

  app.get('/api/books/categories', requireAuth, (_req, res) => {
    const rows = db.prepare('SELECT DISTINCT category FROM books ORDER BY category').all() as { category: string }[];
    res.json(rows.map((r) => r.category));
  });

  app.post('/api/books', requireAuth, requireRole('admin'), (req, res) => {
    const b = bookSchema.parse(req.body);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO books (title, author, category, year, copies) VALUES (?, ?, ?, ?, ?)')
      .run(b.title, b.author, b.category, b.year, b.copies);
    res.status(201).json(findBook(Number(lastInsertRowid)));
  });

  app.put('/api/books/:id', requireAuth, requireRole('admin'), (req, res) => {
    const id = idParam.parse(req.params.id);
    const current = findBook(id);
    const b = bookSchema.parse(req.body);
    const onLoan = current.copies - current.available;
    if (b.copies < onLoan) throw new HttpError(409, `${onLoan} copies are on loan; copies cannot go below that.`);
    db.prepare('UPDATE books SET title = ?, author = ?, category = ?, year = ?, copies = ? WHERE id = ?')
      .run(b.title, b.author, b.category, b.year, b.copies, id);
    res.json(findBook(id));
  });

  app.delete('/api/books/:id', requireAuth, requireRole('admin'), (req, res) => {
    const book = findBook(idParam.parse(req.params.id));
    if (book.available < book.copies) throw new HttpError(409, 'This book is still on loan.');
    db.prepare('DELETE FROM books WHERE id = ?').run(book.id);
    res.status(204).end();
  });

  // ---- loans
  app.get('/api/loans', requireAuth, (req, res) => {
    const mine = req.user!.role !== 'admin' || req.query.mine === '1';
    const rows = db
      .prepare(
        `SELECT l.*, b.title, b.author, u.name AS member,
                (l.returned_at IS NULL AND l.due_at < ?) AS overdue
         FROM loans l JOIN books b ON b.id = l.book_id JOIN users u ON u.id = l.user_id
         ${mine ? 'WHERE l.user_id = ?' : ''}
         ORDER BY l.returned_at IS NOT NULL, l.due_at`,
      )
      .all(...(mine ? [new Date().toISOString(), req.user!.id] : [new Date().toISOString()])) as (LoanRow & { overdue: number })[];
    res.json(rows.map((r) => ({ ...r, overdue: r.overdue === 1 })));
  });

  const borrow = db.transaction((bookId: number, userId: number) => {
    const book = findBook(bookId);
    if (book.available <= 0) throw new HttpError(409, 'No copies available right now.');
    const { open } = db
      .prepare('SELECT COUNT(*) AS open FROM loans WHERE user_id = ? AND returned_at IS NULL')
      .get(userId) as { open: number };
    if (open >= MAX_OPEN_LOANS) throw new HttpError(409, `You can borrow at most ${MAX_OPEN_LOANS} books at a time.`);
    const dup = db.prepare('SELECT 1 FROM loans WHERE user_id = ? AND book_id = ? AND returned_at IS NULL').get(userId, bookId);
    if (dup) throw new HttpError(409, 'You already have this book.');
    const now = new Date();
    const due = new Date(now.getTime() + LOAN_DAYS * 86_400_000);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO loans (book_id, user_id, borrowed_at, due_at) VALUES (?, ?, ?, ?)')
      .run(bookId, userId, now.toISOString(), due.toISOString());
    return db.prepare('SELECT * FROM loans WHERE id = ?').get(lastInsertRowid) as LoanRow;
  });

  app.post('/api/loans', requireAuth, (req, res) => {
    const { bookId } = z.object({ bookId: z.number().int().positive() }).parse(req.body);
    res.status(201).json(borrow(bookId, req.user!.id));
  });

  app.post('/api/loans/:id/return', requireAuth, (req, res) => {
    const id = idParam.parse(req.params.id);
    const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(id) as LoanRow | undefined;
    if (!loan) throw new HttpError(404, 'Loan not found.');
    if (req.user!.role !== 'admin' && loan.user_id !== req.user!.id) throw new HttpError(403, 'This is not your loan.');
    if (loan.returned_at) throw new HttpError(409, 'This book was already returned.');
    db.prepare('UPDATE loans SET returned_at = ? WHERE id = ?').run(new Date().toISOString(), id);
    res.json(db.prepare('SELECT * FROM loans WHERE id = ?').get(id));
  });

  // ---- dashboard
  app.get('/api/stats', requireAuth, requireRole('admin'), (_req, res) => {
    const now = new Date().toISOString();
    const one = <T>(sql: string, ...a: unknown[]) => db.prepare(sql).get(...a) as T;
    res.json({
      titles: one<{ n: number }>('SELECT COUNT(*) AS n FROM books').n,
      copies: one<{ n: number }>('SELECT COALESCE(SUM(copies), 0) AS n FROM books').n,
      members: one<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'member'").n,
      onLoan: one<{ n: number }>('SELECT COUNT(*) AS n FROM loans WHERE returned_at IS NULL').n,
      overdue: one<{ n: number }>('SELECT COUNT(*) AS n FROM loans WHERE returned_at IS NULL AND due_at < ?', now).n,
      perMonth: db
        .prepare("SELECT substr(borrowed_at, 1, 7) AS month, COUNT(*) AS loans FROM loans GROUP BY month ORDER BY month DESC LIMIT 6")
        .all()
        .reverse(),
      topCategories: db
        .prepare('SELECT b.category, COUNT(*) AS loans FROM loans l JOIN books b ON b.id = l.book_id GROUP BY b.category ORDER BY loans DESC LIMIT 5')
        .all(),
    });
  });

  app.get('/api/users', requireAuth, requireRole('admin'), (_req, res) => {
    res.json(db.prepare('SELECT id, name, email, role FROM users ORDER BY name').all());
  });

  // ---- errors
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input.', details: err.flatten().fieldErrors });
    } else if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  });

  return app;
}
