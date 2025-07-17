import { IAIService } from "../interfaces/IAIService";
import { 
  AnonymizedTransaction, 
  CategorizationResult, 
  CategoryStructure,
  AIApiResponse,
  AIRequestPayload,
  AIServiceConfig,
  Logger 
} from "../types";

/**
 * AI Service for Transaction Categorization
 * 
 * Handles all AI-related operations including API communication,
 * prompt generation, and response parsing with validation.
 */
export class AIService implements IAIService {
  private readonly config: AIServiceConfig;
  private readonly logger: Logger;
  private lastSuccessfulCall: Date | null = null;
  private consecutiveFailures: number = 0;

  constructor(config: AIServiceConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    
    if (!this.validateConfiguration()) {
      throw new Error("Invalid AI service configuration");
    }

    this.logger.info("AIService initialized", {
      apiUrl: config.apiUrl,
      model: config.model,
      timeout: config.timeout,
      hasApiKey: !!config.apiKey,
    });
  }

  /**
   * Classifies a batch of anonymized transactions using AI
   */
  async classifyTransactions(
    transactions: AnonymizedTransaction[],
    categories: CategoryStructure[]
  ): Promise<CategorizationResult[]> {
    if (transactions.length === 0) {
      this.logger.warn("Empty transaction batch provided for AI classification");
      return [];
    }

    const startTime = Date.now();
    this.logger.info("Starting AI classification", {
      transactionCount: transactions.length,
      categoryCount: categories.length,
    });

    try {
      // Generate prompts
      const systemPrompt = this.buildSystemPrompt(categories);
      const userPrompt = this.buildUserPrompt(transactions);

      // Call AI API
      const apiResponse = await this.callAIApi(systemPrompt, userPrompt);
      
      // Parse and validate response
      const content = apiResponse.content?.[0]?.text;
      if (!content) {
        throw new Error("No content received from AI API");
      }

      const results = this.parseResponse(content, transactions.length, categories);
      
      // Update success metrics
      this.lastSuccessfulCall = new Date();
      this.consecutiveFailures = 0;
      
      const processingTime = Date.now() - startTime;
      this.logger.info("AI classification completed successfully", {
        transactionCount: transactions.length,
        processingTimeMs: processingTime,
        successfulClassifications: results.filter(r => r.mainCategory !== "To Classify").length,
      });

      return results;
    } catch (error) {
      this.consecutiveFailures++;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      this.logger.error("AI classification failed", {
        error: errorMessage,
        transactionCount: transactions.length,
        consecutiveFailures: this.consecutiveFailures,
        processingTimeMs: Date.now() - startTime,
      });

      // Return fallback classifications
      return transactions.map(() => ({
        mainCategory: "To Classify",
        subCategory: "Needs Review",
        userModified: false,
      }));
    }
  }

  /**
   * Builds the system prompt for AI categorization
   */
  buildSystemPrompt(categories: CategoryStructure[]): string {
    const categoryList = categories
      .map((cat) => `${cat.mainCategory}: ${cat.subcategories.join(", ")}`)
      .join("\n");

    return `You are a financial transaction categorization expert. Your task is to categorize anonymized banking transactions into the provided category structure.

CRITICAL RULES - STRICTLY ENFORCE:
1. All data is anonymized - merchant names are hashed, personal info is removed
2. You must ONLY use categories from the provided list below - DO NOT invent new categories
3. Each mainCategory must match exactly one of the main categories shown below
4. Each subCategory must match exactly one of the subcategories under that main category
5. If you cannot confidently categorize a transaction, use "To Classify" as mainCategory and "Needs Review" as subCategory
6. NEVER create new category names or modify existing ones
7. Return results as JSON array with mainCategory and subCategory fields
8. Be consistent with similar transactions

Available Categories (mainCategory: subcategory1, subcategory2, ...):
${categoryList}

Return format: [{"mainCategory": "Category Name", "subCategory": "Subcategory Name"}, ...]
REMINDER: Use ONLY the exact category names from the list above. Any invented categories will be rejected.`;
  }

