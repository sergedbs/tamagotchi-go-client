import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

const memoryOnlyStorage = [
  'error',
  {
    selector: "MemberExpression[object.name='localStorage']",
    message: 'Credentials and authenticated data must stay in memory.',
  },
  {
    selector: "MemberExpression[object.name='sessionStorage']",
    message: 'Credentials and authenticated data must stay in memory.',
  },
]

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', '.local', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx,js}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2024 },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-restricted-syntax': memoryOnlyStorage,
    },
  },
  {
    files: ['scripts/**/*.ts', 'tests/**/*.ts', '*.config.{ts,js}'],
    languageOptions: { globals: globals.node },
  },
  {
    // Playwright fixtures require an object pattern even when no fixture is used.
    files: ['tests/e2e/**/*.ts'],
    rules: { 'no-empty-pattern': 'off' },
  },
)
