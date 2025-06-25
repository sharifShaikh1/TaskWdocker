import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql', // Correct
  dbCredentials: {
    host: 'ep-long-mud-a8kch3hr-pooler.eastus2.azure.neon.tech',
    user: 'neondb_owner:',
    password: 'npg_GgDRSL1O3nPE',
    database: 'neondb',
    ssl: true, // Required for NeonDB
  },
});
