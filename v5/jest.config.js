/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleDirectories: ['node_modules', '<rootDir>'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      diagnostics: false,
    }],
  },
  moduleNameMapper: {
    '^@/types/(.*)$': '<rootDir>/types/$1',
    '^@/src/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  verbose: true,
  testTimeout: 30000,
  // DB-dependent tests share state — run workers serially to avoid FK constraint races
  maxWorkers: 1,
  // Force exit after tests complete to avoid hanging from unclosed DB pools
  forceExit: true,
};
