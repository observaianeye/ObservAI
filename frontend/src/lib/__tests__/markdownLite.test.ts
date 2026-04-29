/**
 * Yan #56 coverage: markdownLite renderer transforms the limited set of
 * markdown markers the chatbot LLM emits, and HTML-escapes everything
 * else (XSS guard).
 *
 * NOTE: frontend currently has no vitest runner configured (pnpm test
 * runs Playwright e2e). This file uses node:test API so it runs under
 * `node --test --import tsx/esm src/lib/__tests__/markdownLite.test.ts`
 * without adding a vitest dependency. The describe/it shape also matches
 * vitest naming conventions so it will pick up automatically once a
 * frontend vitest config lands.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLiteToHtml } from '../markdownLite';

describe('Yan #56 — markdownLiteToHtml', () => {
  it('transforms **bold** into <strong>', () => {
    const out = markdownLiteToHtml('hello **world** there');
    assert.match(out, /<strong>world<\/strong>/);
    assert.ok(!out.includes('**'));
  });

  it('escapes raw HTML / script tags so XSS payloads cannot reach the DOM', () => {
    const malicious = '<script>alert(1)</script> and <img src=x onerror=alert(2)>';
    const out = markdownLiteToHtml(malicious);
    // Raw <script> and <img> tags must NOT survive intact.
    assert.ok(!out.includes('<script>'));
    assert.ok(!out.includes('<img'));
    // Their textual representation should be escaped.
    assert.match(out, /&lt;script&gt;/);
    assert.match(out, /&lt;img/);
  });

  it('handles mixed markdown + paragraph breaks', () => {
    const src = 'Hello **world**\n\nNew line *italic* end';
    const out = markdownLiteToHtml(src);
    assert.match(out, /<strong>world<\/strong>/);
    assert.match(out, /<br\/><br\/>/);
    assert.match(out, /<em>italic<\/em>/);
  });

  // Faz 8 polish: inline code + auto-linking
  it('renders inline `code` as <code> with utility classes', () => {
    const out = markdownLiteToHtml('try `npm test` to run');
    assert.match(out, /<code[^>]*>npm test<\/code>/);
  });

  it('inline code does not get further bold/italic transformation', () => {
    const out = markdownLiteToHtml('use `**not-bold**` here');
    // The asterisks inside the code span must survive as text
    assert.match(out, /<code[^>]*>\*\*not-bold\*\*<\/code>/);
    // No <strong> from the asterisks inside the code block
    assert.ok(!out.includes('<strong>not-bold</strong>'));
  });

  it('auto-links bare http(s) URLs with rel=noopener', () => {
    const out = markdownLiteToHtml('see https://example.com/x for details');
    assert.match(out, /<a href="https:\/\/example.com\/x"[^>]*rel="noopener noreferrer"/);
    assert.match(out, /target="_blank"/);
  });
});
