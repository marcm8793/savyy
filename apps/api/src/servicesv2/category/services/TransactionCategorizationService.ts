import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { schema } from "../../../../db/schema";
import { TinkTransaction } from "../../../services/transaction/types";
import { ITransactionProcessor } from "../interfaces/ITransactionProcessor";
import { ICategoryService } from "../interfaces/ICategoryService";
import { IAIService } from "../interfaces/IAIService";
import {
  AnonymizedTransaction,
  CategorizationResult,
  BatchProcessingResult,
  TransactionCategorizationConfig,
  Logger,
} from "../types";
import crypto from "crypto";

/**
 * Transaction Categorization Service
 *
 * Orchestrates the transaction categorization process by coordinating
 * between CategoryService and AIService. Handles transaction anonymization,
 * batch processing, and result mapping.
 */
export class TransactionCategorizationService implements ITransactionProcessor {
  private readonly config: TransactionCategorizationConfig;
  private readonly logger: Logger;
  private readonly categoryService: ICategoryService;
  private readonly aiService: IAIService;

  // Processing statistics
  private stats = {
    totalProcessed: 0,
    successfullyProcessed: 0,
    errors: 0,
    processingTimes: [] as number[],
    lastProcessedAt: null as Date | null,
  };

  constructor(
    categoryService: ICategoryService,
    aiService: IAIService,
    config: TransactionCategorizationConfig,
    logger: Logger
  ) {
    this.categoryService = categoryService;
    this.aiService = aiService;
    this.config = config;
    this.logger = logger;

    this.logger.info("TransactionCategorizationService initialized", {
      batchSize: config.batchSize,
      enableParallelProcessing: config.enableParallelProcessing,
    });
  }

  /**
   * Categorizes a batch of transactions using AI
   */
  async categorizeBatch(
    db: NodePgDatabase<typeof schema>,
    transactions: TinkTransaction[]
  ): Promise<Map<string, CategorizationResult>> {
    const startTime = Date.now();
    const results = new Map<string, CategorizationResult>();

    if (transactions.length === 0) {
      this.logger.info("Empty transaction batch provided");
      return results;
    }

    this.logger.info("Starting batch categorization", {
      transactionCount: transactions.length,
      batchSize: this.config.batchSize,
    });

    try {
      // Get available categories from database
      const categories = await this.categoryService.getCategories(db);

      if (categories.length === 0) {
        this.logger.error("No categories available for classification");
        // Return fallback for all transactions
        transactions.forEach((tx) => {
          results.set(tx.id, this.categoryService.getFallbackCategory());
        });
        return results;
      }

      // Process transactions in batches
      const batchResults = await this.processInBatches(
        db,
        transactions,
        this.config.batchSize
      );

      // Update statistics
      this.updateStats(
        transactions.length,
        batchResults.processedCount,
        batchResults.errors.length,
        Date.now() - startTime
      );

      this.logger.info("Batch categorization completed", {
        totalTransactions: transactions.length,
        successfullyProcessed: batchResults.processedCount,
        errors: batchResults.errors.length,
        processingTimeMs: Date.now() - startTime,
      });

      return batchResults.results;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error("Batch categorization failed", {
        error: errorMessage,
        transactionCount: transactions.length,
        processingTimeMs: Date.now() - startTime,
      });

      // Return fallback for all transactions
      transactions.forEach((tx) => {
        results.set(tx.id, {
          mainCategory: "To Classify",
          subCategory: "Needs Review",
          userModified: false,
        });
      });

      // Update error statistics
      this.updateStats(
        transactions.length,
        0,
        transactions.length,
        Date.now() - startTime
      );

      return results;
    }
  }

  /**
   * Processes multiple batches of transactions
   */
  async processInBatches(
    db: NodePgDatabase<typeof schema>,
    transactions: TinkTransaction[],
    batchSize: number
  ): Promise<BatchProcessingResult> {
    const results = new Map<string, CategorizationResult>();
    const errors: string[] = [];
    let processedCount = 0;

    // Get categories once for all batches
    const categories = await this.categoryService.getCategories(db);

    // Process transactions in batches
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);

      try {
        // Validate transactions in batch
        const validTransactions = batch.filter((tx) =>
          this.validateTransaction(tx)
        );

        if (validTransactions.length === 0) {
          this.logger.warn("No valid transactions in batch", {
            batchIndex: Math.floor(i / batchSize),
            originalBatchSize: batch.length,
          });
          continue;
        }

        // Anonymize transactions for AI processing
        const anonymizedTransactions = validTransactions.map((tx) =>
          this.anonymizeTransaction(tx)
        );

        // Get AI classifications
        const batchResults = await this.aiService.classifyTransactions(
          anonymizedTransactions,
          categories
        );

        // Map results back to original transaction IDs
        batchResults.forEach((result, index) => {
          const originalTx = validTransactions[index];
          if (originalTx) {
            results.set(originalTx.id, result);
            processedCount++;
          }
        });

        this.logger.info("Batch processed successfully", {
          batchIndex: Math.floor(i / batchSize),
          batchSize: validTransactions.length,
          successfulClassifications: batchResults.filter(
            (r) => r.mainCategory !== "To Classify"
          ).length,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        const batchError = `Batch ${Math.floor(
          i / batchSize
        )}: ${errorMessage}`;
        errors.push(batchError);

        this.logger.error("Batch processing failed", {
          batchIndex: Math.floor(i / batchSize),
          batchSize: batch.length,
          error: errorMessage,
        });

        // Add fallback results for failed batch
        batch.forEach((tx) => {
          results.set(tx.id, {
            mainCategory: "To Classify",
            subCategory: "Needs Review",
            userModified: false,
          });
        });
      }
    }

    return {
      results,
      errors,
      processedCount,
    };
  }

