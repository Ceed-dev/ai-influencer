/**
 * Jest setup file (runs before each test file, before framework).
 * Sets environment variables to limit DB pool sizes during testing.
 */
process.env['DB_POOL_MAX'] = '3';
process.env['DB_CONNECTION_TIMEOUT_MS'] = '10000';
