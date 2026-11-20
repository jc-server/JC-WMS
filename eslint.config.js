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
      // Traditional React-hooks rules (Hooks ordering + dependency arrays).
      // These are the two rules that catch real bugs — keep them enabled.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // React Compiler–era rules introduced in eslint-plugin-react-hooks@7.
      // These are designed for codebases that opt into React Compiler, and
      // they flag many widely-used, safe patterns:
      //
      //   - set-state-in-effect: flags `if (!user) { setX([]); setLoading(false); }`
      //     resets, which are the standard way to handle "subscribe/unsubscribe"
      //     in custom hooks.
      //   - refs: flags reading `.current` during render. Reading a ref during
      //     render CAN be a real bug (if nothing else triggers a re-render), but
      //     the current usage in AttendanceMatrix is a deliberate "ref + state
      //     mirror" pattern. Disabled globally; the AttendanceMatrix case is
      //     documented separately below.
      //
      // This project does not use React Compiler. If/when it does, remove
      // these two disables and address the flagged patterns.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',

      // Fast Refresh will still work with these context files — the warning
      // is cosmetic (a full reload happens instead of HMR on hook-only
      // changes). Splitting AuthContext.tsx / ThemeContext.tsx into
      // `XProvider.tsx` + `useX.ts` files would silence this without the
      // disable, but it's a bigger refactor than the current failure
      // warrants.
      'react-refresh/only-export-components': 'off',

      // Allow intentionally-unused params prefixed with `_` (used in
      // useRoleCascade for forward-compat signature stability).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  }
);