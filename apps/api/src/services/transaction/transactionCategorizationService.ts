import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import {
  schema,
  categoryRule,
  mccCategoryMapping,
  mainCategory as mainCategoryTable,
  subCategory as subCategoryTable,
  CategoryRule,
  MccCategoryMapping,
} from "../../../db/schema";
import { TinkTransaction } from "./types";

// Categorization result interface
export interface CategorizationResult {
  mainCategory: string;
  subCategory: string;
  source:
    | "tink"
    | "mcc"
    | "merchant"
    | "description"
    | "amount"
    | "user"
    | "default";
  confidence: number; // 0.0 to 1.0
  ruleId?: string; // ID of the rule that matched
  needsReview: boolean;
}

// Enhanced transaction with categorization
export interface CategorizedTinkTransaction extends TinkTransaction {
  categorization: CategorizationResult;
}

/**
 * Transaction Categorization Service
 * Implements rule-based categorization with multiple strategies:
 * 1. Tink's existing PFM categories (if available)
 * 2. User-specific rules (highest priority)
 * 3. MCC code mapping
 * 4. Merchant name patterns
 * 5. Description patterns
 * 6. Amount-based rules
 * 7. Default fallback
 */
export class TransactionCategorizationService {
  private merchantRulesCache = new Map<string, CategoryRule>();
  private mccMappingCache = new Map<string, MccCategoryMapping>();
  private userRulesCache = new Map<string, CategoryRule[]>();
  private validCategoriesCache = new Set<string>(); // Cache for valid category combinations
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  // TODO: Consider using a more sophisticated caching mechanism (e.g., Redis) for production
  // Add thread-safety to cache operations
  // The caching implementation could have race conditions if multiple requests trigger cache refresh simultaneously. Consider adding mutex/lock mechanism or using a proper caching library.

  constructor() {
    // Initialize with empty cache
  }

  /**
   * Categorize a batch of transactions efficiently
   * Uses caching and batch processing for optimal performance
   */
  async categorizeBatch(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    transactions: TinkTransaction[]
  ): Promise<CategorizedTinkTransaction[]> {
    // Refresh cache if needed
    await this.refreshCacheIfNeeded(db, userId);

    const categorizedTransactions: CategorizedTinkTransaction[] = [];

    for (const transaction of transactions) {
      const categorization = await this.categorizeTransaction(
        db,
        userId,
        transaction
      );
      categorizedTransactions.push({
        ...transaction,
        categorization,
      });
    }

    return categorizedTransactions;
  }

  /**
   * Categorize a single transaction using the rule hierarchy
   */
  async categorizeTransaction(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    transaction: TinkTransaction
  ): Promise<CategorizationResult> {
    // 1. Use Tink's PFM category if available and high confidence
    if (transaction.categories?.pfm?.name) {
      const tinkCategory = this.mapTinkCategoryToOurs(
        transaction.categories.pfm.name
      );
      if (tinkCategory) {
        return {
          ...tinkCategory,
          source: "tink",
          confidence: 0.85,
          needsReview: false,
        };
      }
    }

    // 2. Check user-specific rules (highest priority)
    const userRuleResult = await this.applyUserRules(db, userId, transaction);
    if (userRuleResult) {
      return userRuleResult;
    }

    // 3. Check MCC code mapping
    if (transaction.merchantInformation?.merchantCategoryCode) {
      const mccResult = await this.applyMccMapping(
        db,
        transaction.merchantInformation.merchantCategoryCode
      );
      if (mccResult) {
        return mccResult;
      }
    }

    // 4. Check merchant name patterns
    if (transaction.merchantInformation?.merchantName) {
      const merchantResult = await this.applyMerchantRules(
        db,
        transaction.merchantInformation.merchantName
      );
      if (merchantResult) {
        return merchantResult;
      }
    }

    // 5. Check description patterns
    const descriptionResult = this.applyDescriptionRules(
      transaction.descriptions.display || transaction.descriptions.original
    );
    if (descriptionResult) {
      return descriptionResult;
    }

    // 6. Check amount-based rules
    const amount = this.parseAmount(transaction.amount);
    const amountResult = this.applyAmountRules(amount);
    if (amountResult) {
      return amountResult;
    }

    // 7. Default fallback
    return this.getDefaultCategory(amount);
  }

