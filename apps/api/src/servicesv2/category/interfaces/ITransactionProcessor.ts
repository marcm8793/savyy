import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { schema } from "../../../../db/schema";
import { TinkTransaction } from "../../../services/transaction/types";
import { 
  AnonymizedTransaction, 
  CategorizationResult, 
  BatchProcessingResult 
} from "../types";

/**
 * Interface for Transaction Processing Service
 * 
 * Defines the contract for transaction categorization orchestration,
 * including anonymization, batch processing, and result mapping.
 */
export interface ITransactionProcessor {
  /**
   * Categorizes a batch of transactions using AI
   * 
   * @param db - Database instance
   * @param transactions - Array of Tink transactions
   * @returns Promise resolving to map of transaction IDs to categorization results
   */
  categorizeBatch(
    db: NodePgDatabase<typeof schema>,
    transactions: TinkTransaction[]
  ): Promise<Map<string, CategorizationResult>>;

  /**
   * Anonymizes a single transaction for AI processing
   * 
   * @param transaction - Tink transaction to anonymize
   * @returns Anonymized transaction object
   */
  anonymizeTransaction(transaction: TinkTransaction): AnonymizedTransaction;

  /**
   * Processes multiple batches of transactions in parallel
   * 
   * @param db - Database instance
   * @param transactions - Array of Tink transactions
   * @param batchSize - Size of each batch
   * @returns Promise resolving to batch processing results
   */
  processInBatches(
    db: NodePgDatabase<typeof schema>,
    transactions: TinkTransaction[],
    batchSize: number
  ): Promise<BatchProcessingResult>;

  /**
   * Validates transaction data before processing
   * 
   * @param transaction - Transaction to validate
   * @returns True if transaction is valid for processing
   */
  validateTransaction(transaction: TinkTransaction): boolean;

  /**
   * Gets processing statistics
   * 
   * @returns Processing metrics and statistics
   */
  getProcessingStats(): {
    totalProcessed: number;
    successfullyProcessed: number;
    errors: number;
    averageProcessingTime: number;
    lastProcessedAt: Date | null;
  };

  /**
   * Sanitizes transaction description for AI processing
   * 
   * @param description - Raw transaction description
   * @returns Sanitized description with sensitive data removed
   */
  sanitizeDescription(description: string): string;

  /**
   * Creates a consistent merchant hash for anonymization
   * 
   * @param merchantData - Merchant information
   * @returns 8-character merchant hash
   */
  createMerchantHash(merchantData: string): string;
}