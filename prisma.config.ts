import { defineConfig } from 'prisma/config';

try { process.loadEnvFile('.env.local'); } catch { /* prod ou absent */ }

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
