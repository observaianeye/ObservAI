/**
 * Yan #49 — One-shot cleanup of orphan chat_messages rows with userId NULL.
 *
 * Faz 5 audit found a handful of rows where userId is NULL (legacy seed data
 * or pre-tenant-isolation anonymous messages). After Yan #37 hardened the
 * tenant scope, these rows can never be returned to a logged-in user, so
 * keeping them around is dead weight. This script counts and deletes them.
 *
 * Idempotent: re-running prints `Found 0 orphan chat_messages` and exits 0.
 *
 * Usage:
 *   cd backend && npx tsx scripts/cleanup-null-userid-chat.ts
 *   cd backend && DRY_RUN=true npx tsx scripts/cleanup-null-userid-chat.ts
 */
import { prisma } from '../src/lib/db';

async function main() {
  const dryRun = String(process.env.DRY_RUN ?? '').toLowerCase() === 'true';
  const orphans = await prisma.chatMessage.findMany({
    where: { userId: null },
    select: { id: true, conversationId: true, role: true, createdAt: true },
  });
  console.log(`[cleanup-null-userid-chat] Found ${orphans.length} orphan chat_messages with NULL userId`);
  if (orphans.length === 0) {
    await prisma.$disconnect();
    return;
  }
  if (dryRun) {
    console.log('[cleanup-null-userid-chat] DRY_RUN — sample:', orphans.slice(0, 5));
    await prisma.$disconnect();
    return;
  }
  const result = await prisma.chatMessage.deleteMany({ where: { userId: null } });
  console.log(`[cleanup-null-userid-chat] Deleted ${result.count} rows`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[cleanup-null-userid-chat] Failed:', err);
  process.exit(1);
});
