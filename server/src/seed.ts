import bcrypt from 'bcryptjs';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openDb, type DB } from './db.js';

// Public-domain classics, so the demo data is free to share.
const BOOKS: [string, string, string, number, number][] = [
  ['Pride and Prejudice', 'Jane Austen', 'Classic Fiction', 1813, 3],
  ['Emma', 'Jane Austen', 'Classic Fiction', 1815, 2],
  ['Frankenstein', 'Mary Shelley', 'Science Fiction', 1818, 2],
  ['Moby-Dick', 'Herman Melville', 'Adventure', 1851, 1],
  ['Great Expectations', 'Charles Dickens', 'Classic Fiction', 1861, 2],
  ['A Tale of Two Cities', 'Charles Dickens', 'Historical', 1859, 2],
  ['Alice\'s Adventures in Wonderland', 'Lewis Carroll', 'Children', 1865, 3],
  ['Little Women', 'Louisa May Alcott', 'Classic Fiction', 1868, 2],
  ['Twenty Thousand Leagues Under the Seas', 'Jules Verne', 'Science Fiction', 1870, 2],
  ['Around the World in Eighty Days', 'Jules Verne', 'Adventure', 1872, 3],
  ['The Adventures of Tom Sawyer', 'Mark Twain', 'Adventure', 1876, 2],
  ['Treasure Island', 'Robert Louis Stevenson', 'Adventure', 1883, 2],
  ['Adventures of Huckleberry Finn', 'Mark Twain', 'Adventure', 1884, 1],
  ['The Strange Case of Dr Jekyll and Mr Hyde', 'Robert Louis Stevenson', 'Horror', 1886, 2],
  ['A Study in Scarlet', 'Arthur Conan Doyle', 'Mystery', 1887, 2],
  ['The Picture of Dorian Gray', 'Oscar Wilde', 'Classic Fiction', 1890, 1],
  ['The Adventures of Sherlock Holmes', 'Arthur Conan Doyle', 'Mystery', 1892, 3],
  ['The Time Machine', 'H. G. Wells', 'Science Fiction', 1895, 2],
  ['The War of the Worlds', 'H. G. Wells', 'Science Fiction', 1898, 2],
  ['Dracula', 'Bram Stoker', 'Horror', 1897, 2],
  ['The Hound of the Baskervilles', 'Arthur Conan Doyle', 'Mystery', 1902, 2],
  ['The Call of the Wild', 'Jack London', 'Adventure', 1903, 2],
  ['Peter Pan', 'J. M. Barrie', 'Children', 1911, 2],
  ['The Secret Garden', 'Frances Hodgson Burnett', 'Children', 1911, 2],
  ['Meditations', 'Marcus Aurelius', 'Philosophy', 180, 2],
  ['The Art of War', 'Sun Tzu', 'Philosophy', 500, 2],
  ['The Prince', 'Niccolo Machiavelli', 'Philosophy', 1532, 1],
  ['The Wealth of Nations', 'Adam Smith', 'Economics', 1776, 1],
  ['On the Origin of Species', 'Charles Darwin', 'Science', 1859, 1],
  ['Relativity: The Special and General Theory', 'Albert Einstein', 'Science', 1916, 1],
];

const USERS: [string, string, 'admin' | 'member'][] = [
  ['Library Admin', 'admin@demo.local', 'admin'],
  ['Sari Member', 'sari@demo.local', 'member'],
  ['Budi Member', 'budi@demo.local', 'member'],
  ['Rina Member', 'rina@demo.local', 'member'],
];

export function seed(db: DB, password = 'demo1234'): void {
  const hash = bcrypt.hashSync(password, 10);
  db.transaction(() => {
    db.exec('DELETE FROM loans; DELETE FROM books; DELETE FROM users;');
    const addUser = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
    for (const [name, email, role] of USERS) addUser.run(name, email, hash, role);
    const addBook = db.prepare('INSERT INTO books (title, author, category, year, copies) VALUES (?, ?, ?, ?, ?)');
    for (const b of BOOKS) addBook.run(...b);

    // A few months of loan history so the dashboard has something to show.
    const addLoan = db.prepare('INSERT INTO loans (book_id, user_id, borrowed_at, due_at, returned_at) VALUES (?, ?, ?, ?, ?)');
    const day = 86_400_000;
    const now = Date.now();
    let n = 0;
    for (let daysAgo = 170; daysAgo >= 20; daysAgo -= 4) {
      const borrowed = now - daysAgo * day;
      addLoan.run((n % BOOKS.length) + 1, (n % 3) + 2, new Date(borrowed).toISOString(),
        new Date(borrowed + 14 * day).toISOString(), new Date(borrowed + ((n % 10) + 3) * day).toISOString());
      n += 7;
    }
    // Open loans: two on time, one overdue.
    addLoan.run(17, 2, new Date(now - 3 * day).toISOString(), new Date(now + 11 * day).toISOString(), null);
    addLoan.run(1, 3, new Date(now - 6 * day).toISOString(), new Date(now + 8 * day).toISOString(), null);
    addLoan.run(18, 4, new Date(now - 20 * day).toISOString(), new Date(now - 6 * day).toISOString(), null);
  })();
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  const file = process.env.DB_FILE ?? 'data/library.db';
  mkdirSync(dirname(file), { recursive: true });
  seed(openDb(file));
  console.log(`Seeded ${file}. Sign in as admin@demo.local or sari@demo.local, password demo1234.`);
}
