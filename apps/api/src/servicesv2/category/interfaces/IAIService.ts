import { 
  AnonymizedTransaction, 
  CategorizationResult, 
  CategoryStructure,
  AIApiResponse 
} from "../types";

/**
 * Interface for AI Service
 * 
 * Defines the contract for AI-related operations including
 * prompt generation, API communication, and response parsing.
 */
export interface IAIService {
  /**
   * Classifies a batch of anonymized transactions using AI
   * 
   * @param transactions - Array of anonymized transactions
   * @param categories - Available category structures
   * @returns Promise resolving to array of categorization results
   */
  classifyTransactions(
    transactions: AnonymizedTransaction[],
    categories: CategoryStructure[]
  ): Promise<CategorizationResult[]>;

  /**
   * Builds the system prompt for AI categorization
   * 
   * @param categories - Available category structures
   * @returns System prompt string
   */
  buildSystemPrompt(categories: CategoryStructure[]): string;

  /**
   * Builds the user prompt for a batch of transactions
   * 
   * @param transactions - Array of anonymized transactions
   * @returns User prompt string
   */
  buildUserPrompt(transactions: AnonymizedTransaction[]): string;

  /**
   * Parses AI API response and validates categories
   * 
   * @param content - Raw AI response content
   * @param expectedCount - Expected number of results
   * @param categories - Available categories for validation
   * @returns Array of categorization results
   */
  parseResponse(
    content: string,
    expectedCount: number,
    categories: CategoryStructure[]
  ): CategorizationResult[];

  /**
   * Makes a direct API call to the AI service
   * 
   * @param systemPrompt - System prompt
   * @param userPrompt - User prompt
   * @returns Promise resolving to AI API response
   */
  callAIApi(systemPrompt: string, userPrompt: string): Promise<AIApiResponse>;

  /**
   * Validates AI service configuration
   * 
   * @returns True if configuration is valid
   */
  validateConfiguration(): boolean;

  /**
   * Gets AI service health status
   * 
   * @returns Health status object
   */
  getHealthStatus(): {
    isHealthy: boolean;
    lastSuccessfulCall: Date | null;
    consecutiveFailures: number;
    configuration: {
      hasApiKey: boolean;
      apiUrl: string;
      model: string;
      timeout: number;
    };
  };
}