import { FastifyInstance } from "fastify";
import { createApp } from "../../src/app.js";

/**
 * Type definitions for test context
 */
export interface MockUser {
  id: string;
  email: string;
  name: string;
  role?: string;
}

export interface MockRequest {
  headers?: Record<string, string | string[]>;
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string | string[]>;
  user?: MockUser | null;
}

export interface MockResponse {
  statusCode?: number;
  headers?: Record<string, string>;
}

export interface MockContext {
  req: MockRequest;
  res: MockResponse;
  user: MockUser | null;
  db?: unknown;
  redis?: unknown;
}

export interface MockContextOverrides {
  req?: Partial<MockRequest>;
  res?: Partial<MockResponse>;
  user?: MockUser | null;
  db?: unknown;
  redis?: unknown;
}

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
export function createMockContext(
  overrides: MockContextOverrides = {}
): MockContext {
  return {
    req: {
      headers: {},
      ...overrides.req,
    },
    res: {
      statusCode: 200,
      headers: {},
      ...overrides.res,
    },
    user: overrides.user || null,
    db: overrides.db,
    redis: overrides.redis,
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
