import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hash } from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const USERS = [
  { name: 'Shin',  email: 'shinkasai1337@gmail.com', color: '#A855F7', initials: 'SK' },
  { name: 'Nami',  email: 'namichan1997@gmail.com',  color: '#FB7185', initials: 'NC' },
];

async function main() {
  console.log('🌱 Seeding...');

  const password = process.argv[2];
  if (!password) {
    console.error('Usage: npm run db:seed <password>');
    process.exit(1);
  }

  const passwordHash = await hash(password, 12);

  for (const u of USERS) {
    await db.user.upsert({
      where:  { email: u.email },
      update: { name: u.name, color: u.color, initials: u.initials },
      create: { ...u, passwordHash },
    });
    console.log(`  ✓ ${u.name} <${u.email}>`);
  }

  console.log('\nComptes créés. Connexion sur /login.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
