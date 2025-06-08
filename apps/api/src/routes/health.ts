import { FastifyPluginAsync } from "fastify";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/health/db", async function (request, reply) {
    try {
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
};

export default healthRoutes;
