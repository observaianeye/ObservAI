import { describe, it, expect } from 'vitest';
import { renderHistoryForPrompt } from '../routes/ai';

describe('renderHistoryForPrompt', () => {
  it('returns empty string when there is no history', () => {
    expect(renderHistoryForPrompt([])).toBe('');
  });

  it('labels USER/ASSISTANT turns in order', () => {
    const out = renderHistoryForPrompt([
      { role: 'user', content: 'Bugün kaç kişi geldi?' },
      { role: 'assistant', content: '45 kişi.' },
      { role: 'user', content: 'peki cinsiyet dağılımı?' },
    ]);
    expect(out).toContain('USER: Bugün kaç kişi geldi?');
    expect(out).toContain('ASSISTANT: 45 kişi.');
    expect(out).toContain('USER: peki cinsiyet dağılımı?');
    // Ordering must be preserved — critical for follow-up context correctness.
    expect(out.indexOf('Bugün')).toBeLessThan(out.indexOf('45 kişi'));
    expect(out.indexOf('45 kişi')).toBeLessThan(out.indexOf('peki cinsiyet'));
  });

  it('defaults unknown roles to ASSISTANT label', () => {
    // Guards against garbage rows from an older schema polluting the prompt.
    const out = renderHistoryForPrompt([{ role: 'system', content: 'ignore' }]);
    expect(out).toContain('ASSISTANT: ignore');
  });

  it('starts with the sentinel header the LLM recognizes', () => {
    const out = renderHistoryForPrompt([{ role: 'user', content: 'hi' }]);
    expect(out.startsWith('\nCONVERSATION HISTORY')).toBe(true);
  });
});
