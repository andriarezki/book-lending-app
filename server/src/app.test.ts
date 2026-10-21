import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, MAX_OPEN_LOANS } from './app.js';
import { openDb } from './db.js';
import { seed } from './seed.js';

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  const db = openDb(':memory:');
  seed(db, 'pw');
  app = createApp(db);
});

async function login(email: string) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password: 'pw' }).expect(200);
  return agent;
}

describe('auth', () => {
  it('rejects a wrong password', async () => {
    await request(app).post('/api/auth/login').send({ email: 'admin@demo.local', password: 'nope' }).expect(401);
  });
  it('blocks the API without a session', async () => {
    await request(app).get('/api/books').expect(401);
  });
});

describe('books', () => {
  it('searches by title or author', async () => {
    const member = await login('sari@demo.local');
    const res = await member.get('/api/books?q=verne').expect(200);
    expect(res.body).toHaveLength(2);
  });
  it('only lets admins add books', async () => {
    const book = { title: 'Test', author: 'Someone', category: 'Test', year: 2020, copies: 1 };
    await (await login('sari@demo.local')).post('/api/books').send(book).expect(403);
    const res = await (await login('admin@demo.local')).post('/api/books').send(book).expect(201);
    expect(res.body.available).toBe(1);
  });
  it('validates input', async () => {
    const admin = await login('admin@demo.local');
    await admin.post('/api/books').send({ title: '', author: 'x', category: 'x' }).expect(400);
  });
});

describe('loans', () => {
  it('borrows and returns a book, updating availability', async () => {
    const member = await login('rina@demo.local');
    const before = (await member.get('/api/books?q=Treasure')).body[0];
    const loan = (await member.post('/api/loans').send({ bookId: before.id }).expect(201)).body;
    const during = (await member.get('/api/books?q=Treasure')).body[0];
    expect(during.available).toBe(before.available - 1);
    await member.post(`/api/loans/${loan.id}/return`).expect(200);
    await member.post(`/api/loans/${loan.id}/return`).expect(409);
  });
  it('refuses when no copies are left', async () => {
    const member = await login('rina@demo.local');
    const moby = (await member.get('/api/books?q=Moby')).body[0];
    await member.post('/api/loans').send({ bookId: moby.id }).expect(201);
    await (await login('budi@demo.local')).post('/api/loans').send({ bookId: moby.id }).expect(409);
  });
  it(`caps open loans at ${MAX_OPEN_LOANS}`, async () => {
    const member = await login('budi@demo.local'); // already has 1 open loan from the seed
    const books = (await member.get('/api/books?available=1')).body as { id: number }[];
    const ids = books.map((b) => b.id).filter((id) => id !== 1);
    for (let i = 0; i < MAX_OPEN_LOANS - 1; i++) await member.post('/api/loans').send({ bookId: ids[i] }).expect(201);
    await member.post('/api/loans').send({ bookId: ids[MAX_OPEN_LOANS] }).expect(409);
  });
  it('stops members returning someone else\'s loan', async () => {
    const sari = await login('sari@demo.local');
    const loans = (await (await login('admin@demo.local')).get('/api/loans')).body as { id: number; user_id: number; returned_at: string | null }[];
    const other = loans.find((l) => l.user_id !== 2 && !l.returned_at)!;
    await sari.post(`/api/loans/${other.id}/return`).expect(403);
  });
});

describe('dashboard', () => {
  it('reports totals and overdue loans for admins only', async () => {
    await (await login('sari@demo.local')).get('/api/stats').expect(403);
    const stats = (await (await login('admin@demo.local')).get('/api/stats').expect(200)).body;
    expect(stats.titles).toBe(30);
    expect(stats.onLoan).toBe(3);
    expect(stats.overdue).toBe(1);
  });
});
