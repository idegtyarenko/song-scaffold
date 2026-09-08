import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat['recommended-latest'],
  // Formatting is Prettier's job; this drops every rule that would argue with it.
  prettier,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // A dependency list that lies is the one React bug you cannot see by reading the
      // component: it fails as a stale value much later, so it has to fail the build here.
      'react-hooks/exhaustive-deps': 'error',
    },
  },
);
