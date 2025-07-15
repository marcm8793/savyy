# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Savyy is a financial management application that integrates with banking APIs (Tink) to provide users with account and transaction management capabilities. It's structured as a monorepo using Turborepo with TypeScript throughout.

## Essential Commands

### Development

```bash
npm run dev              # Start both frontend (localhost:3000) and backend (localhost:3001) in dev mode
npm run build            # Build all applications
npm run lint             # Lint all code - ALWAYS run before completing tasks
npm run type-check       # Type check all apps - ALWAYS run before completing tasks
```

### Testing

```bash
npm run test             # Run all tests
npm run test:run         # Run tests once (in API directory)
npm run test:watch       # Run tests in watch mode (in API directory)
npm run test:coverage    # Run tests with coverage report
```

### Database

```bash
npm run db:push          # Push schema changes to database
npm run db:studio        # Open Drizzle Studio for database management
npm run db:generate      # Generate TypeScript types from schema
```

### API-Specific Utilities

```bash
npm run webhook:setup    # Set up Tink webhooks
npm run seed:categories  # Seed transaction categories
npm run transaction:test-sync  # Test transaction sync functionality
```

## Architecture

### Tech Stack

- **Frontend**: Next.js 15 with App Router, React 19, Tailwind CSS v4, Shadcn UI
- **Backend**: Fastify with tRPC for type-safe APIs
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth library
- **External Integration**: Tink API for banking data

### Key Directories

- `/apps/api` - Backend server
  - `/src/services/` - Business logic (class-based for complex, functional for simple)
  - `/src/routers/` - tRPC routers
  - `/db/` - Database schema and migrations
  - `/__tests__/` - Test suite
- `/apps/web` - Frontend application
  - `/app/(protected)/` - Authenticated pages (dashboard, accounts, transactions)
  - `/app/(auth)/` - Auth pages (signin/signup)
  - `/components/` - React components organized by domain
- `/docs/` - Architecture documentation

### Core Services Architecture

1. **Transaction Services** (modularized):

   - `TransactionSyncService` - Orchestrates sync operations
   - `TransactionFetchService` - Fetches from Tink API
   - `TransactionStorageService` - Database operations
   - `TransactionQueryService` - Query operations

2. **Banking Services**:

   - `AccountsAndBalancesService` - Account management
   - `TinkService` - Tink API integration with consent management
   - `TinkWebhookService` - Webhook handling

3. **Infrastructure**:
   - All services accept database instances as parameters (dependency injection)
   - Redis for OAuth state management and caching
   - HMAC signature verification for webhooks

### Key Implementation Details

1. **Transaction Processing**:

   - 3-month historical data on initial fetch
   - Batch processing (50 transactions per batch)
   - Intelligent upsert strategy to handle duplicates
   - Webhook-driven real-time updates

2. **Categorization System**:

   - Hierarchical rule-based system
   - Uses Tink PFM categories, MCC codes, and merchant patterns
   - 80-90% accuracy target
   - Caching for performance

3. **Error Handling**:

   - Individual transaction errors don't fail entire batches
   - Graceful degradation for external service failures
   - Comprehensive logging

4. **Testing**:
   - Unit tests with Vitest
   - Integration tests for services
   - Mock implementations for external services (see `__tests__/mocks/`)

### Development Guidelines

1. **Before Completing Any Task**:

   - Run `npm run lint` to ensure code style compliance
   - Run `npm run type-check` to verify TypeScript types
   - Run relevant tests to ensure nothing is broken

2. **When Adding New Features**:

   - Follow existing service patterns (class-based vs functional)
   - Add appropriate tests
   - Update TypeScript types
   - Use Zod schemas for input validation

3. **API Development**:

   - Use tRPC for type-safe API endpoints
   - Follow existing router patterns in `/apps/api/src/routers/`
   - Implement proper error handling

4. **Frontend Development**:

   - Use Shadcn UI components from `/apps/web/components/ui/`
   - Follow existing component patterns
   - Maintain responsive design with Tailwind CSS

5. **Database Changes**:
   - Modify schema in `/apps/api/db/schema/`
   - Run `npm run db:generate` after schema changes
   - Run `npm run db:push` to apply changes

## Code Style Guidelines

**Type Safety**:

- Avoid using `any` as a type - prefer `unknown` when type is truly unknown
- If `any` is unavoidable (e.g., untyped third-party libraries), document the reason with a comment
- Use `// @ts-expect-error` with explanation when TypeScript's inference is incorrect

## Security Guidelines

- Never expose access tokens to the client

## Authentication and Token Management

### Token Types

Client Access Tokens:

- Authenticate your application (not individual users)
- Used for administrative operations like creating users, managing webhooks, and granting authorizations
- Require client_id and client_secret
- No refresh token - must re-authenticate when expired (30 minutes)
- Server-side only for security

User Access Tokens:

- Authenticate access to specific user's financial data
- Used for fetching accounts, balances, and transactions
- Obtained via authorization code flow after user bank authentication
- Renewable via credentials refresh
- Renewed by refreshing credentials and generating new access tokens

The key difference is scope: client tokens handle app-level operations while user tokens access individual user's bank data after proper consent.
