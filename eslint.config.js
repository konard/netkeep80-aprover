import pluginVue from 'eslint-plugin-vue'
import vueTsEslintConfig from '@vue/eslint-config-typescript'
import prettierConfig from '@vue/eslint-config-prettier'

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'],
  },

  ...pluginVue.configs['flat/recommended'],
  ...vueTsEslintConfig(),
  prettierConfig,

  {
    name: 'app/rules',
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',

      // Vue specific rules
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'warn',

      // General rules
      'no-console': 'warn',
      'no-debugger': 'error',
    },
  },

  {
    name: 'app/examples-and-experiments',
    files: ['examples/**/*.ts', 'experiments/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
]
