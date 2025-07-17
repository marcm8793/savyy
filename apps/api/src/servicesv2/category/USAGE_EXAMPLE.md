# Category Microservices Usage Guide

## Overview

This microservice architecture splits the monolithic `aiCategorizationService` into three focused services:

1. **CategoryService** - Manages category data and validation
2. **AIService** - Handles AI communication and response processing
3. **TransactionCategorizationService** - Orchestrates the categorization workflow

## Quick Start

### Basic Usage

```typescript
import { CategoryServiceFactory } from "./servicesv2/category";
import { createDatabase } from "../../db/db";

// Create service with default configuration
const service = CategoryServiceFactory.createTransactionCategorizationService();

// Use the service
const { db } = createDatabase();
const results = await service.categorizeBatch(db, transactions);

// results is a Map<string, CategorizationResult>
results.forEach((result, transactionId) => {
  console.log(`Transaction ${transactionId}: ${result.mainCategory} -> ${result.subCategory}`);
});
```

### Advanced Configuration

```typescript
import { CategoryServiceFactory, ConsoleLogger } from "./servicesv2/category";

// Create with custom configuration
const service = CategoryServiceFactory.createTransactionCategorizationService({
  aiConfig: {
    model: "claude-3-sonnet-20240229",
    timeout: 60000,
    maxTokens: 8000,
  },
  categoryConfig: {
    cacheTimeToLive: 10 * 60 * 1000, // 10 minutes
  },
  transactionConfig: {
    batchSize: 10,
    enableParallelProcessing: true,
  },
});
```

### Using Individual Services

```typescript
import { CategoryServiceFactory, ConsoleLogger } from "./servicesv2/category";

// Create custom logger
const logger = new ConsoleLogger();

// Create individual services
const categoryService = CategoryServiceFactory.createCategoryService({
  cacheTimeToLive: 15 * 60 * 1000, // 15 minutes
});

const aiService = CategoryServiceFactory.createAIService({
  model: "claude-3-opus-20240229",
  timeout: 45000,
});

// Use services independently
const categories = await categoryService.getCategories(db);
const isValid = categoryService.validateCategoryPair("Shopping", "Shopping - Others");

const anonymizedTransactions = transactions.map(tx => /* anonymize */);
const results = await aiService.classifyTransactions(anonymizedTransactions, categories);
```

## Service Architecture

### CategoryService

**Purpose**: Manages category data, caching, and validation

**Key Methods**:
- `getCategories(db)` - Retrieves categories with caching
- `validateCategoryPair(main, sub)` - Validates category combinations
- `invalidateCache()` - Forces cache refresh
- `getCacheStats()` - Returns cache statistics

**Configuration**:
```typescript
interface CategoryServiceConfig {
  cacheTimeToLive: number; // Cache TTL in milliseconds
}
```

### AIService

**Purpose**: Handles AI API communication and response processing

**Key Methods**:
- `classifyTransactions(transactions, categories)` - Main AI classification
- `buildSystemPrompt(categories)` - Creates system prompt
- `buildUserPrompt(transactions)` - Creates user prompt
- `parseResponse(content, count, categories)` - Parses AI response
- `getHealthStatus()` - Returns AI service health

**Configuration**:
```typescript
interface AIServiceConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  timeout: number;
  maxTokens: number;
  temperature: number;
}
```

### TransactionCategorizationService

**Purpose**: Orchestrates the categorization workflow

**Key Methods**:
- `categorizeBatch(db, transactions)` - Main categorization method
- `anonymizeTransaction(transaction)` - Anonymizes transactions
- `processInBatches(db, transactions, batchSize)` - Batch processing
- `getProcessingStats()` - Returns processing statistics

**Configuration**:
```typescript
interface TransactionCategorizationConfig {
  batchSize: number;
  enableParallelProcessing: boolean;
}
```

## Testing

### Unit Testing Individual Services

```typescript
import { CategoryService } from "./servicesv2/category";
import { ConsoleLogger } from "./servicesv2/category";

describe("CategoryService", () => {
  let service: CategoryService;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    service = new CategoryService({ cacheTimeToLive: 1000 }, mockLogger);
  });

  it("should cache categories", async () => {
    const categories = await service.getCategories(mockDb);
    expect(service.isCacheValid()).toBe(true);
  });
});
```

### Integration Testing

```typescript
import { CategoryServiceFactory } from "./servicesv2/category";

describe("Category Integration", () => {
  it("should categorize transactions end-to-end", async () => {
    const service = CategoryServiceFactory.createTransactionCategorizationService();
    const results = await service.categorizeBatch(db, mockTransactions);
    
    expect(results.size).toBe(mockTransactions.length);
    results.forEach((result) => {
      expect(result.mainCategory).toBeTruthy();
      expect(result.subCategory).toBeTruthy();
    });
  });
});
```

## Migration from Original Service

### Before (Original Service)
```typescript
import { AICategorizationService } from "./services/transaction/aiCategorizationService";

const service = new AICategorizationService();
const results = await service.categorizeBatch(db, transactions);
```

### After (New Microservice Architecture)
```typescript
import { CategoryServiceFactory } from "./servicesv2/category";

const service = CategoryServiceFactory.createTransactionCategorizationService();
const results = await service.categorizeBatch(db, transactions);
```

## Environment Variables

Required:
- `AI_API_KEY` - API key for AI service

Optional (with defaults):
- `AI_API_URL` - AI API endpoint
- `AI_MODEL` - AI model to use
- `AI_BATCH_SIZE` - Batch size for processing
- `AI_API_TIMEOUT` - API timeout in milliseconds

## Error Handling

The microservice architecture provides robust error handling:

```typescript
try {
  const results = await service.categorizeBatch(db, transactions);
} catch (error) {
  // Service-level errors (configuration, database, etc.)
  console.error("Service error:", error);
}

// Individual transaction errors are handled gracefully
// Failed transactions get fallback categorization
results.forEach((result, transactionId) => {
  if (result.mainCategory === "To Classify") {
    console.warn(`Transaction ${transactionId} needs manual review`);
  }
});
```

## Monitoring and Observability

### Category Service Stats
```typescript
const categoryService = CategoryServiceFactory.createCategoryService();
const stats = categoryService.getCacheStats();
console.log("Cache stats:", stats);
```

### AI Service Health
```typescript
const aiService = CategoryServiceFactory.createAIService();
const health = aiService.getHealthStatus();
console.log("AI service health:", health);
```

### Processing Statistics
```typescript
const service = CategoryServiceFactory.createTransactionCategorizationService();
const stats = service.getProcessingStats();
console.log("Processing stats:", stats);
```

## Best Practices

1. **Use the Factory**: Always use `CategoryServiceFactory` for service creation
2. **Configuration**: Provide environment-specific configurations
3. **Error Handling**: Handle both service-level and transaction-level errors
4. **Monitoring**: Regularly check service health and statistics
5. **Caching**: Monitor cache hit rates and adjust TTL as needed
6. **Batch Size**: Tune batch size based on your transaction volume
7. **Testing**: Test individual services in isolation and integration scenarios