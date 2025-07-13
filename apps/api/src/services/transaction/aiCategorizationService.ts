import { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  schema,
  mainCategory as mainCategoryTable,
  subCategory as subCategoryTable,
} from "../../../db/schema";
import { TinkTransaction } from "./types";
import crypto from "crypto";

interface Logger {
  error(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
}

// Simple console logger implementation
class ConsoleLogger implements Logger {
  error(message: string, context?: Record<string, unknown>): void {
    if (context) {
      try {
        console.error(message, JSON.stringify(context));
      } catch {
        console.error(message, "[Context contains non-serializable data]");
      }
    } else {
      console.error(message);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (context) {
      try {
        console.warn(message, JSON.stringify(context));
      } catch {
        console.warn(message, "[Context contains non-serializable data]");
      }
    } else {
      console.warn(message);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (context) {
      try {
        console.info(message, JSON.stringify(context));
      } catch {
        console.info(message, "[Context contains non-serializable data]");
      }
    } else {
      console.info(message);
    }
  }
}

export interface CategorizationResult {
  mainCategory: string;
  subCategory: string;
  userModified: boolean;
}

export interface AnonymizedTransaction {
  merchantHash: string;
  descriptionSanitized: string;
  amount: number;
  transactionType: string;
}

export interface CategoryStructure {
  mainCategory: string;
  subcategories: string[];
}

export class AICategorizationService {
  private categoryCache: CategoryStructure[] | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private readonly BATCH_SIZE = (() => {
    const value = parseInt(process.env.AI_BATCH_SIZE || "20", 10);
    return isNaN(value) || value <= 0 ? 20 : value;
  })();
  private readonly AI_API_URL =
    process.env.AI_API_URL || "https://api.anthropic.com/v1/messages";
  private readonly AI_MODEL = process.env.AI_MODEL || "claude-3-haiku-20240307";
  private readonly API_TIMEOUT = parseInt(
    process.env.AI_API_TIMEOUT || "30000",
    10
  ); // 30 seconds
  private readonly logger: Logger = new ConsoleLogger();

  constructor() {
    if (!process.env.AI_API_KEY) {
      throw new Error("AI_API_KEY environment variable is required");
    }
  }

  async categorizeBatch(
    db: NodePgDatabase<typeof schema>,
    transactions: TinkTransaction[]
  ): Promise<Map<string, CategorizationResult>> {
    const results = new Map<string, CategorizationResult>();

    if (transactions.length === 0) {
      return results;
    }

    // Get available categories from database
    const categories = await this.getCategories(db);

    // Anonymize transactions for AI processing
    const anonymizedTransactions = transactions.map((tx) =>
      this.anonymizeTransaction(tx)
    );

    // Process in batches for efficiency
    const batchSize = this.BATCH_SIZE;
    for (let i = 0; i < anonymizedTransactions.length; i += batchSize) {
      const batch = anonymizedTransactions.slice(i, i + batchSize);
      const originalBatch = transactions.slice(i, i + batchSize);

      try {
        const batchResults = await this.classifyWithAI(batch, categories);

        // Map results back to original transaction IDs
        batchResults.forEach((result, index) => {
          const originalTx = originalBatch[index];
          if (originalTx) {
            results.set(originalTx.id, result);
          }
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        this.logger.error("Error in AI categorization batch", {
          error: errorMessage,
          batchSize: originalBatch.length,
          batchStartIndex: i,
        });

        // Fallback to "To Classify" for failed batch
        originalBatch.forEach((tx) => {
          results.set(tx.id, {
            mainCategory: "To Classify",
            subCategory: "Needs Review",
            userModified: false,
          });
        });
      }
    }

    return results;
  }

  /**
   * Invalidate the category cache to force reload from database
   * Call this method when categories are updated
   */
  invalidateCache(): void {
    this.categoryCache = null;
    this.cacheExpiry = 0;
  }

  private async getCategories(
    db: NodePgDatabase<typeof schema>
  ): Promise<CategoryStructure[]> {
    // Check cache first
    if (this.categoryCache && Date.now() < this.cacheExpiry) {
      return this.categoryCache;
    }

    // Fetch categories from database
    const mainCategories = await db
      .select()
      .from(mainCategoryTable)
      .orderBy(mainCategoryTable.sortOrder);
    const subCategories = await db
      .select()
      .from(subCategoryTable)
      .orderBy(subCategoryTable.sortOrder);

    // Group subcategories by main category
    const categoryMap = new Map<string, string[]>();

    mainCategories.forEach((main) => {
      categoryMap.set(main.name, []);
    });

    subCategories.forEach((sub) => {
      // Find the main category name by ID
      const mainCat = mainCategories.find(
        (main) => main.id === sub.mainCategoryId
      );
      if (mainCat) {
        const subcats = categoryMap.get(mainCat.name);
        if (subcats) {
          subcats.push(sub.name);
        }
      }
    });

    // Convert to array format
    this.categoryCache = Array.from(categoryMap.entries()).map(
      ([mainCategory, subcategories]) => ({
        mainCategory,
        subcategories,
      })
    );

    this.cacheExpiry = Date.now() + this.CACHE_TTL;
    return this.categoryCache;
  }

  private anonymizeTransaction(
    transaction: TinkTransaction
  ): AnonymizedTransaction {
    // Hash merchant information to protect privacy
    const merchantData =
      transaction.merchantInformation?.merchantName ||
      transaction.descriptions?.display ||
      "unknown";
    const merchantHash = crypto
      .createHash("sha256")
      .update(merchantData.toLowerCase())
      .digest("hex")
      .substring(0, 8);

    // Sanitize description by removing potential account numbers, personal info
    let description =
      transaction.descriptions?.display ||
      transaction.descriptions?.original ||
      "";

    // Remove potential account numbers (sequences of 4+ digits)
    description = description.replace(/\b\d{4,}\b/g, "[NUMBER]");

    // Remove potential personal identifiers
    description = description.replace(
      /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g,
      "[IBAN]"
    );
    description = description.replace(
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      "[CARD]"
    );

    // Extract transaction amount
    const amount = Math.abs(
      parseFloat(transaction.amount.value.unscaledValue) /
        Math.pow(10, parseInt(transaction.amount.value.scale))
    );

    // Determine transaction type
    const transactionType =
      parseFloat(transaction.amount.value.unscaledValue) >= 0
        ? "credit"
        : "debit";

    return {
      merchantHash,
      descriptionSanitized: description.trim(),
      amount,
      transactionType,
    };
  }

  private async classifyWithAI(
    transactions: AnonymizedTransaction[],
    categories: CategoryStructure[]
  ): Promise<CategorizationResult[]> {
    // Create the prompt for AI model
    const systemPrompt = this.buildSystemPrompt(categories);
    const userPrompt = this.buildUserPrompt(transactions);

    try {
      // Set up timeout for API call
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.API_TIMEOUT);

      // Make API call to AI model
      const response = await fetch(this.AI_API_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.AI_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.AI_MODEL,
          max_tokens: 4000,
          temperature: 0,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: userPrompt,
            },
          ],
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `AI API error: ${response.status} ${response.statusText}`
        );
      }

      const result = (await response.json()) as {
        content?: Array<{ text?: string }>;
      };
      const content = result.content?.[0]?.text;

      if (!content) {
        throw new Error("No content received from AI API");
      }

      // Parse AI response
      return this.parseAIResponse(content, transactions.length);
    } catch (error) {
      let errorMessage = "Unknown error";

      if (error instanceof Error) {
        errorMessage = error.message;
        // Handle specific error types
        if (error.name === "AbortError") {
          errorMessage = `AI API timeout after ${this.API_TIMEOUT}ms`;
        }
      }

      this.logger.error("Error calling AI API", {
        error: errorMessage,
        transactionCount: transactions.length,
        apiUrl: this.AI_API_URL,
        model: this.AI_MODEL,
      });

      // Return fallback classifications
      return transactions.map(() => ({
        mainCategory: "To Classify",
        subCategory: "Needs Review",
        userModified: false,
      }));
    }
  }

