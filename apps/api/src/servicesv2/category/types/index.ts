/**
 * Shared types for Category Microservices
 */

export interface CategorizationResult {
  mainCategory: string;
  subCategory: string;
  userModified: boolean;
}

export interface AnonymizedTransaction {
  merchantHash: string;
  descriptionSanitized: string;
  amount: number;
  transactionType: 'credit' | 'debit';
}

export interface CategoryStructure {
  mainCategory: string;
  subcategories: string[];
}

export interface Logger {
  error(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
}

export interface AIApiResponse {
  content?: Array<{ text?: string }>;
}

export interface AIRequestPayload {
  model: string;
  max_tokens: number;
  temperature: number;
  system: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface BatchProcessingResult {
  results: Map<string, CategorizationResult>;
  errors: string[];
  processedCount: number;
}

export interface AIServiceConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  timeout: number;
  maxTokens: number;
  temperature: number;
}

export interface CategoryServiceConfig {
  cacheTimeToLive: number;
}

export interface TransactionCategorizationConfig {
  batchSize: number;
  enableParallelProcessing: boolean;
}