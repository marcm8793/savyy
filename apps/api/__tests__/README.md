# API Testing

This directory contains all tests for the Savyy API backend.

## Test Structure

```
__tests__/
├── unit/                    # Unit tests (isolated component testing)
│   ├── services/           # Service layer tests
│   ├── routers/            # tRPC router tests
│   └── utils/              # Utility function tests
├── integration/            # Integration tests (multiple components)
│   ├── database/           # Database integration tests
│   ├── external/           # External service integration tests
│   └── routers/            # Full router integration tests
├── e2e/                    # End-to-end tests (full API testing)
├── __fixtures__/           # Test data and fixtures
├── __mocks__/              # Mock implementations
└── helpers/                # Test utility functions
```

## Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests once (CI mode)
npm run test:run

# Run with coverage
npm run test:coverage

# Run with UI (browser interface)
npm run test:ui
```

## Test Configuration

- **Framework**: Vitest
- **Setup**: `test-setup.ts` runs before all tests
- **Config**: `vitest.config.ts`
- **Environment**: Node.js with test environment variables

## Writing Tests

### Unit Tests

- Test individual functions/services in isolation
- Mock all external dependencies
- Focus on business logic and edge cases

### Integration Tests

- Test multiple components working together
- Use real database (test database)
- Test external service integrations

### E2E Tests

- Test complete API workflows
- Test authentication flows
- Test webhook handling

## Test Utilities

- `helpers/testUtils.ts` - Common test utilities
- `__fixtures__/testData.ts` - Test data fixtures
- `__mocks__/` - Service mocks

## Environment

Tests use `.env.test` for configuration with test-specific values for:

- Test database connection
- Mock API keys
- Test Redis instance

## Best Practices

1. **Isolation**: Each test should be independent
2. **Descriptive**: Use clear test descriptions
3. **Fast**: Keep unit tests fast by mocking dependencies
4. **Coverage**: Aim for high coverage of critical paths
5. **Data**: Use fixtures for consistent test data
