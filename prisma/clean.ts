import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  console.log('🧹 Nettoyage de la base (users conservés)...');

  await db.$transaction([
    db.syncLog.deleteMany(),
    db.pushSubscription.deleteMany(),
    db.notification.deleteMany(),
    db.listItem.deleteMany(),
    db.listMember.deleteMany(),
    db.sharedList.deleteMany(),
    db.userEpisode.deleteMany(),
    db.userShow.deleteMany(),
    db.episode.deleteMany(),
    db.season.deleteMany(),
    db.show.deleteMany(),
  ]);

  const users = await db.user.count();
  console.log(`✓ Base nettoyée — ${users} utilisateurs conservés`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
