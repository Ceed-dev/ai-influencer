/**
 * Jest global setup file.
 * Ensures the DB connection pool is properly closed after all tests in each file.
 */
import { closePool } from '@/src/db/pool';

afterAll(async () => {
  await closePool();
});