  /**
   * Validate that a category combination exists in categoryDefinition table
   */
  private async validateCategories(
    db: NodePgDatabase<typeof schema>,
    mainCategory: string,
    subCategory: string
  ): Promise<boolean> {
    const cacheKey = `${mainCategory}:${subCategory}`;

    // Check cache first
    if (this.validCategoriesCache.has(cacheKey)) {
      return true;
    }

    // Query database to check if category exists
    const categoryExists = await db
      .select({
        id: subCategoryTable.id,
        mainCategory: mainCategoryTable.name,
        subCategory: subCategoryTable.name,
      })
      .from(subCategoryTable)
      .innerJoin(mainCategoryTable, eq(subCategoryTable.mainCategoryId, mainCategoryTable.id))
      .where(
        and(
          eq(mainCategoryTable.name, mainCategory),
          eq(subCategoryTable.name, subCategory),
          eq(mainCategoryTable.isActive, true),
          eq(subCategoryTable.isActive, true)
        )
      )
      .limit(1);

    const isValid = categoryExists.length > 0;

    // Cache valid categories
    if (isValid) {
      this.validCategoriesCache.add(cacheKey);
    }

    return isValid;
  }

  /**
   * Create a validated categorization result
   */
  private async createValidatedResult(
    db: NodePgDatabase<typeof schema>,
    mainCategory: string,
    subCategory: string,
    source: CategorizationResult["source"],
    confidence: number,
    needsReview: boolean = false,
    ruleId?: string
  ): Promise<CategorizationResult | null> {
    const isValid = await this.validateCategories(
      db,
      mainCategory,
      subCategory
    );

    if (!isValid) {
      console.warn(
        `Invalid category combination: ${mainCategory}:${subCategory} from source: ${source}`
      );

      // Return default category for invalid combinations
      return {
        mainCategory: "Other",
        subCategory: "Miscellaneous",
        source: "default",
        confidence: 0.1,
        needsReview: true, // Flag for manual review
      };
    }

    return {
      mainCategory,
      subCategory,
      source,
      confidence,
      needsReview,
      ruleId,
    };
  }

  /**
   * Apply user-specific rules with highest priority
   */
  private async applyUserRules(
    db: NodePgDatabase<typeof schema>,
    userId: string,
    transaction: TinkTransaction
  ): Promise<CategorizationResult | null> {
    const userRules = this.userRulesCache.get(userId) || [];

    // Sort by priority (lower number = higher priority)
    const sortedRules = userRules
      .filter((rule) => rule.isActive)
      .sort((a, b) => (a.priority || 100) - (b.priority || 100));

    for (const rule of sortedRules) {
      if (this.ruleMatches(rule, transaction)) {
        return await this.createValidatedResult(
          db,
          rule.mainCategory,
          rule.subCategory,
          "user",
          Number(rule.confidence) || 0.9,
          false,
          rule.id
        );
      }
    }

    return null;
  }

  /**
   * Apply MCC code mapping
   */
  private async applyMccMapping(
    db: NodePgDatabase<typeof schema>,
    mccCode: string
  ): Promise<CategorizationResult | null> {
    const mapping = this.mccMappingCache.get(mccCode);
    if (mapping && mapping.isActive) {
      return await this.createValidatedResult(
        db,
        mapping.mainCategory,
        mapping.subCategory,
        "mcc",
        Number(mapping.confidence) || 0.8,
        false
      );
    }
    return null;
  }

