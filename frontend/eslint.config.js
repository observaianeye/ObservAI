import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'no-restricted-syntax': ['error', {
        selector: "JSXAttribute[name.name='className'] Literal[value=/\\b(text|bg|border|from|to|via)-(gray|blue|purple|teal|green|red|amber|orange|yellow|pink|indigo|rose|slate|emerald|cyan|sky)-/]",
        message: 'Use ObservAI design tokens (ink-*, surface-*, brand-*, accent-*, violet-*, success, warning, danger) instead of legacy Tailwind color-* classes.',
      }],
    },
  }
);
