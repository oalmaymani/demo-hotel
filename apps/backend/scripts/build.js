import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function rimraf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

rimraf('dist');
fs.mkdirSync('dist', { recursive: true });

// naive copy for ESM node
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

copyDir('src', 'dist');

console.log('Build OK (copied src -> dist).');
console.log('Reminder: migrations run in docker compose init.');
