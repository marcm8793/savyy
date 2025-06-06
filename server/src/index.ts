import Fastify from "fastify";
import {
  fastifyTRPCPlugin,
  FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import { appRouter, type AppRouter } from "./routers";
import { createContext } from "./context";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "./middleware/authMiddleware";
import databasePlugin from "./utils/db";
import { auth } from "./utils/auth";
import fastifyCors from "@fastify/cors";

// Initialize Fastify server
const fastify = Fastify({
  logger: true,
  maxParamLength: 5000, // Handle large batch requests
});
// Initialize port from environment variable
const PORT = process.env.PORT;

// Register database plugin first (before other plugins that might need it)
fastify.register(databasePlugin, {
  connectionString: process.env.DATABASE_URL,
});

// Configure CORS policies
fastify.register(fastifyCors, {
  origin: process.env.CLIENT_ORIGIN,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  maxAge: 86400,
});

// Register tRPC plugin
fastify.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  trpcOptions: {
    router: appRouter,
    createContext,
    onError({ path, error }) {
      // Report to error monitoring
      fastify.log.error(`Error in tRPC handler on path '${path}':`, error);
    },
  } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
});

// Register authentication endpoint
fastify.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  async handler(request, reply) {
    try {
      // Construct request URL
      const url = new URL(request.url, `http://${request.headers.host}`);

      // Convert Fastify headers to standard Headers object
      const headers = new Headers();
      Object.entries(request.headers).forEach(([key, value]) => {
        if (value) headers.append(key, value.toString());
      });

      // Create Fetch API-compatible request
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        body: request.body ? JSON.stringify(request.body) : undefined,
      });

      // Process authentication request
      const response = await auth.handler(req);

      // Forward response to client
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      reply.send(response.body ? await response.text() : null);
    } catch (error) {
      fastify.log.error("Authentication Error:", error);
      reply.status(500).send({
        error: "Internal authentication error",
        code: "AUTH_FAILURE",
      });
    }
  },
});

// Example route showing how to use the database plugin
fastify.get("/api/health/db", async function (request, reply) {
  try {
    // Access the database through the Fastify instance
    // The database is now available as fastify.db and fastify.pg
    const result = await this.pg.query("SELECT NOW() as current_time");

    return {
      status: "healthy",
      database: "connected",
      timestamp: result.rows[0].current_time,
      message: "Database connection is working properly",
    };
  } catch (error) {
    this.log.error("Database health check failed:", error);
    reply.status(500);
    return {
      status: "unhealthy",
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

// Example of a protected route using the auth middleware
fastify.register(async function protectedRoutes(fastify) {
  // Register the auth middleware for this context
  await fastify.register(authMiddleware);

  // This route will require authentication
  fastify.get("/api/protected/profile", async (request, reply) => {
    // request.user and request.session are now available and typed
    return {
      message: "This is a protected route",
      user: request.user,
      session: {
        id: request.session?.id,
        expiresAt: request.session?.expiresAt,
      },
    };
  });

  // Another protected route example
  fastify.get("/api/protected/dashboard", async (request, reply) => {
    return {
      message: `Welcome to your dashboard, ${
        request.user?.name || request.user?.email
      }!`,
      userId: request.user?.id,
    };
  });
});

// Example of routes with optional authentication
fastify.register(async function optionalAuthRoutes(fastify) {
  // Register the optional auth middleware
  await fastify.register(optionalAuthMiddleware);

  // This route works for both authenticated and non-authenticated users
  fastify.get("/api/public/content", async (request, reply) => {
    if (request.user) {
      return {
        message: "Welcome back!",
        personalizedContent: true,
        user: request.user.email,
      };
    } else {
      return {
        message: "Welcome, guest!",
        personalizedContent: false,
      };
    }
  });
});

// Initialize server
fastify.listen({ port: Number(PORT) }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`Server running on port ${PORT}`);
});
