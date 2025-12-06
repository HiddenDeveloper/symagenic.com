/**
 * eslint.config.js
 *
 * Flat ESLint config for TypeScript + React:
 * - Integrates core JS and TS rules (recommended)
 * - Adds React, Hooks, Fast Refresh, and a11y rules
 * - Enforces import sorting and Prettier formatting
 * - Uses parserOptions.project for type‑aware linting
 */

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import pluginA11y from "eslint-plugin-jsx-a11y";
import importSort from "eslint-plugin-simple-import-sort";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default tseslint.config(
  { ignores: ["dist"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
        ecmaFeatures: { jsx: true },
      },
      globals: globals.browser,
    },
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      react: pluginReact,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": pluginA11y,
      "simple-import-sort": importSort,
    },
    rules: {
      // React rules
      ...pluginReact.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // Accessibility rules
      ...pluginA11y.configs.recommended.rules,

      // Custom rules
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "simple-import-sort/imports": "warn",
      "simple-import-sort/exports": "warn",
    },
  },
  // Config files (vite.config.ts, vitest.config.ts, etc.)
  {
    files: ["*.config.{ts,js}", "*.setup.{ts,js}", "eslint.config.js"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: "./tsconfig.node.json",
        tsconfigRootDir: __dirname,
      },
      globals: { ...globals.node },
    },
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        vi: "readonly",
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      },
    },
  },
  // Prettier integration (must be last)
  prettierRecommended,
);
