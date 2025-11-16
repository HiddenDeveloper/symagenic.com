import typescriptEslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': typescriptEslint
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      
      // Custom rules to prevent string literals where constants should be used
      'no-magic-numbers': ['error', { 
        ignore: [0, 1, -1], 
        ignoreArrayIndexes: true,
        detectObjects: false 
      }],
      
      // Prevent specific string literals for our constants
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value="OPENAI"]',
          message: 'Use SERVICE_PROVIDERS.OPENAI instead of string literal "OPENAI"'
        },
        {
          selector: 'Literal[value="ANTHROPIC"]',
          message: 'Use SERVICE_PROVIDERS.ANTHROPIC instead of string literal "ANTHROPIC"'
        },
        {
          selector: 'Literal[value="GOOGLE"]',
          message: 'Use SERVICE_PROVIDERS.GOOGLE instead of string literal "GOOGLE"'
        },
        {
          selector: 'Literal[value="GROQ"]',
          message: 'Use SERVICE_PROVIDERS.GROQ instead of string literal "GROQ"'
        },
        {
          selector: 'Literal[value="OLLAMA"]',
          message: 'Use SERVICE_PROVIDERS.OLLAMA instead of string literal "OLLAMA"'
        },
        {
          selector: 'Literal[value="LMSTUDIO"]',
          message: 'Use SERVICE_PROVIDERS.LMSTUDIO instead of string literal "LMSTUDIO"'
        },
        {
          selector: 'Property[key.name="role"] > Literal[value="user"]',
          message: 'Use MESSAGE_ROLES.USER instead of string literal "user"'
        },
        {
          selector: 'Property[key.name="role"] > Literal[value="assistant"]',
          message: 'Use MESSAGE_ROLES.ASSISTANT instead of string literal "assistant"'
        },
        {
          selector: 'Property[key.name="role"] > Literal[value="system"]',
          message: 'Use MESSAGE_ROLES.SYSTEM instead of string literal "system"'
        },
        {
          selector: 'Property[key.name="role"] > Literal[value="tool"]',
          message: 'Use MESSAGE_ROLES.TOOL instead of string literal "tool"'
        },
      ]
    }
  },
  {
    files: ['src/shared/constants/*.ts'],
    rules: {
      // Allow string literals in constant definition files
      'no-restricted-syntax': 'off'
    }
  }
];