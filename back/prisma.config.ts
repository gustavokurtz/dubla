import { defineConfig, env } from 'prisma/config';

// O .env fica na raiz do monorepo, não em back/.
process.loadEnvFile('../.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
