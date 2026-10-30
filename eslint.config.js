// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - eslint.config.js
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// `npm run lint`: the recommended rules for JavaScript and TypeScript plus the two rules of React hooks. The type
// checker (`npm run typecheck`) stays the place for type errors, so the rules that need type information are not
// switched on here.
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'build', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    // the tests build partial fakes of fetch and of the clients; typing every one would hide what they check
    files: ['tests/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    files: ['*.config.{js,ts}', 'scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // the script that takes the README screenshots runs in Node and drives a page, so it sees both sets of globals
    files: ['tools/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
)
