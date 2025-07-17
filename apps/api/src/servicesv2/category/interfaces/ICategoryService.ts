import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { schema } from "../../../../db/schema";
import { CategoryStructure, CategorizationResult } from "../types";

/**
 * Interface for Category Management Service
 * 
 * Defines the contract for category-related operations including
 * database access, caching, and validation.
 */
export interface ICategoryService {
  /**
   * Retrieves all categories from the database with caching
   * 
   * @param db - Database instance
   * @returns Promise resolving to array of category structures
   */
  getCategories(db: NodePgDatabase<typeof schema>): Promise<CategoryStructure[]>;

  /**
   * Validates if a main category and subcategory pair is valid
   * 
   * @param mainCategory - Main category name
   * @param subCategory - Subcategory name
   * @returns True if the pair is valid, false otherwise
   */
  validateCategoryPair(mainCategory: string, subCategory: string): boolean;

  /**
   * Invalidates the category cache forcing a fresh database fetch
   * Should be called when categories are updated
   */
  invalidateCache(): void;

  /**
   * Gets the fallback category for unclassified transactions
   * 
   * @returns Default categorization result
   */
  getFallbackCategory(): CategorizationResult;

  /**
   * Checks if the category cache is currently valid
   * 
   * @returns True if cache is valid and not expired
   */
  isCacheValid(): boolean;

  /**
   * Gets category statistics for monitoring
   * 
   * @returns Object with cache stats and category counts
   */
  getCacheStats(): {
    isValid: boolean;
    categoryCount: number;
    lastUpdated: Date | null;
    expiresAt: Date | null;
  };
}