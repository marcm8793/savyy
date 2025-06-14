# Services Directory Organization

This directory contains all business logic services for the Savyy API. Services are organized by domain and responsibility.

## Service Categories

### 🏦 **Banking & Financial Services**

- `accountsAndBalancesService.ts` - Account management, balances, and CRUD operations
- `transactionService.ts` - Transaction CRUD operations and filtering
- `transactionSyncService.ts` - Transaction synchronization with Tink API

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

## Future Refactoring Considerations

1. **Split large services** (>400 lines) into focused modules
2. **Create service interfaces** for better testability
3. **Add service-level error handling** and logging
4. **Implement service health checks** for monitoring
