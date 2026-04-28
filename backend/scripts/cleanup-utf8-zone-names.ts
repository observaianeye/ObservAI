/**
 * Yan #34 cleanup: replace any baked-in U+FFFD ('�') replacement characters
 * in existing zone.name rows with '?'. Run once after the route-level
 * refinement is in place — new bad bytes can no longer reach the DB.
 *
 *   npx tsx scripts/cleanup-utf8-zone-names.ts
 *
 * Idempotent: zones without '�' are left untouched.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const zones = await prisma.zone.findMany();
  let count = 0;
  for (const z of zones) {
    if (z.name.includes('�')) {
      const fixed = z.name.replace(/�/g, '?');
      await prisma.zone.update({
        where: { id: z.id },
        data: { name: fixed },
      });
      console.log(`Fixed zone ${z.id}: ${JSON.stringify(z.name)} -> ${JSON.stringify(fixed)}`);
      count++;
    }
  }
  console.log(`Total ${count} zones cleaned`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
