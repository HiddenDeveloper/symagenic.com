// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.log',
      '.env*',
      'debug-*.js',
      'test-*.js',
      'test-*.mjs',
      'test_*.js',
      'exploratory-tests/**',
      'eslint.config.mjs',
    ],
  },
  // Base configurations
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylistic,
  // Prettier integration (must be last)
  prettierRecommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js', '*.mjs'],
          defaultProject: 'tsconfig.json',
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    rules: {
      // Gradual adoption - use 'warn' for migration
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/prefer-promise-reject-errors': 'warn',
      '@typescript-eslint/unbound-method': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'warn',
      '@typescript-eslint/restrict-plus-operands': 'warn',

      // Prevent specific string literals where constants should be used
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'Literal[value="OPENAI"]',
          message: 'Use SERVICE_PROVIDERS.OPENAI instead of string literal "OPENAI"',
        },
        {
          selector: 'Literal[value="ANTHROPIC"]',
          message: 'Use SERVICE_PROVIDERS.ANTHROPIC instead of string literal "ANTHROPIC"',
        },
        {
          selector: 'Literal[value="GOOGLE"]',
          message: 'Use SERVICE_PROVIDERS.GOOGLE instead of string literal "GOOGLE"',
        },
        {
          selector: 'Literal[value="GROQ"]',
          message: 'Use SERVICE_PROVIDERS.GROQ instead of string literal "GROQ"',
        },
        {
          selector: 'Literal[value="OLLAMA"]',
          message: 'Use SERVICE_PROVIDERS.OLLAMA instead of string literal "OLLAMA"',
        },
        {
          selector: 'Literal[value="LMSTUDIO"]',
          message: 'Use SERVICE_PROVIDERS.LMSTUDIO instead of string literal "LMSTUDIO"',
        },
        {
          selector: 'Literal[value="user"]',
          message: 'Use MESSAGE_ROLES.USER instead of string literal "user"',
        },
        {
          selector: 'Literal[value="assistant"]',
          message: 'Use MESSAGE_ROLES.ASSISTANT instead of string literal "assistant"',
        },
        {
          selector: 'Literal[value="system"]',
          message: 'Use MESSAGE_ROLES.SYSTEM instead of string literal "system"',
        },
        {
          selector: 'Literal[value="tool"]',
          message: 'Use MESSAGE_ROLES.TOOL instead of string literal "tool"',
        },
        {
          selector: 'Literal[value="stdio"]',
          message: 'Use TRANSPORT_TYPES.STDIO instead of string literal "stdio"',
        },
        {
          selector: 'Literal[value="http"]',
          message: 'Use TRANSPORT_TYPES.HTTP instead of string literal "http"',
        },
        // Schema validation enforcement - encourage using typed validation
        {
          selector:
            'CallExpression[callee.object.name="JSON"][callee.property.name="parse"]:has(+ VariableDeclarator[id.name="rawConfigs"])',
          message:
            'Consider using validateAgentsFile() from agents-schema.ts for type-safe agent configuration parsing',
        },
        {
          selector:
            'CallExpression[callee.object.name="JSON"][callee.property.name="parse"]:has(+ VariableDeclarator[id.name="configData"])',
          message:
            'Consider using validateServerConfigFile() from server-config-schema.ts for type-safe server configuration parsing',
        },
      ],
    },
  },
  // Test files - relax rules
  {
    files: ['tests/**/*.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      // Allow string literals in test files for mocking
      'no-restricted-syntax': 'off',
    },
  },
  // Constants files - allow string literals since they define the constants
  {
    files: ['src/shared/constants/*.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  }
);
