import { spawnSync } from 'child_process';

const DB_PATH = 'C:/Users/Gaming/Desktop/Project/ObservAI/backend/prisma/dev.db';
const BACKEND_CWD = 'C:/Users/Gaming/Desktop/Project/ObservAI/backend';

const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|replace|attach|detach)\b/i;

export interface QueryResult {
  ok: boolean;
  rows: Record<string, unknown>[];
  raw: string;
  error?: string;
  driver?: 'sqlite3' | 'prisma' | 'none';
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const split = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === ',' && !inQ) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  };
  const header = split(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = split(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = cells[i] ?? '';
    });
    return row;
  });
}

function trySqlite3(sql: string): QueryResult | null {
  const proc = spawnSync('sqlite3', ['-readonly', '-header', '-csv', DB_PATH, sql], {
    encoding: 'utf8',
    timeout: 10_000,
  });
  if (proc.error) return null;
  if (proc.status !== 0) return { ok: false, rows: [], raw: proc.stdout ?? '', error: `sqlite3 exit ${proc.status}: ${proc.stderr}`, driver: 'sqlite3' };
  return { ok: true, rows: parseCsv(proc.stdout ?? ''), raw: proc.stdout ?? '', driver: 'sqlite3' };
}

function tryPrisma(sql: string): QueryResult {
  const escaped = sql.replace(/`/g, '\\`').replace(/\$/g, '\\$');
  // Yan #52: Prisma $queryRawUnsafe returns BigInt for SQLite INTEGER columns
  // wider than 32-bit. JSON.stringify throws on BigInt, so the inline node
  // helper now uses a reviver that downcasts bigint -> Number. Numbers > 2^53
  // are vanishingly rare for our id/timestamp columns; if a future column
  // grows past that bound the helper should be re-audited.
  const code = `const{PrismaClient}=require('@prisma/client');const c=new PrismaClient();c.$queryRawUnsafe(\`${escaped}\`).then(r=>{process.stdout.write(JSON.stringify(r,(_k,v)=>typeof v==='bigint'?Number(v):v));return c.$disconnect();}).catch(e=>{process.stderr.write(String(e));return c.$disconnect().then(()=>process.exit(1));});`;
  const proc = spawnSync('node', ['-e', code], {
    cwd: BACKEND_CWD,
    encoding: 'utf8',
    timeout: 15_000,
    env: { ...process.env, DATABASE_URL: 'file:./prisma/dev.db' },
  });
  if (proc.error) {
    return { ok: false, rows: [], raw: '', error: `node spawn failed: ${proc.error.message}`, driver: 'prisma' };
  }
  if (proc.status !== 0) {
    return { ok: false, rows: [], raw: proc.stdout ?? '', error: `prisma exit ${proc.status}: ${proc.stderr}`, driver: 'prisma' };
  }
  try {
    const parsed = JSON.parse(proc.stdout ?? '[]');
    return { ok: true, rows: Array.isArray(parsed) ? parsed : [], raw: proc.stdout ?? '', driver: 'prisma' };
  } catch (e) {
    return { ok: false, rows: [], raw: proc.stdout ?? '', error: `parse failed: ${String(e)}`, driver: 'prisma' };
  }
}

export function querySqlite(sql: string): QueryResult {
  if (FORBIDDEN.test(sql)) {
    throw new Error(`querySqlite: write op detected, READ-ONLY only. SQL=${sql}`);
  }
  const s = trySqlite3(sql);
  if (s !== null && s.ok) return s;
  return tryPrisma(sql);
}
