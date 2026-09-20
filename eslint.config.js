// ESLint flat config.
//
// Stage 0 safety net for the frontend structure refactor
// (docs/design/019_frontend-structure-refactor.md §6 阶段 0).
//
// Deliberately narrow: the two rules the refactor relies on are
//   - react-hooks/exhaustive-deps  (hook 化搬迁时不能漏依赖)
//   - import/no-cycle              (P2 循环依赖必须零容忍)
// plus a small base of correctness rules. Style-only rules are intentionally
// left out so that `pnpm lint` stays a signal for the refactor instead of a
// noise generator over the pre-existing 51k-line codebase.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import importPlugin from "eslint-plugin-import";

/**
 * 019 §5.2 rule 2: `modules/<a>` must not import `modules/<b>`. Shared code
 * goes up to `hooks/`, `utils/` or `types/`.
 *
 * Local rule because `no-restricted-imports` cannot express "any domain other
 * than your own". Currently `warn`: HomeView is still the composition root and
 * pulls in `pipeline`/`dialogs`, which 005 A2 (Props 收敛/Context 化) has to
 * resolve first.
 */
const noCrossModuleImports = {
  meta: { type: "problem", schema: [] },
  create(context) {
    return {
      ImportDeclaration(node) {
        const spec = String(node.source.value);
        const target = /^@\/modules\/([a-z-]+)(?:\/|$)/.exec(spec);
        if (!target) return;
        const file = context.filename.replace(/\\/g, "/");
        const own = /\/src\/modules\/([a-z-]+)\//.exec(file);
        if (own && own[1] !== target[1]) {
          context.report({
            node,
            message: `modules/${own[1]} 不得引用 modules/${target[1]}(019 §5.2);需共享则上提到 hooks/、utils/ 或 types/`,
          });
        }
      },
    };
  },
};

/** §5.3 line budgets, shared by every max-lines config below. */
const maxLines = (max) => [
  "warn",
  { max, skipBlankLines: true, skipComments: true },
];

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "src-tauri/**",
      "src/generated/**",
      "coverage/**",
      "**/*.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      import: importPlugin,
      local: { rules: { "no-cross-module-imports": noCrossModuleImports } },
    },
    settings: {
      // `import/no-cycle` recurses into imported files; without this mapping it
      // would fall back to the default (espree) parser, fail on TS syntax and
      // silently report no cycle at all.
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"],
      },
      "import/extensions": [".ts", ".tsx"],
      "import/resolver": {
        // `@/*` -> `./src/*`, mirroring tsconfig `paths`.
        // eslint-import-resolver-typescript v4 could not pick the alias up
        // (probably because it rides on TS 7's tsconfig handling), so the
        // mapping is declared explicitly — this is all `import/no-cycle` needs.
        alias: {
          map: [["@", "./src"]],
          extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
        },
        node: {
          extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
        },
      },
    },
    rules: {
      // --- rules the refactor depends on -----------------------------------
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "import/no-cycle": ["error", { maxDepth: 10, ignoreExternal: true }],
      "local/no-cross-module-imports": "warn",

      // --- §5.3 单文件行数约束 --------------------------------------------
      // `warn` until stage 2 (MainMenuHooks / FlowPanel / App / ChartPanel
      // splits) lands — turning it into "error" now would fail the gate on the
      // files that stage is still about to split.
      "max-lines": maxLines(400),

      // --- correctness, cheap to satisfy -----------------------------------
      "no-console": "off",
      eqeqeq: ["warn", "smart"],
      "prefer-const": "warn",

      // --- typescript-eslint -------------------------------------------------
      // TS 7 (native port) is ahead of typescript-eslint's peer range, so the
      // type-aware presets are not enabled here. Keep the syntactic subset.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
  {
    // §5.3: data files and tests get a larger budget.
    files: ["src/data/**/*.ts", "src/__tests__/**", "src/**/*.test.{ts,tsx}"],
    rules: { "max-lines": maxLines(800) },
  },
  {
    // §5.2 rule 1: generic UI must not reach into business code.
    files: ["src/components/**/*.{ts,tsx}"],
    ignores: ["src/components/expression/**", "src/components/setting/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules", "@/modules/*", "@/data", "@/data/*", "@/services", "@/services/*"],
              message: "components/ 是通用件,禁止引用业务代码(019 §5.2);共享逻辑上提到 hooks/ 或 utils/。",
            },
          ],
        },
      ],
    },
  },
  {
    // Known debt: `expression/` and `setting/` are still in components/ (019
    // §2.1 P3) and legitimately read `data/` + `services/ai`. Warn until the
    // planned move, so the debt stays visible without failing the gate.
    files: ["src/components/expression/**", "src/components/setting/**"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@/modules", "@/modules/*", "@/data", "@/data/*", "@/services", "@/services/*"],
              message: "待 019 §2.1 P3 迁移后解除(components/ 不得引用业务代码)。",
            },
          ],
        },
      ],
    },
  },
);

