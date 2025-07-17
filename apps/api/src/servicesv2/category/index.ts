/**
 * Category Microservices - Public API
 * 
 * This module provides a microservice architecture for transaction categorization
 * with clear separation of concerns between AI services, category management,
 * and transaction processing.
 */

// Main Services
export { CategoryService } from "./services/CategoryService";
export { AIService } from "./services/AIService";
export { TransactionCategorizationService } from "./services/TransactionCategorizationService";
export { ConsoleLogger } from "./services/ConsoleLogger";

// Interfaces
export { ICategoryService } from "./interfaces/ICategoryService";
export { IAIService } from "./interfaces/IAIService";
export { ITransactionProcessor } from "./interfaces/ITransactionProcessor";

// Types
export * from "./types";

// Factory
export { CategoryServiceFactory } from "./CategoryServiceFactory";

// Convenience exports for backward compatibility
export { TransactionCategorizationService as AICategorizationService } from "./services/TransactionCategorizationService";

/**
 * Quick Start Example:
 * 
 * ```typescript
 * import { CategoryServiceFactory } from "./servicesv2/category";
 * 
 * // Create complete service with default configuration
 * const service = CategoryServiceFactory.createTransactionCategorizationService();
 * 
 * // Use the service
 * const results = await service.categorizeBatch(db, transactions);
 * ```
 * 
 * Advanced Usage:
 * 
 * ```typescript
 * import { CategoryServiceFactory, ConsoleLogger } from "./servicesv2/category";
 * 
 * // Create with custom configuration
 * const service = CategoryServiceFactory.createTransactionCategorizationService({
 *   aiConfig: {
 *     model: "claude-3-sonnet-20240229",
 *     timeout: 60000,
 *   },
 *   categoryConfig: {
 *     cacheTimeToLive: 10 * 60 * 1000, // 10 minutes
 *   },
 *   transactionConfig: {
 *     batchSize: 10,
 *   },
 * });
 * 
 * // Create individual services
 * const categoryService = CategoryServiceFactory.createCategoryService();
 * const aiService = CategoryServiceFactory.createAIService();
 * ```
 */