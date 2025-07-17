import { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  schema,
  mainCategory as mainCategoryTable,
  subCategory as subCategoryTable,
} from "../../../../db/schema";
import { ICategoryService } from "../interfaces/ICategoryService";
import { CategoryStructure, CategoryServiceConfig, Logger, CategorizationResult } from "../types";

/**
 * Category Management Service
 * 
 * Handles category data retrieval, caching, and validation.
 * Implements efficient caching with TTL and provides category validation.
 */
export class CategoryService implements ICategoryService {
  private categoryCache: CategoryStructure[] | null = null;
  private cacheExpiry: number = 0;
  private lastUpdated: Date | null = null;
  private readonly config: CategoryServiceConfig;
  private readonly logger: Logger;

  constructor(
    config: CategoryServiceConfig = { cacheTimeToLive: 5 * 60 * 1000 }, // 5 minutes default
    logger: Logger
  ) {
    this.config = config;
    this.logger = logger;
    this.logger.info("CategoryService initialized", {
      cacheTimeToLive: config.cacheTimeToLive,
    });
  }

  /**
   * Retrieves all categories from the database with caching
   */
  async getCategories(db: NodePgDatabase<typeof schema>): Promise<CategoryStructure[]> {
    // Check cache first
    if (this.isCacheValid()) {
      this.logger.info("Returning categories from cache", {
        categoryCount: this.categoryCache?.length || 0,
      });
      return this.categoryCache!;
    }

    try {
      // Fetch categories from database
      const startTime = Date.now();
      const [mainCategories, subCategories] = await Promise.all([
        db.select().from(mainCategoryTable).orderBy(mainCategoryTable.sortOrder),
        db.select().from(subCategoryTable).orderBy(subCategoryTable.sortOrder),
      ]);

      const fetchTime = Date.now() - startTime;
      this.logger.info("Fetched categories from database", {
        mainCategoryCount: mainCategories.length,
        subCategoryCount: subCategories.length,
        fetchTimeMs: fetchTime,
      });

      // Group subcategories by main category
      const categoryMap = new Map<string, string[]>();

      // Initialize with main categories
      mainCategories.forEach((main) => {
        categoryMap.set(main.name, []);
      });

      // Add subcategories to their respective main categories
      subCategories.forEach((sub) => {
        const mainCat = mainCategories.find(
          (main) => main.id === sub.mainCategoryId
        );
        if (mainCat) {
          const subcats = categoryMap.get(mainCat.name);
          if (subcats) {
            subcats.push(sub.name);
          }
        } else {
          this.logger.warn("Orphaned subcategory found", {
            subcategoryId: sub.id,
            subcategoryName: sub.name,
            mainCategoryId: sub.mainCategoryId,
          });
        }
      });

      // Convert to array format and cache
      this.categoryCache = Array.from(categoryMap.entries()).map(
        ([mainCategory, subcategories]) => ({
          mainCategory,
          subcategories,
        })
      );

      this.cacheExpiry = Date.now() + this.config.cacheTimeToLive;
      this.lastUpdated = new Date();

      this.logger.info("Categories cached successfully", {
        categoryCount: this.categoryCache.length,
        cacheExpiresAt: new Date(this.cacheExpiry).toISOString(),
      });

      return this.categoryCache;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error("Failed to fetch categories from database", {
        error: errorMessage,
      });
      throw new Error(`Failed to fetch categories: ${errorMessage}`);
    }
  }

  /**
   * Validates if a main category and subcategory pair is valid
   */
  validateCategoryPair(mainCategory: string, subCategory: string): boolean {
    if (!this.categoryCache || this.categoryCache.length === 0) {
      this.logger.warn("Category validation called with empty cache", {
        mainCategory,
        subCategory,
      });
      return false;
    }

    if (!mainCategory || !subCategory) {
      return false;
    }

    // Find the main category
    const mainCat = this.categoryCache.find(
      (cat) => cat.mainCategory === mainCategory
    );

    if (!mainCat) {
      this.logger.warn("Invalid main category", {
        mainCategory,
        availableCategories: this.categoryCache.map(c => c.mainCategory),
      });
      return false;
    }

    // Check if subcategory exists under this main category
    const isValid = mainCat.subcategories.includes(subCategory);
    
    if (!isValid) {
      this.logger.warn("Invalid subcategory for main category", {
        mainCategory,
        subCategory,
        availableSubcategories: mainCat.subcategories,
      });
    }

    return isValid;
  }

  /**
   * Invalidates the category cache forcing a fresh database fetch
   */
  invalidateCache(): void {
    this.logger.info("Category cache invalidated");
    this.categoryCache = null;
    this.cacheExpiry = 0;
    this.lastUpdated = null;
  }

  /**
   * Gets the fallback category for unclassified transactions
   */
  getFallbackCategory(): CategorizationResult {
    return {
      mainCategory: "To Classify",
      subCategory: "Needs Review",
      userModified: false,
    };
  }

  /**
   * Checks if the category cache is currently valid
   */
  isCacheValid(): boolean {
    return (
      this.categoryCache !== null && 
      this.categoryCache.length > 0 && 
      Date.now() < this.cacheExpiry
    );
  }

  /**
   * Gets category statistics for monitoring
   */
  getCacheStats(): {
    isValid: boolean;
    categoryCount: number;
    lastUpdated: Date | null;
    expiresAt: Date | null;
  } {
    return {
      isValid: this.isCacheValid(),
      categoryCount: this.categoryCache?.length || 0,
      lastUpdated: this.lastUpdated,
      expiresAt: this.cacheExpiry > 0 ? new Date(this.cacheExpiry) : null,
    };
  }
}