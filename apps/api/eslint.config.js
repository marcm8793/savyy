// @ts-check

const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  // Global ignores
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/*.js.map",
      "**/*.d.ts",
    ],
  },

  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript ESLint recommended rules
  ...tseslint.configs.recommended,

  // TypeScript ESLint recommended type-checked rules
  ...tseslint.configs.recommendedTypeChecked,

  // Configuration for TypeScript files
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // TypeScript specific rules
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/require-await": "off", // Allow async functions without await
      "@typescript-eslint/no-unsafe-assignment": "warn", // Warn instead of error
      "@typescript-eslint/no-unsafe-member-access": "warn", // Warn instead of error
      "@typescript-eslint/no-unsafe-return": "warn", // Warn instead of error
      "@typescript-eslint/no-misused-promises": "warn", // Warn instead of error
      "@typescript-eslint/no-var-requires": "error",

      // General ESLint rules
      "no-console": "off", // Allow console in server environment
      "no-debugger": "error",
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      semi: ["error", "always"],

      // Node.js specific rules for server environment
      "no-process-exit": "warn", // Warn instead of error for server apps
      "no-path-concat": "error",
    },
  },

  // Configuration for JavaScript files (if any)
  {
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      // Disable TypeScript-specific rules for JS files
      "@typescript-eslint/no-var-requires": "off",
    },
  },

  // Configuration for test files (if you add them later)
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/test/**/*.ts"],
    rules: {
      // Allow any in tests for mocking
      "@typescript-eslint/no-explicit-any": "off",
      // Allow unsafe operations in tests
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  }
);
