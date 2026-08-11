/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/observability/tracing.ts',
  ],
  moduleNameMapper: {
    '^@control-tower/shared-types$': '<rootDir>/../../packages/shared-types/src',
    '^@control-tower/classification$': '<rootDir>/../../services/classification/src',
    '^@control-tower/ingestion$': '<rootDir>/../../services/ingestion/src',
    '^@control-tower/reporting$': '<rootDir>/../../services/reporting/src',
  },
};
