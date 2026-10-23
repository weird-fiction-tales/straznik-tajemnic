module.exports = async () => ({
  ...(await import('./jest.config.js')).default,
  testMatch: ['<rootDir>/src/components/ui/dialog.acceptance.real.tsx'],
  transform: {
    '^.+\\.(ts|tsx|js)$': [
      'ts-jest',
      {
        tsconfig: {
          allowJs: true,
          jsx: 'react-jsx',
          module: 'CommonJS',
          esModuleInterop: true,
          target: 'ES2020',
          resolveJsonModule: true,
        },
        diagnostics: { exclude: ['jest.setup.ts'] },
      },
    ],
  },
  // The acceptance suite uses the real ESM-only next-intl provider.
  transformIgnorePatterns: [
    '/node_modules/(?!(next-intl|use-intl|intl-messageformat|@formatjs)/)',
  ],
});
