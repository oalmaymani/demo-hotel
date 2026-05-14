import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import morgan from 'morgan';

import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';

const app = express();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const uploadsDir = path.resolve('uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors({ origin: ORIGIN, credentials: false }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));
app.use('/uploads', express.static(uploadsDir));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.use('/api/public', publicRouter);
app.use('/api/admin', adminRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Backend listening on :${PORT}`);
});
