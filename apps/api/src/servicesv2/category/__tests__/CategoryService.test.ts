/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CategoryService } from "../services/CategoryService";
import { CategoryServiceConfig, Logger } from "../types";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { schema } from "../../../../db/schema";

// Mock logger
const mockLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock database
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
} as unknown as NodePgDatabase<typeof schema>;

describe("CategoryService", () => {
  let service: CategoryService;
  let config: CategoryServiceConfig;

  // Mock data
  const mockMainCategories = [
    { id: "1", name: "Bills & Utilities", sortOrder: 1 },
    { id: "2", name: "Shopping", sortOrder: 2 },
    { id: "3", name: "To Classify", sortOrder: 99 },
  ];

  const mockSubCategories = [
    { id: "1", name: "Subscription - Others", mainCategoryId: "1", sortOrder: 1 },
    { id: "2", name: "Internet", mainCategoryId: "1", sortOrder: 2 },
    { id: "3", name: "Shopping - Others", mainCategoryId: "2", sortOrder: 1 },
    { id: "4", name: "Needs Review", mainCategoryId: "3", sortOrder: 1 },
    { id: "5", name: "Orphaned Sub", mainCategoryId: "999", sortOrder: 1 }, // Orphaned
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    config = { cacheTimeToLive: 5 * 60 * 1000 }; // 5 minutes
    service = new CategoryService(config, mockLogger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Constructor", () => {
    it("should initialize with default config", () => {
      const defaultService = new CategoryService(undefined, mockLogger);
      expect(defaultService).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "CategoryService initialized",
        { cacheTimeToLive: 5 * 60 * 1000 }
      );
    });

    it("should initialize with custom config", () => {
      const customConfig = { cacheTimeToLive: 10 * 60 * 1000 };
      const customService = new CategoryService(customConfig, mockLogger);
      expect(customService).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "CategoryService initialized",
        { cacheTimeToLive: 10 * 60 * 1000 }
      );
    });
  });

  describe("getCategories", () => {
    it("should fetch categories from database and cache them", async () => {
      // Mock database responses
      (mockDb.select as any)
        .mockResolvedValueOnce(mockMainCategories)
        .mockResolvedValueOnce(mockSubCategories);

      const categories = await service.getCategories(mockDb);

      expect(categories).toHaveLength(3);
      expect(categories[0]).toEqual({
        mainCategory: "Bills & Utilities",
        subcategories: ["Subscription - Others", "Internet"],
      });
      expect(categories[1]).toEqual({
        mainCategory: "Shopping",
        subcategories: ["Shopping - Others"],
      });
      expect(categories[2]).toEqual({
        mainCategory: "To Classify",
        subcategories: ["Needs Review"],
      });

      // Verify caching
      expect(service.isCacheValid()).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Fetched categories from database",
        expect.objectContaining({
          mainCategoryCount: 3,
          subCategoryCount: 5,
        })
      );
    });

    it("should return cached categories on subsequent calls", async () => {
      // First call - fetches from database
      (mockDb.select as any)
        .mockResolvedValueOnce(mockMainCategories)
        .mockResolvedValueOnce(mockSubCategories);

      const categories1 = await service.getCategories(mockDb);
      
      // Second call - should use cache
      const categories2 = await service.getCategories(mockDb);

      expect(categories1).toEqual(categories2);
      expect(mockDb.select).toHaveBeenCalledTimes(2); // Only called once for both main and sub
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Returning categories from cache",
        { categoryCount: 3 }
      );
    });

    it("should handle database errors gracefully", async () => {
      const dbError = new Error("Database connection failed");
      (mockDb.select as any).mockRejectedValueOnce(dbError);

      await expect(service.getCategories(mockDb)).rejects.toThrow(
        "Failed to fetch categories: Database connection failed"
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to fetch categories from database",
        { error: "Database connection failed" }
      );
    });

    it("should handle orphaned subcategories", async () => {
      (mockDb.select as any)
        .mockResolvedValueOnce(mockMainCategories)
        .mockResolvedValueOnce(mockSubCategories);

      const categories = await service.getCategories(mockDb);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Orphaned subcategory found",
        {
          subcategoryId: "5",
          subcategoryName: "Orphaned Sub",
          mainCategoryId: "999",
        }
      );

      // Orphaned subcategory should not appear in results
      const allSubcategories = categories.flatMap(c => c.subcategories);
      expect(allSubcategories).not.toContain("Orphaned Sub");
    });

    it("should refresh cache when expired", async () => {
      // Create service with very short cache TTL
      const shortCacheConfig = { cacheTimeToLive: 1 }; // 1ms
      const shortCacheService = new CategoryService(shortCacheConfig, mockLogger);

      // First call
      (mockDb.select as any)
        .mockResolvedValueOnce(mockMainCategories)
        .mockResolvedValueOnce(mockSubCategories);

      await shortCacheService.getCategories(mockDb);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second call - should fetch from database again
      (mockDb.select as any)
        .mockResolvedValueOnce(mockMainCategories)
        .mockResolvedValueOnce(mockSubCategories);

      await shortCacheService.getCategories(mockDb);

      expect(mockDb.select).toHaveBeenCalledTimes(4); // 2 calls (main + sub) x 2 times
    });
  });

  describe("validateCategoryPair", () => {
    beforeEach(async () => {
      // Set up cache
      (mockDb.select as any)
        .mockResolvedValueOnce(mockMainCategories)
        .mockResolvedValueOnce(mockSubCategories);
      await service.getCategories(mockDb);
    });

    it("should validate correct category pairs", () => {
      const validPairs = [
        ["Bills & Utilities", "Subscription - Others"],
        ["Bills & Utilities", "Internet"],
        ["Shopping", "Shopping - Others"],
        ["To Classify", "Needs Review"],
      ];

      validPairs.forEach(([mainCategory, subCategory]) => {
        expect(service.validateCategoryPair(mainCategory, subCategory)).toBe(true);
      });
    });

    it("should reject invalid main categories", () => {
      expect(service.validateCategoryPair("Invalid Category", "Subscription - Others")).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Invalid main category",
        expect.objectContaining({
          mainCategory: "Invalid Category",
        })
      );
    });

    it("should reject invalid subcategories", () => {
      expect(service.validateCategoryPair("Bills & Utilities", "Invalid Subcategory")).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Invalid subcategory for main category",
        expect.objectContaining({
          mainCategory: "Bills & Utilities",
          subCategory: "Invalid Subcategory",
        })
      );
    });

    it("should reject subcategory under wrong main category", () => {
      expect(service.validateCategoryPair("Shopping", "Internet")).toBe(false);
    });

    it("should handle empty strings", () => {
      expect(service.validateCategoryPair("", "")).toBe(false);
      expect(service.validateCategoryPair("Bills & Utilities", "")).toBe(false);
      expect(service.validateCategoryPair("", "Internet")).toBe(false);
    });

    it("should handle empty cache", () => {
      const emptyService = new CategoryService(config, mockLogger);
      expect(emptyService.validateCategoryPair("Bills & Utilities", "Internet")).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Category validation called with empty cache",
        expect.objectContaining({
          mainCategory: "Bills & Utilities",
          subCategory: "Internet",
        })
      );
    });
  });

  describe("invalidateCache", () => {
    it("should invalidate cache and force refresh", async () => {
      // First, populate cache
      (mockDb.select as any)
        .mockResolvedValueOnce(mockMainCategories)
        .mockResolvedValueOnce(mockSubCategories);
      await service.getCategories(mockDb);

      expect(service.isCacheValid()).toBe(true);

      // Invalidate cache
      service.invalidateCache();

      expect(service.isCacheValid()).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith("Category cache invalidated");
    });
  });

  describe("getFallbackCategory", () => {
    it("should return fallback category", () => {
      const fallback = service.getFallbackCategory();
      expect(fallback).toEqual({
        mainCategory: "To Classify",
        subCategory: "Needs Review",
        userModified: false,
      });
    });
  });

  describe("isCacheValid", () => {
    it("should return false for empty cache", () => {
      expect(service.isCacheValid()).toBe(false);
    });

    it("should return true for valid cache", async () => {
      (mockDb.select as any)
        .mockResolvedValueOnce(mockMainCategories)
        .mockResolvedValueOnce(mockSubCategories);
      await service.getCategories(mockDb);

      expect(service.isCacheValid()).toBe(true);
    });

    it("should return false for expired cache", async () => {
      const shortCacheConfig = { cacheTimeToLive: 1 };
      const shortCacheService = new CategoryService(shortCacheConfig, mockLogger);

      (mockDb.select as any)
        .mockResolvedValueOnce(mockMainCategories)
        .mockResolvedValueOnce(mockSubCategories);
      await shortCacheService.getCategories(mockDb);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(shortCacheService.isCacheValid()).toBe(false);
    });
  });

  describe("getCacheStats", () => {
    it("should return cache statistics", async () => {
      // Before populating cache
      let stats = service.getCacheStats();
      expect(stats).toEqual({
        isValid: false,
        categoryCount: 0,
        lastUpdated: null,
        expiresAt: null,
      });

      // After populating cache
      (mockDb.select as any)
        .mockResolvedValueOnce(mockMainCategories)
        .mockResolvedValueOnce(mockSubCategories);
      await service.getCategories(mockDb);

      stats = service.getCacheStats();
      expect(stats.isValid).toBe(true);
      expect(stats.categoryCount).toBe(3);
      expect(stats.lastUpdated).toBeInstanceOf(Date);
      expect(stats.expiresAt).toBeInstanceOf(Date);
    });
  });
});