import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import i18next from 'eslint-plugin-i18next';

export default tseslint.config(
  {
    ignores: ['dist']
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser
      }
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      i18next
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Best practices
      'curly': ['error', 'all'],
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',

      "i18next/no-literal-string": [
        "error",
        {
          "markupOnly": true,
          "ignoreAttribute": [
            // HTML базовые
            "id",
            "className",
            "style",
            "name",
            "type",
            "value",
            "defaultValue",
            "placeholder",

            // accessibility
            "role",
            "aria-*",

            // testing
            "data-testid",
            "data-*",

            // формы
            "autoComplete",
            "inputMode",
            "pattern",

            // ссылки / ресурсы
            "href",
            "src",

            // события и тех. штуки
            "key",
            "tabIndex",

            // MUI специфичное
            "variant",
            "color",
            "size",
            "margin",
            "padding",
            "direction",
            "align",
            "justifyContent",
            "alignItems",
            "spacing",

            // MUI props
            "sx",
            "component",
            "slots",
            "slotProps"
          ]
        }
      ]
    }

  },
  {
    files: ['**/*.{test,spec}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}', '**/tests/**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    rules: {
      'i18next/no-literal-string': 'off'
    }
  }
);
