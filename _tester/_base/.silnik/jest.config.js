// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '\\.css$': '<rootDir>/src/tests/mocks/style.js',
    // R3F/three are browser-only ESM dependencies. The browser behaviour is
    // covered by Playwright; unit suites need the semantic tray, not WebGL.
    '^@/components/dice/physical-dice-scene$': '<rootDir>/src/tests/mocks/physical-dice-scene.tsx',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/app/(.*)$': '<rootDir>/src/app/$1',
    '^@/core/(.*)$': '<rootDir>/src/core/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/hooks$': '<rootDir>/src/hooks/index.ts',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@/i18n/(.*)$': '<rootDir>/src/i18n/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    // IND-19: @google/genai exports only ESM (.mjs) which Jest (CJS) cannot parse via requireActual.
    // Point Jest to the CJS build so jest.mock factories can spread real enums.
    '^@google/genai$': '<rootDir>/node_modules/@google/genai/dist/index.cjs',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.jest.json',
        diagnostics: { exclude: ['jest.setup.ts'] },
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$))'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{test,spec}.{ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx}',
  ],
  // Ignoruj lokalne worktrees Claude'a - duplikat package.json powoduje haste collision
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.claude/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