  /**
   * Anonymizes a single transaction for AI processing
   */
  anonymizeTransaction(transaction: TinkTransaction): AnonymizedTransaction {
    // Create merchant hash
    const merchantData =
      transaction.merchantInformation?.merchantName ||
      transaction.descriptions?.display ||
      "unknown";
    const merchantHash = this.createMerchantHash(merchantData);

    // Sanitize description
    const rawDescription =
      transaction.descriptions?.display ||
      transaction.descriptions?.original ||
      "";
    const descriptionSanitized = this.sanitizeDescription(rawDescription);

    // Calculate amount
    const amount = Math.abs(
      parseFloat(transaction.amount.value.unscaledValue) /
        Math.pow(10, parseInt(transaction.amount.value.scale) || 0)
    );

    // Determine transaction type
    const transactionType =
      parseFloat(transaction.amount.value.unscaledValue) >= 0
        ? "credit"
        : "debit";

    return {
      merchantHash,
      descriptionSanitized: descriptionSanitized.trim(),
      amount,
      transactionType,
    };
  }

  /**
   * Validates transaction data before processing
   */
  validateTransaction(transaction: TinkTransaction): boolean {
    // Check required fields
    if (!transaction.id || !transaction.amount) {
      return false;
    }

    // Check amount structure
    if (
      !transaction.amount.value ||
      !transaction.amount.value.unscaledValue ||
      !transaction.amount.currencyCode
    ) {
      return false;
    }

    // Check dates
    if (!transaction.dates || !transaction.dates.booked) {
      return false;
    }

    return true;
  }

  /**
   * Sanitizes transaction description for AI processing
   */
  sanitizeDescription(description: string): string {
    if (!description || typeof description !== "string") {
      return "";
    }

    let sanitized = description;

    // Remove potential account numbers (sequences of 4+ digits)
    sanitized = sanitized.replace(/\b\d{4,}\b/g, "[NUMBER]");

    // Remove potential IBAN patterns
    sanitized = sanitized.replace(
      /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g,
      "[IBAN]"
    );

    // Remove potential credit card patterns
    sanitized = sanitized.replace(
      /\b(?:\d{4}[\s-]?){3}\d{4}\b|\b\d{13,19}\b/g,
      "[CARD]"
    );

    // Remove potential phone numbers
    sanitized = sanitized.replace(
      /\b\+?\d{1,4}[\s-]?\(?\d{1,4}\)?[\s-]?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,4}\b/g,
      "[PHONE]"
    );

    // Remove potential email addresses
    sanitized = sanitized.replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      "[EMAIL]"
    );

    return sanitized;
  }

  /**
   * Creates a consistent merchant hash for anonymization
   */
  createMerchantHash(merchantData: string): string {
    if (!merchantData || typeof merchantData !== "string") {
      merchantData = "unknown";
    }

    return crypto
      .createHash("sha256")
      .update(merchantData.toLowerCase().trim())
      .digest("hex")
      .substring(0, 8);
  }

  /**
   * Gets processing statistics
   */
  getProcessingStats(): {
    totalProcessed: number;
    successfullyProcessed: number;
    errors: number;
    averageProcessingTime: number;
    lastProcessedAt: Date | null;
  } {
    const averageProcessingTime =
      this.stats.processingTimes.length > 0
        ? this.stats.processingTimes.reduce((a, b) => a + b, 0) /
          this.stats.processingTimes.length
        : 0;

    return {
      totalProcessed: this.stats.totalProcessed,
      successfullyProcessed: this.stats.successfullyProcessed,
      errors: this.stats.errors,
      averageProcessingTime,
      lastProcessedAt: this.stats.lastProcessedAt,
    };
  }

  /**
   * Updates processing statistics
   */
  private updateStats(
    totalProcessed: number,
    successfullyProcessed: number,
    errors: number,
    processingTime: number
  ): void {
    this.stats.totalProcessed += totalProcessed;
    this.stats.successfullyProcessed += successfullyProcessed;
    this.stats.errors += errors;
    this.stats.processingTimes.push(processingTime);
    this.stats.lastProcessedAt = new Date();

    // Keep only last 100 processing times for rolling average
    if (this.stats.processingTimes.length > 100) {
      this.stats.processingTimes = this.stats.processingTimes.slice(-100);
    }
  }
}
