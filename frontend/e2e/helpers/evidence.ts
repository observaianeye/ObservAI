import * as fs from 'fs';
import * as path from 'path';
import type { Page, ConsoleMessage, Request, Response } from '@playwright/test';

export const SHOTS_ROOT = 'C:/Users/Gaming/Desktop/Project/ObservAI/test-results/screenshots';

export interface ConsoleEntry {
  type: string;
  text: string;
  ts: number;
}

export interface RequestEntry {
  url: string;
  method: string;
  ts: number;
}

export interface ResponseEntry {
  url: string;
  status: number;
  ok: boolean;
  ts: number;
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function dirFor(testId: string): string {
  const dir = path.join(SHOTS_ROOT, testId);
  ensureDir(dir);
  return dir;
}

export async function captureScreenshot(page: Page, testId: string, label: string): Promise<string> {
  const dir = dirFor(testId);
  const file = path.join(dir, `${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

export function attachConsole(page: Page): { get: () => ConsoleEntry[] } {
  const arr: ConsoleEntry[] = [];
  page.on('console', (m: ConsoleMessage) => {
    arr.push({ type: m.type(), text: m.text(), ts: Date.now() });
  });
  page.on('pageerror', (e) => {
    arr.push({ type: 'pageerror', text: String(e), ts: Date.now() });
  });
  return { get: () => arr };
}

export function attachNetwork(page: Page): {
  getRequests: () => RequestEntry[];
  getResponses: () => ResponseEntry[];
} {
  const reqs: RequestEntry[] = [];
  const resps: ResponseEntry[] = [];
  page.on('request', (r: Request) => {
    reqs.push({ url: r.url(), method: r.method(), ts: Date.now() });
  });
  page.on('response', (r: Response) => {
    resps.push({ url: r.url(), status: r.status(), ok: r.ok(), ts: Date.now() });
  });
  return { getRequests: () => reqs, getResponses: () => resps };
}

export interface EvidenceParts {
  console?: ConsoleEntry[];
  requests?: RequestEntry[];
  responses?: ResponseEntry[];
  db?: unknown;
  notes?: unknown;
}

export async function saveEvidence(testId: string, parts: EvidenceParts): Promise<void> {
  const dir = dirFor(testId);
  if (parts.console) {
    fs.writeFileSync(path.join(dir, 'console.json'), JSON.stringify(parts.console, null, 2));
  }
  if (parts.requests || parts.responses) {
    fs.writeFileSync(
      path.join(dir, 'network.json'),
      JSON.stringify({ requests: parts.requests ?? [], responses: parts.responses ?? [] }, null, 2)
    );
  }
  if (parts.db !== undefined) {
    fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify(parts.db, null, 2));
  }
  if (parts.notes !== undefined) {
    fs.writeFileSync(path.join(dir, 'notes.json'), JSON.stringify(parts.notes, null, 2));
  }
}
