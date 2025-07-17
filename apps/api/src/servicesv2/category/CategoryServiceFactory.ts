import { CategoryService } from "./services/CategoryService";
import { AIService } from "./services/AIService";
import { TransactionCategorizationService } from "./services/TransactionCategorizationService";
import { ConsoleLogger } from "./services/ConsoleLogger";
import { 
  AIServiceConfig, 
  CategoryServiceConfig, 
  TransactionCategorizationConfig,
  Logger 
} from "./types";

/**
 * Factory for creating Category Microservices
 * 
 * Provides centralized service creation with proper dependency injection
 * and configuration management. Thread-safe with no static state manipulation.
 */
export class CategoryServiceFactory {
  private static defaultLogger: Logger = new ConsoleLogger();

  /**
   * Creates a complete transaction categorization service with all dependencies
   */
  static createTransactionCategorizationService(
    customConfigs?: {
      aiConfig?: Partial<AIServiceConfig>;
      categoryConfig?: Partial<CategoryServiceConfig>;
      transactionConfig?: Partial<TransactionCategorizationConfig>;
    },
    logger?: Logger
  ): TransactionCategorizationService {
    const serviceLogger = logger || this.defaultLogger;

    // Create AI service configuration
    const aiConfig: AIServiceConfig = {
      apiKey: process.env.AI_API_KEY || "",
      apiUrl: process.env.AI_API_URL || "https://api.anthropic.com/v1/messages",
      model: process.env.AI_MODEL || "claude-3-haiku-20240307",
      timeout: parseInt(process.env.AI_API_TIMEOUT || "30000", 10),
      maxTokens: 4000,
      temperature: 0,
      ...customConfigs?.aiConfig,
    };

    // Create category service configuration
    const categoryConfig: CategoryServiceConfig = {
      cacheTimeToLive: 5 * 60 * 1000, // 5 minutes
      ...customConfigs?.categoryConfig,
    };

    // Create transaction categorization configuration
    const transactionConfig: TransactionCategorizationConfig = {
      batchSize: parseInt(process.env.AI_BATCH_SIZE || "20", 10),
      enableParallelProcessing: false,
      ...customConfigs?.transactionConfig,
    };

    // Create services
    const categoryService = new CategoryService(categoryConfig, serviceLogger);
    const aiService = new AIService(aiConfig, serviceLogger);
    const transactionCategorizationService = new TransactionCategorizationService(
      categoryService,
      aiService,
      transactionConfig,
      serviceLogger
    );

    return transactionCategorizationService;
  }

  /**
   * Creates just the category service
   */
  static createCategoryService(
    config?: Partial<CategoryServiceConfig>,
    logger?: Logger
  ): CategoryService {
    const categoryConfig: CategoryServiceConfig = {
      cacheTimeToLive: 5 * 60 * 1000, // 5 minutes
      ...config,
    };

    return new CategoryService(categoryConfig, logger || this.defaultLogger);
  }

  /**
   * Creates just the AI service
   */
  static createAIService(
    config?: Partial<AIServiceConfig>,
    logger?: Logger
  ): AIService {
    const aiConfig: AIServiceConfig = {
      apiKey: process.env.AI_API_KEY || "",
      apiUrl: process.env.AI_API_URL || "https://api.anthropic.com/v1/messages",
      model: process.env.AI_MODEL || "claude-3-haiku-20240307",
      timeout: parseInt(process.env.AI_API_TIMEOUT || "30000", 10),
      maxTokens: 4000,
      temperature: 0,
      ...config,
    };

    return new AIService(aiConfig, logger || this.defaultLogger);
  }

  /**
   * Creates services with custom logger (thread-safe)
   */
  static createServicesWithLogger(
    logger: Logger,
    configs?: {
      aiConfig?: Partial<AIServiceConfig>;
      categoryConfig?: Partial<CategoryServiceConfig>;
      transactionConfig?: Partial<TransactionCategorizationConfig>;
    }
  ): {
    categoryService: CategoryService;
    aiService: AIService;
    transactionCategorizationService: TransactionCategorizationService;
  } {
    // Direct logger passing - no static state manipulation
    const categoryService = this.createCategoryService(configs?.categoryConfig, logger);
    const aiService = this.createAIService(configs?.aiConfig, logger);
    const transactionCategorizationService = this.createTransactionCategorizationService(configs, logger);

    return {
      categoryService,
      aiService,
      transactionCategorizationService,
    };
  }

  /**
   * Validates environment variables required for services
   */
  static validateEnvironment(): {
    isValid: boolean;
    missingVars: string[];
    warnings: string[];
  } {
    const missingVars: string[] = [];
    const warnings: string[] = [];

    // Required environment variables
    if (!process.env.AI_API_KEY) {
      missingVars.push("AI_API_KEY");
    }

    // Optional with warnings
    if (!process.env.AI_API_URL) {
      warnings.push("AI_API_URL not set, using default");
    }

    if (!process.env.AI_MODEL) {
      warnings.push("AI_MODEL not set, using default");
    }

    if (!process.env.AI_BATCH_SIZE) {
      warnings.push("AI_BATCH_SIZE not set, using default");
    }

    if (!process.env.AI_API_TIMEOUT) {
      warnings.push("AI_API_TIMEOUT not set, using default");
    }

    return {
      isValid: missingVars.length === 0,
      missingVars,
      warnings,
    };
  }
}