import { FastifyPluginAsync } from "fastify";
import { redisService } from "../services/redisService";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/health/db", async function (request, reply) {
    try {
      const result = await this.pg.query("SELECT NOW() as current_time");

      return {
        status: "healthy",
        database: "connected",
        timestamp: (result.rows[0] as { current_time: string }).current_time,
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

  fastify.get("/api/health/redis", async function (request, reply) {
    try {
      const isConnected = redisService.getConnectionStatus();
      const canPing = await redisService.ping();
      const stats = await redisService.getStats();

      if (isConnected && canPing) {
        return {
          status: "healthy",
          redis: "connected",
          stats: stats,
          message: "Redis connection is working properly",
        };
      } else {
        reply.status(503);
        return {
          status: "unhealthy",
          redis: "disconnected",
          connected: isConnected,
          pingable: canPing,
          message: "Redis connection issues detected",
        };
      }
    } catch (error) {
      this.log.error("Redis health check failed:", error);
      reply.status(500);
      return {
        status: "unhealthy",
        redis: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  fastify.get("/api/health", async function (request, reply) {
    try {
      // Check database
      const dbResult = await this.pg.query("SELECT NOW() as current_time");
      const dbHealthy = !!dbResult.rows[0];

      // Check Redis
      const redisHealthy =
        redisService.getConnectionStatus() && (await redisService.ping());

      const overallHealthy = dbHealthy && redisHealthy;

      if (!overallHealthy) {
        reply.status(503);
      }

      return {
        status: overallHealthy ? "healthy" : "unhealthy",
        services: {
          database: dbHealthy ? "connected" : "disconnected",
          redis: redisHealthy ? "connected" : "disconnected",
        },
        timestamp:
          (dbResult.rows[0] as { current_time: string } | undefined)
            ?.current_time || new Date().toISOString(),
      };
    } catch (error) {
      this.log.error("Overall health check failed:", error);
      reply.status(500);
      return {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });
};

export default healthRoutes;
