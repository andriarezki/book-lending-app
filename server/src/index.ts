import express from 'express';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openDb } from './db.js';
import { seed } from './seed.js';

const file = process.env.DB_FILE ?? 'data/library.db';
mkdirSync(dirname(file), { recursive: true });
const fresh = !existsSync(file);
const db = openDb(file);
if (fresh) seed(db);

const app = createApp(db);

// In production the API also serves the built React app.
const clientDist = resolve(dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(resolve(clientDist, 'index.html')));
}

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Book Lending App on http://localhost:${port}`));