  /**
   * Builds the user prompt for a batch of transactions
   */
  buildUserPrompt(transactions: AnonymizedTransaction[]): string {
    const transactionList = transactions
      .map(
        (tx, index) =>
          `${index + 1}. Merchant: ${tx.merchantHash}, Description: "${
            tx.descriptionSanitized
          }", Amount: ${tx.amount} ${tx.transactionType}`
      )
      .join("\n");

    return `Please categorize these ${transactions.length} anonymized transactions:

${transactionList}

Return a JSON array with exactly ${transactions.length} categorization results in the same order.`;
  }

  /**
   * Parses AI API response and validates categories
   */
  parseResponse(
    content: string,
    expectedCount: number,
    categories: CategoryStructure[]
  ): CategorizationResult[] {
    try {
      // Extract JSON from response (handle potential markdown formatting)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("No JSON array found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]) as unknown;

      if (!Array.isArray(parsed)) {
        throw new Error("Response is not an array");
      }

      if (parsed.length !== expectedCount) {
        this.logger.warn("AI response count mismatch", {
          expected: expectedCount,
          received: parsed.length,
        });
        
        // If we got fewer results than expected, fill with fallback
        while (parsed.length < expectedCount) {
          parsed.push({});
        }
        
        // If we got more results than expected, truncate
        if (parsed.length > expectedCount) {
          parsed.splice(expectedCount);
        }
      }

      return parsed.map((item: unknown, index: number) => {
        const result = item as { mainCategory?: string; subCategory?: string };

        // Validate that the returned categories exist in our predefined list
        const isValidCategory = this.validateCategoryPair(
          result.mainCategory || "",
          result.subCategory || "",
          categories
        );

        if (isValidCategory) {
          return {
            mainCategory: result.mainCategory || "To Classify",
            subCategory: result.subCategory || "Needs Review",
            userModified: false,
          };
        } else {
          // AI returned invalid categories, fallback to "To Classify"
          this.logger.warn("AI returned invalid category combination", {
            index,
            aiMainCategory: result.mainCategory,
            aiSubCategory: result.subCategory,
          });
          return {
            mainCategory: "To Classify",
            subCategory: "Needs Review",
            userModified: false,
          };
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error("Error parsing AI response", {
        error: errorMessage,
        expectedCount,
        responseContentLength: content?.length || 0,
      });

      // Return fallback results
      return Array.from({ length: expectedCount }, () => ({
        mainCategory: "To Classify",
        subCategory: "Needs Review",
        userModified: false,
      }));
    }
  }

  /**
   * Makes a direct API call to the AI service
   */
  async callAIApi(systemPrompt: string, userPrompt: string): Promise<AIApiResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const payload: AIRequestPayload = {
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      };

      const response = await fetch(this.config.apiUrl, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `AI API error: ${response.status} ${response.statusText}`
        );
      }

      return (await response.json()) as AIApiResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`AI API timeout after ${this.config.timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Validates AI service configuration
   */
  validateConfiguration(): boolean {
    const requiredFields = [
      { field: "apiKey", value: this.config.apiKey },
      { field: "apiUrl", value: this.config.apiUrl },
      { field: "model", value: this.config.model },
    ];

    for (const { field, value } of requiredFields) {
      if (!value || typeof value !== "string" || value.trim() === "") {
        this.logger.error(`Invalid AI service configuration: ${field} is required`);
        return false;
      }
    }

    if (this.config.timeout <= 0) {
      this.logger.error("Invalid AI service configuration: timeout must be positive");
      return false;
    }

    return true;
  }

  /**
   * Gets AI service health status
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
  } {
    return {
      isHealthy: this.consecutiveFailures < 5, // Consider unhealthy after 5 consecutive failures
      lastSuccessfulCall: this.lastSuccessfulCall,
      consecutiveFailures: this.consecutiveFailures,
      configuration: {
        hasApiKey: !!this.config.apiKey,
        apiUrl: this.config.apiUrl,
        model: this.config.model,
        timeout: this.config.timeout,
      },
    };
  }

  /**
   * Validates category pair against available categories
   */
  private validateCategoryPair(
    mainCategory: string,
    subCategory: string,
    categories: CategoryStructure[]
  ): boolean {
    if (!mainCategory || !subCategory) {
      return false;
    }

    // Find the main category
    const mainCat = categories.find(
      (cat) => cat.mainCategory === mainCategory
    );

    if (!mainCat) {
      return false;
    }

    // Check if subcategory exists under this main category
    return mainCat.subcategories.includes(subCategory);
  }
}