  /**
   * Apply merchant name pattern matching
   */
  private async applyMerchantRules(
    db: NodePgDatabase<typeof schema>,
    merchantName: string
  ): Promise<CategorizationResult | null> {
    const normalizedMerchant = merchantName.toLowerCase().trim();

    // TODO: Common merchant patterns (these could be moved to database rules)
    const merchantPatterns = [
      // Food & Dining
      {
        patterns: ["mcdonalds", "burger king", "kfc", "subway", "pizza"],
        category: "Food & Dining",
        sub: "Fast Food",
        confidence: 0.95,
      },
      {
        patterns: ["starbucks", "costa", "cafe", "coffee"],
        category: "Food & Dining",
        sub: "Coffee",
        confidence: 0.95,
      },
      {
        patterns: ["restaurant", "bistro", "brasserie"],
        category: "Food & Dining",
        sub: "Restaurants",
        confidence: 0.85,
      },
      {
        patterns: ["supermarket", "grocery", "carrefour", "leclerc", "auchan"],
        category: "Food & Dining",
        sub: "Groceries",
        confidence: 0.9,
      },

      // Transportation
      {
        patterns: ["uber", "taxi", "bolt"],
        category: "Transportation",
        sub: "Ride Share",
        confidence: 0.95,
      },
      {
        patterns: ["sncf", "train", "metro", "bus"],
        category: "Transportation",
        sub: "Public Transit",
        confidence: 0.9,
      },
      {
        patterns: ["shell", "total", "bp", "essence", "fuel"],
        category: "Transportation",
        sub: "Fuel",
        confidence: 0.95,
      },
      {
        patterns: ["parking", "garage"],
        category: "Transportation",
        sub: "Parking",
        confidence: 0.9,
      },

      // Shopping
      {
        patterns: ["amazon", "ebay", "zalando"],
        category: "Shopping",
        sub: "Online",
        confidence: 0.95,
      },
      {
        patterns: ["zara", "h&m", "uniqlo"],
        category: "Shopping",
        sub: "Clothing",
        confidence: 0.95,
      },
      {
        patterns: ["fnac", "apple store", "samsung"],
        category: "Shopping",
        sub: "Electronics",
        confidence: 0.9,
      },

      // Entertainment
      {
        patterns: ["netflix", "spotify", "disney"],
        category: "Entertainment",
        sub: "Streaming",
        confidence: 0.95,
      },
      {
        patterns: ["cinema", "theater", "concert"],
        category: "Entertainment",
        sub: "Events",
        confidence: 0.9,
      },

      // Health & Fitness
      {
        patterns: ["pharmacie", "pharmacy", "doctor", "dentist"],
        category: "Health & Fitness",
        sub: "Healthcare",
        confidence: 0.9,
      },
      {
        patterns: ["gym", "fitness", "sport"],
        category: "Health & Fitness",
        sub: "Fitness",
        confidence: 0.9,
      },

      // Utilities
      {
        patterns: ["edf", "engie", "electricity", "gas"],
        category: "Bills & Utilities",
        sub: "Energy",
        confidence: 0.95,
      },
      {
        patterns: ["orange", "sfr", "bouygues", "free"],
        category: "Bills & Utilities",
        sub: "Phone",
        confidence: 0.95,
      },
      {
        patterns: ["internet", "wifi"],
        category: "Bills & Utilities",
        sub: "Internet",
        confidence: 0.9,
      },
    ];

    for (const rule of merchantPatterns) {
      for (const pattern of rule.patterns) {
        if (normalizedMerchant.includes(pattern)) {
          return await this.createValidatedResult(
            db,
            rule.category,
            rule.sub,
            "merchant",
            rule.confidence,
            false
          );
        }
      }
    }

    return null;
  }

