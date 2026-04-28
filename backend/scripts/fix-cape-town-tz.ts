/**
 * Yan #54 one-shot: the Cape Town Ekhaya branch was created with the wrong
 * IANA tz (`Asia/Dubai`, UTC+4 instead of UTC+2). Once Yan #45's branch-tz
 * aware aggregator is in place this row would still be off by 2h, so we
 * correct it here.
 *
 *   npx tsx scripts/fix-cape-town-tz.ts
 *
 * Idempotent: branches already on `Africa/Johannesburg` are skipped.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const branches = await prisma.branch.findMany({
    where: { name: { contains: 'Cape Town' } },
  });

  if (branches.length === 0) {
    console.log('No Cape Town branches found — nothing to fix.');
    return;
  }

  let fixed = 0;
  for (const b of branches) {
    if (b.timezone !== 'Africa/Johannesburg') {
      await prisma.branch.update({
        where: { id: b.id },
        data: { timezone: 'Africa/Johannesburg' },
      });
      console.log(`Fixed ${b.id} ${b.name}: ${b.timezone} -> Africa/Johannesburg`);
      fixed++;
    } else {
      console.log(`Skip ${b.id} ${b.name}: already Africa/Johannesburg`);
    }
  }
  console.log(`Total ${fixed} branches updated`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
