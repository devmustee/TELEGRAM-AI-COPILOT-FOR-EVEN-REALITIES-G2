import { applySchema, pool } from './pool.js';

async function main(): Promise<void> {
  try {
    await applySchema();
    console.log('Database schema applied successfully.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Failed to apply database schema:', err);
  process.exit(1);
});
