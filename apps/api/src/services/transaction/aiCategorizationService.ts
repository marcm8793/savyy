import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { schema, mainCategory as mainCategoryTable, subCategory as subCategoryTable } from "../../../db/schema";
import { TinkTransaction } from "./types";
import crypto from "crypto";

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

  constructor() {}

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
    const anonymizedTransactions = transactions.map(tx => this.anonymizeTransaction(tx));
    
    // Process in batches of 20 for efficiency
    const batchSize = 20;
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
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Error in AI categorization batch:", errorMessage);
        
        // Fallback to "To Classify" for failed batch
        originalBatch.forEach(tx => {
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

  private async getCategories(db: NodePgDatabase<typeof schema>): Promise<CategoryStructure[]> {
    // Check cache first
    if (this.categoryCache && Date.now() < this.cacheExpiry) {
      return this.categoryCache;
    }

    // Fetch categories from database
    const mainCategories = await db.select().from(mainCategoryTable).orderBy(mainCategoryTable.sortOrder);
    const subCategories = await db.select().from(subCategoryTable).orderBy(subCategoryTable.sortOrder);

    // Group subcategories by main category
    const categoryMap = new Map<string, string[]>();
    
    mainCategories.forEach(main => {
      categoryMap.set(main.name, []);
    });

    subCategories.forEach(sub => {
      // Find the main category name by ID
      const mainCat = mainCategories.find(main => main.id === sub.mainCategoryId);
      if (mainCat) {
        const subcats = categoryMap.get(mainCat.name);
        if (subcats) {
          subcats.push(sub.name);
        }
      }
    });

    // Convert to array format
    this.categoryCache = Array.from(categoryMap.entries()).map(([mainCategory, subcategories]) => ({
      mainCategory,
      subcategories,
    }));

    this.cacheExpiry = Date.now() + this.CACHE_TTL;
    return this.categoryCache;
  }

  private anonymizeTransaction(transaction: TinkTransaction): AnonymizedTransaction {
    // Hash merchant information to protect privacy
    const merchantData = transaction.merchantInformation?.merchantName || 
                        transaction.descriptions?.display || 
                        "unknown";
    const merchantHash = crypto.createHash("sha256").update(merchantData.toLowerCase()).digest("hex").substring(0, 8);

    // Sanitize description by removing potential account numbers, personal info
    let description = transaction.descriptions?.display || transaction.descriptions?.original || "";
    
    // Remove potential account numbers (sequences of 4+ digits)
    description = description.replace(/\b\d{4,}\b/g, "[NUMBER]");
    
    // Remove potential personal identifiers
    description = description.replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g, "[IBAN]");
    description = description.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[CARD]");
    
    // Extract transaction amount
    const amount = Math.abs(parseFloat(transaction.amount.value.unscaledValue) / Math.pow(10, parseInt(transaction.amount.value.scale)));
    
    // Determine transaction type
    const transactionType = parseFloat(transaction.amount.value.unscaledValue) >= 0 ? "credit" : "debit";

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
      // Make API call to AI model
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.AI_API_KEY || "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
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

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as { content?: Array<{ text?: string }> };
      const content = result.content?.[0]?.text;

      if (!content) {
        throw new Error("No content received from AI API");
      }

      // Parse AI response
      return this.parseAIResponse(content, transactions.length);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Error calling AI API:", errorMessage);
      
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
      .map(cat => `${cat.mainCategory}: ${cat.subcategories.join(", ")}`)
      .join("\n");

    return `You are a financial transaction categorization expert. Your task is to categorize anonymized banking transactions into the provided category structure.

IMPORTANT RULES:
1. All data is anonymized - merchant names are hashed, personal info is removed
2. You must ONLY use categories from the provided list
3. If you cannot confidently categorize a transaction, use "To Classify: Needs Review"
4. Return results as JSON array with mainCategory and subCategory fields
5. Be consistent with similar transactions

Available Categories:
${categoryList}

Return format: [{"mainCategory": "Category Name", "subCategory": "Subcategory Name"}, ...]`;
  }

  private buildUserPrompt(transactions: AnonymizedTransaction[]): string {
    const transactionList = transactions
      .map((tx, index) => 
        `${index + 1}. Merchant: ${tx.merchantHash}, Description: "${tx.descriptionSanitized}", Amount: ${tx.amount} ${tx.transactionType}`
      )
      .join("\n");

    return `Please categorize these ${transactions.length} anonymized transactions:

${transactionList}

Return a JSON array with exactly ${transactions.length} categorization results in the same order.`;
  }

  private parseAIResponse(content: string, expectedCount: number): CategorizationResult[] {
    try {
      // Extract JSON from response (handle potential markdown formatting)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("No JSON array found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]) as unknown;
      
      if (!Array.isArray(parsed) || parsed.length !== expectedCount) {
        throw new Error(`Expected ${expectedCount} results, got ${Array.isArray(parsed) ? parsed.length : 'non-array'}`);
      }

      return parsed.map((item: unknown) => {
        const result = item as { mainCategory?: string; subCategory?: string };
        return {
          mainCategory: result.mainCategory || "To Classify",
          subCategory: result.subCategory || "Needs Review",
          userModified: false,
        };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Error parsing AI response:", errorMessage);
      
      // Return fallback results
      return Array.from({ length: expectedCount }, () => ({
        mainCategory: "To Classify",
        subCategory: "Needs Review",
        userModified: false,
      }));
    }
  }
}