  /**
   * Apply description pattern matching
   */
  private applyDescriptionRules(
    description: string
  ): CategorizationResult | null {
    if (!description) {
      return null;
    }

    const normalizedDesc = description.toLowerCase().trim();

    // Description patterns
    const descriptionPatterns = [
      // Income
      {
        patterns: ["salary", "salaire", "wages", "payroll"],
        category: "Income",
        sub: "Salary",
        confidence: 0.95,
      },
      {
        patterns: ["bonus", "commission"],
        category: "Income",
        sub: "Bonus",
        confidence: 0.9,
      },
      {
        patterns: ["refund", "remboursement", "reimbursement"],
        category: "Income",
        sub: "Refunds",
        confidence: 0.85,
      },

      // Bills
      {
        patterns: ["rent", "loyer"],
        category: "Bills & Utilities",
        sub: "Rent",
        confidence: 0.95,
      },
      {
        patterns: ["insurance", "assurance"],
        category: "Bills & Utilities",
        sub: "Insurance",
        confidence: 0.9,
      },
      {
        patterns: ["tax", "impot", "taxes"],
        category: "Bills & Utilities",
        sub: "Taxes",
        confidence: 0.9,
      },

      // Banking
      {
        patterns: ["atm", "withdrawal", "retrait"],
        category: "Banking",
        sub: "ATM",
        confidence: 0.95,
      },
      {
        patterns: ["transfer", "virement"],
        category: "Banking",
        sub: "Transfer",
        confidence: 0.9,
      },
      {
        patterns: ["fee", "frais", "commission"],
        category: "Banking",
        sub: "Fees",
        confidence: 0.85,
      },
    ];

    for (const rule of descriptionPatterns) {
      for (const pattern of rule.patterns) {
        if (normalizedDesc.includes(pattern)) {
          return {
            mainCategory: rule.category,
            subCategory: rule.sub,
            source: "description",
            confidence: rule.confidence,
            needsReview: false,
          };
        }
      }
    }

    return null;
  }

  /**
   * Apply amount-based rules
   */
  private applyAmountRules(amount: number): CategorizationResult | null {
    // Large positive amounts are likely income
    if (amount > 1000) {
      return {
        mainCategory: "Income",
        subCategory: "Other Income",
        source: "amount",
        confidence: 0.7,
        needsReview: true, // High amounts should be reviewed
      };
    }

    // Small negative amounts might be fees
    if (amount < 0 && Math.abs(amount) < 10) {
      return {
        mainCategory: "Banking",
        subCategory: "Fees",
        source: "amount",
        confidence: 0.6,
        needsReview: true,
      };
    }

    return null;
  }

  /**
   * Get default category for uncategorized transactions
   */
  private getDefaultCategory(amount: number): CategorizationResult {
    const isIncome = amount > 0;

    return {
      mainCategory: isIncome ? "Income" : "Other",
      subCategory: isIncome ? "Other Income" : "Uncategorized",
      source: "default",
      confidence: 0.1,
      needsReview: true,
    };
  }

  /**
   * Check if a rule matches a transaction
   */
  private ruleMatches(
    rule: CategoryRule,
    transaction: TinkTransaction
  ): boolean {
    const pattern = rule.pattern.toLowerCase();

    switch (rule.ruleType) {
      case "merchant": {
        return (
          transaction.merchantInformation?.merchantName
            ?.toLowerCase()
            .includes(pattern) || false
        );
      }

      case "description": {
        const desc = (
          transaction.descriptions.display ||
          transaction.descriptions.original ||
          ""
        ).toLowerCase();
        return desc.includes(pattern);
      }

      case "mcc": {
        return (
          transaction.merchantInformation?.merchantCategoryCode === rule.pattern
        );
      }

      case "amount_range": {
        const amount = this.parseAmount(transaction.amount);
        const min = rule.amountMin ? Number(rule.amountMin) : -Infinity;
        const max = rule.amountMax ? Number(rule.amountMax) : Infinity;
        return amount >= min && amount <= max;
      }

      default:
        return false;
    }
  }

