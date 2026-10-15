/**
 * ESLint 配置（flat config —— ESLint 9+ 的唯一格式）
 * ------------------------------------------------------------------
 * 组成：
 *   1. js.configs.recommended         —— JavaScript 通用正确性规则
 *   2. pluginVue flat/essential       —— Vue 3 的必要规则（不用 recommended：偏风格、噪声大）
 *   3. eslint-config-prettier         —— 关掉所有与格式化冲突的规则（格式化交给 Prettier）
 *
 * 为什么关掉 vue/multi-word-component-names：
 *   views/ 下的 Home / Teams / Chat / Agents / Settings 等单词名是本项目既有页面约定，
 *   改名会牵动 router 与所有引用；这是"项目约定"而非缺陷，故显式关闭并在此说明。
 *
 * 命令：npm run lint / npm run lint:fix
 */
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'screenshots/**', 'public/media/**', 'coverage/**'],
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  prettier,

  {
    files: ['**/*.{js,mjs,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // vite.config.js 的 define 注入（见该文件顶部说明）
        __SHOW_DEVTOOLS__: 'readonly',
        // 构建元信息（同上，见 vite.config.js 的 define）
        __APP_VERSION__: 'readonly',
        __GIT_SHA__: 'readonly',
        __BUILD_TIME__: 'readonly',
      },
    },
    rules: {
      // 见文件头说明：既有页面命名约定
      'vue/multi-word-component-names': 'off',
      // 未使用变量提示为 warn（不阻断 lint），下划线开头的参数视为有意忽略
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      // no-useless-assignment 是 ESLint 9+ 新增规则：会把「初始值从未被读取」的无害写法
      // （如 `let body = null` 后立刻在 try 里重新赋值）判为 error，
      // 且在 tests/stream.spec.js 的复合赋值表达式 `parseSSEChunk((buffer += 'x'))` 上误报。
      // 降为 warn：保留提示，但不让它阻断 `npm run lint`。
      'no-useless-assignment': 'warn',
      // 允许 warn/error 级日志；console.log 提醒但不阻断
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  {
    // Node 侧文件：构建配置、脚本、ESLint 自身配置。
    // 这些文件里的 console 是脚本输出（如 mock 服务的启动提示），属合理用法，故关闭该规则。
    files: ['vite.config.js', 'eslint.config.js', 'playwright.config.js', 'scripts/**/*.{js,mjs}', 'e2e/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },

  {
    // 测试文件：用例里的 console 用于打印断言上下文，同样关闭
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
]
