import { config } from "dotenv";
import { vi, beforeEach, afterEach } from "vitest";

// Load test environment variables
config({ path: ".env.test" });

// Set NODE_ENV to test if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "test";
}

// Global test setup
global.console = {
  ...console,
  // Suppress console.log in tests unless VERBOSE_TESTS is set
  log: process.env.VERBOSE_TESTS ? console.log : vi.fn(),
  debug: process.env.VERBOSE_TESTS ? console.debug : vi.fn(),
  info: process.env.VERBOSE_TESTS ? console.info : vi.fn(),
  warn: console.warn,
  error: console.error,
};

// Global test hooks
beforeEach(() => {
  // Reset any mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  vi.restoreAllMocks();
});