  /**
   * Parse transaction amount to number
   */
  private parseAmount(amount: {
    currencyCode: string;
    value: { scale: string; unscaledValue: string };
  }): number {
    const unscaledValue = parseInt(amount.value.unscaledValue);
    const scale = parseInt(amount.value.scale);
    return unscaledValue / Math.pow(10, scale);
  }

  /**
   * Map Tink's PFM categories to our category system
   */
  private mapTinkCategoryToOurs(
    tinkCategory: string
  ): { mainCategory: string; subCategory: string } | null {
    const tinkMappings: Record<
      string,
      { mainCategory: string; subCategory: string }
    > = {
      "Food and drink": {
        mainCategory: "Food & Dining",
        subCategory: "Restaurants",
      },
      Groceries: { mainCategory: "Food & Dining", subCategory: "Groceries" },
      Transportation: {
        mainCategory: "Transportation",
        subCategory: "Other Transport",
      },
      Entertainment: {
        mainCategory: "Entertainment",
        subCategory: "Other Entertainment",
      },
      Shopping: { mainCategory: "Shopping", subCategory: "Other Shopping" },
      Health: { mainCategory: "Health & Fitness", subCategory: "Healthcare" },
      Income: { mainCategory: "Income", subCategory: "Other Income" },
      Bills: { mainCategory: "Bills & Utilities", subCategory: "Other Bills" },
      Transfer: { mainCategory: "Banking", subCategory: "Transfer" },
      // Add more mappings as needed
    };

    return tinkMappings[tinkCategory] || null;
  }

  /**
   * Refresh cache if expired
   */
  private async refreshCacheIfNeeded(
    db: NodePgDatabase<typeof schema>,
    userId: string
  ): Promise<void> {
    const now = Date.now();
    if (now - this.lastCacheUpdate > this.cacheExpiry) {
      await this.refreshCache(db, userId);
      this.lastCacheUpdate = now;
    }
  }

  /**
   * Refresh all caches from database
   */
  private async refreshCache(
    db: NodePgDatabase<typeof schema>,
    userId: string
  ): Promise<void> {
    try {
      // Load user-specific rules
      const userRules = await db
        .select()
        .from(categoryRule)
        .where(
          and(eq(categoryRule.userId, userId), eq(categoryRule.isActive, true))
        )
        .orderBy(categoryRule.priority);

      this.userRulesCache.set(userId, userRules);

      // Load global MCC mappings (only once, not user-specific)
      if (this.mccMappingCache.size === 0) {
        const mccMappings = await db
          .select()
          .from(mccCategoryMapping)
          .where(eq(mccCategoryMapping.isActive, true));

        this.mccMappingCache.clear();
        for (const mapping of mccMappings) {
          this.mccMappingCache.set(mapping.mccCode, mapping);
        }
      }

      // Load valid category definitions for validation
      if (this.validCategoriesCache.size === 0) {
        const validCategories = await db
          .select({
            mainCategory: mainCategoryTable.name,
            subCategory: subCategoryTable.name,
          })
          .from(subCategoryTable)
          .innerJoin(mainCategoryTable, eq(subCategoryTable.mainCategoryId, mainCategoryTable.id))
          .where(and(eq(mainCategoryTable.isActive, true), eq(subCategoryTable.isActive, true)));

        this.validCategoriesCache.clear();
        for (const category of validCategories) {
          const cacheKey = `${category.mainCategory}:${category.subCategory}`;
          this.validCategoriesCache.add(cacheKey);
        }
      }

      console.log(
        `Cache refreshed: ${userRules.length} user rules, ${this.mccMappingCache.size} MCC mappings, ${this.validCategoriesCache.size} valid categories`
      );
    } catch (error) {
      console.error("Error refreshing categorization cache:", error);
    }
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.merchantRulesCache.clear();
    this.mccMappingCache.clear();
    this.userRulesCache.clear();
    this.validCategoriesCache.clear();
    this.lastCacheUpdate = 0;
  }
}

// Create singleton instance
export const transactionCategorizationService =
  new TransactionCategorizationService();
