import { FastifyInstance } from "fastify";
import { createApp } from "../../src/app.js";

/**
 * Creates a test app instance
 */
export async function createTestApp(): Promise<FastifyInstance> {
  const app = await createApp();

  // Override database connection for tests
  // TODO: Add test database configuration

  return app;
}

/**
 * Cleans up test app instance
 */
export async function cleanupTestApp(app: FastifyInstance): Promise<void> {
  await app.close();
}

/**
 * Helper to create mock request context for tRPC testing
 */
export function createMockContext(overrides: Record<string, unknown> = {}) {
  return {
    req: {
      headers: {},
      ...(overrides.req as Record<string, unknown>),
    },
    res: {
      ...(overrides.res as Record<string, unknown>),
    },
    user: overrides.user || null,
    ...overrides,
  };
}

/**
 * Sleep utility for async tests
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate test data helpers
 */
export const testData = {
  user: {
    id: "test-user-id",
    email: "test@example.com",
    name: "Test User",
  },
  account: {
    id: "test-account-id",
    name: "Test Account",
    balance: 1000.0,
    currency: "USD",
  },
  transaction: {
    id: "test-transaction-id",
    amount: 100.0,
    description: "Test Transaction",
    date: new Date("2024-01-01"),
  },
};