  private buildSystemPrompt(categories: CategoryStructure[]): string {
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

  private buildUserPrompt(transactions: AnonymizedTransaction[]): string {
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

  private validateCategoryPair(
    mainCategory: string,
    subCategory: string
  ): boolean {
    // Get fresh categories if cache is empty
    if (!this.categoryCache || this.categoryCache.length === 0) {
      return false;
    }

    // Find the main category
    const mainCat = this.categoryCache.find(
      (cat) => cat.mainCategory === mainCategory
    );

    if (!mainCat) {
      return false;
    }

    // Check if subcategory exists under this main category
    return mainCat.subcategories.includes(subCategory);
  }

  private parseAIResponse(
    content: string,
    expectedCount: number
  ): CategorizationResult[] {
    try {
      // Extract JSON from response (handle potential markdown formatting)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("No JSON array found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]) as unknown;

      if (!Array.isArray(parsed) || parsed.length !== expectedCount) {
        throw new Error(
          `Expected ${expectedCount} results, got ${
            Array.isArray(parsed) ? parsed.length : "non-array"
          }`
        );
      }

      return parsed.map((item: unknown) => {
        const result = item as { mainCategory?: string; subCategory?: string };

        // Validate that the returned categories exist in our predefined list
        const isValidCategory = this.validateCategoryPair(
          result.mainCategory || "",
          result.subCategory || ""
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
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
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
}
