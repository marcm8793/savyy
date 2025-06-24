import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./__tests__/test-setup.ts"],
    include: ["**/__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "coverage/**",
        "dist/**",
        "scripts/**",
        "**/__tests__/**",
        "**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
        "**/*.d.ts",
        "**/node_modules/**",
        "vitest.config.ts",
        "test-setup.ts",
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@tests": resolve(__dirname, "./__tests__"),
    },
  },
});
