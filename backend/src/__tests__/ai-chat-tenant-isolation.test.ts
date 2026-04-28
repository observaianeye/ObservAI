import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the prisma client at the module path imported by routes/ai.ts.
// If the import path in ai.ts ever changes, update the string here too —
// otherwise the mock silently no-ops and the assertions trivially pass.
const mockFindMany = vi.fn();

vi.mock('../lib/db', () => ({
  prisma: {
    chatMessage: {
      findMany: (args: unknown) => mockFindMany(args),
    },
  },
}));

import { loadConversationHistory } from '../routes/ai';

describe('AI chat tenant isolation (Yan #37 fix — loadConversationHistory)', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  it('passes both conversationId AND userId to the prisma query', async () => {
    // The actual fix: the where clause must scope by userId so a guessed/leaked
    // conversationId from another tenant cannot leak history into the prompt.
    mockFindMany.mockResolvedValueOnce([]);
    await loadConversationHistory('conv-X', 'user-A');
    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const arg = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where.conversationId).toBe('conv-X');
    expect(arg.where.userId).toBe('user-A');
  });

  it('returns user A history (oldest-first) when user A re-accesses their own conv', async () => {
    // findMany returns desc; the route reverses to oldest-first for prompt order.
    mockFindMany.mockResolvedValueOnce([
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'secret-A' },
    ]);
    const result = await loadConversationHistory('conv-X', 'user-A');
    expect(result.map((r) => r.content)).toEqual(['secret-A', 'reply']);
  });

  it('returns empty when user B reuses user A conversationId', async () => {
    // Prisma with the userId filter returns 0 rows for (conv-X, user-B) — the fix
    // makes user B unable to see user A's prompts/replies even with the conv id.
    mockFindMany.mockResolvedValueOnce([]);
    const result = await loadConversationHistory('conv-X', 'user-B');
    expect(result).toEqual([]);
    const arg = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where.userId).toBe('user-B');
    expect(arg.where.conversationId).toBe('conv-X');
  });
});
