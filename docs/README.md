# Services Directory Organization

This directory contains all business logic services for the Savyy API. Services are organized by domain and responsibility.

## Service Categories

### 🏦 **Banking & Financial Services**

- `accountsAndBalancesService.ts` - Account management, balances, and CRUD operations
- `transaction/` - **Modular transaction services**:
  - `transactionSyncService.ts` - Core sync orchestration
  - `transactionFetchService.ts` - API fetching and pagination
  - `transactionStorageService.ts` - Database operations and bulk upserts
  - `transactionQueryService.ts` - Tink-style filtering, CRUD operations, and querying
  - `types.ts` - Shared TypeScript interfaces
  - `index.ts` - Clean re-exports

### 🔗 **External API Integration**

- `tinkService.ts` - Tink API client and OAuth flow management

### 🔐 **Security & Authentication**

- `tokenService.ts` - JWT tokens, OAuth state management, and token validation
- `redisService.ts` - OAuth code deduplication and caching

### 👤 **User Management**

- `userService.ts` - User CRUD operations and Tink user ID management

## Service Patterns

### Class-based Services with Singletons

```typescript
export class ServiceName {
  // Implementation
}

export const serviceName = new ServiceName();
```

### Functional Services (for simple operations)

```typescript
export const serviceName = {
  // Methods
};
```

## Dependencies

- All services accept database instances as parameters (dependency injection)
- Services should not directly import other services (use composition in routers)
- Environment variables are validated in constructors

## Recent Refactoring (Completed)

### ✅ **Transaction Services Modularization**

- **Before**: Single 529-line `transactionSyncService.ts` with mixed responsibilities
- **After**: Modular structure with focused services:
  - **Separation of Concerns**: Fetch, Storage, and Sync logic separated
  - **Better Testability**: Each service can be tested independently
  - **Improved Maintainability**: Smaller, focused files are easier to understand
  - **Backward Compatibility**: Existing imports continue to work

### Benefits Achieved:

- 🎯 **Single Responsibility**: Each service has one clear purpose
- 📦 **Better Modularity**: 150-200 lines per service vs 529 lines
- 🔄 **Improved Reusability**: Services can be composed differently
- 🐛 **Easier Debugging**: Issues isolated to specific domains
- 👥 **Team Development**: Multiple developers can work on different services

## Future Refactoring Considerations

1. **Split tinkService.ts** (509 lines) into auth, user, and API client modules
2. **Create service interfaces** for better testability
3. **Add service-level error handling** and logging
4. **Implement service health checks** for monitoring
