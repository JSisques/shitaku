import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

/**
 * Shared rule block for complexity scoring.
 * Cognitive threshold 0: sonar omits complexityAmount === 0; index.mjs zero-fills.
 * Cyclomatic max 0: emit every function (complexity is always >= 1).
 */
export default [
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    plugins: { sonarjs },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      complexity: ['error', { max: 0 }],
      'sonarjs/cognitive-complexity': ['error', 0],
    },
  },
];
