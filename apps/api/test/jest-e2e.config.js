/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
  moduleNameMapper: {
    '^@control-tower/shared-types$': '<rootDir>/../../packages/shared-types/src',
    '^@control-tower/classification$': '<rootDir>/../../services/classification/src',
    '^@control-tower/ingestion$': '<rootDir>/../../services/ingestion/src',
    '^@control-tower/reporting$': '<rootDir>/../../services/reporting/src',
  },
  testTimeout: 30000,
};
