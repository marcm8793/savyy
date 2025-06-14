# Transaction Implementation with Tink Integration

This document describes the comprehensive transaction management system implemented with Tink API integration, including webhook handling, automatic syncing, and security features.

## Overview

The transaction system implements a hybrid strategy combining:

- **Webhook-driven updates** for real-time notifications
- **Manual refresh capabilities** for on-demand syncing
- **Initial transaction fetch** when connecting new bank accounts
- **Robust error handling** and security measures

## Architecture

### Core Components

1. **TransactionRouter** (`src/routers/transactionRouter.ts`)

   - Main tRPC router with all transaction endpoints
   - Handles CRUD operations, filtering, pagination
   - Webhook processing and security validation

2. **TransactionSyncService** (`src/services/transactionSyncService.ts`)

   - Dedicated service for initial transaction sync
   - Handles pagination, batching, and error recovery
   - Called when users connect new bank accounts

3. **Database Schema** (`db/schema.ts`)
   - Optimized transaction storage with proper indexing
   - Supports upsert operations for duplicate handling
   - Tracks sync metadata and audit trails

## Features

### 1. Transaction Listing & Filtering

```typescript
// Get transactions with advanced filtering
const transactions = await trpc.transaction.list.query({
  accountIdIn: ["account1", "account2"],
  statusIn: ["BOOKED", "PENDING"],
  bookedDateGte: "2024-01-01",
  bookedDateLte: "2024-12-31",
  pageSize: 50,
});
```

**Features:**

- ✅ Account-based filtering
- ✅ Status filtering (BOOKED, PENDING, UNDEFINED)
- ✅ Date range filtering
- ✅ Pagination with cursor-based tokens
- ✅ Proper sorting (newest first)

### 2. Initial Transaction Sync

When a user connects a new bank account:

```typescript
// Automatically triggered after account connection
const syncResult = await trpc.account.syncTinkAccounts.mutate({
  code: "authorization_code_from_tink",
});

// Manual sync for specific account
const manualSync = await trpc.account.syncAccountTransactions.mutate({
  accountId: "tink_account_id",
  dateRangeMonths: 12,
  includeAllStatuses: true,
});
```

**Process:**

1. **Account Connection** → Exchange auth code for access token
2. **Credential Refresh** → Trigger Tink to fetch latest data
3. **Transaction Fetch** → Get last 12 months with pagination
4. **Upsert Storage** → Handle duplicates gracefully
5. **Metadata Update** → Track sync timestamps

### 3. Webhook Integration

```typescript
// Webhook endpoint for Tink notifications
const webhookResult = await trpc.transaction.webhook.mutate({
  event: "transactions.update",
  userId: "external_user_id",
  accountIds: ["account1", "account2"],
  timestamp: Date.now(),
  signature: "hmac_signature",
});
```

**Security Features:**

- ✅ HMAC signature verification
- ✅ Timestamp validation (5-minute window)
- ✅ Replay attack prevention
- ✅ Rate limiting considerations

### 4. Manual Refresh Operations

```typescript
// Refresh specific credentials
await trpc.transaction.refreshCredentials.mutate({
  credentialsId: "credentials_id",
  force: false,
});

// Sync transactions manually
await trpc.transaction.sync.mutate({
  accountIds: ["account1"],
  dateRange: {
    from: "2024-01-01",
    to: "2024-12-31",
  },
  force: false,
});
```

### 5. Transaction Statistics

```typescript
// Get comprehensive transaction stats
const stats = await trpc.transaction.stats.query({
  accountIds: ["account1", "account2"],
  dateRange: {
    from: "2024-01-01",
    to: "2024-12-31",
  },
});

// Returns:
// - totalTransactions, totalIncome, totalExpenses
// - categoryBreakdown, statusBreakdown
// - netAmount calculation
```

## Storage Strategy

### Upsert Pattern

The system uses an intelligent upsert strategy to handle duplicates:

```typescript
// Primary deduplication key
tinkTransactionId: string (unique)

// Updateable fields (can change over time)
- status (PENDING → BOOKED)
- amount (rare corrections)
- description (bank updates)
- categories (PFM updates)

// Immutable fields (never change)
- accountId, bookedDate, providerTransactionId
```

### Batch Processing

- **Batch Size**: 50 transactions per database transaction
- **Error Isolation**: Individual transaction failures don't affect batch
- **Performance**: Optimized for large transaction volumes
- **Memory Management**: Streaming approach for large datasets

### Database Optimization

```sql
-- Key indexes for performance
CREATE INDEX idx_transactions_account_date ON transactions(account_id, booked_date DESC);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, booked_date DESC);
CREATE UNIQUE INDEX idx_transactions_tink_id ON transactions(tink_transaction_id);
```

## Security Implementation

### 1. Webhook Security

```typescript
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  // Constant-time comparison prevents timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex")
  );
}
```

### 2. Input Validation

```typescript
// Comprehensive Zod schemas
const transactionFiltersSchema = z.object({
  accountIdIn: z.array(z.string()).optional(),
  statusIn: z.array(z.enum(["BOOKED", "PENDING", "UNDEFINED"])).optional(),
  bookedDateGte: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  bookedDateLte: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  pageSize: z.number().min(1).max(100).default(50),
});
```

### 3. Authorization

- **Protected Procedures**: All transaction endpoints require authentication
- **User Isolation**: Transactions filtered by user ID
- **Token Validation**: Access token expiration checks
- **Account Ownership**: Verify user owns requested accounts

### 4. Data Sanitization

```typescript
// Prevent data truncation errors
displayDescription: tinkTx.descriptions.display.substring(0, 500),
originalDescription: tinkTx.descriptions.original.substring(0, 500),
merchantName: tinkTx.merchantInformation?.merchantName?.substring(0, 255),
```

## Error Handling

### 1. Graceful Degradation

```typescript
// Individual transaction errors don't fail entire batch
try {
  await processTransaction(transaction);
  created++;
} catch (error) {
  console.error(`Error processing transaction ${transaction.id}:`, error);
  errors.push(error.message);
  // Continue processing other transactions
}
```

### 2. Token Management

```typescript
// Check token expiration before API calls
if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "Access token has expired. Please reconnect your bank account.",
  });
}
```

### 3. Rate Limiting

```typescript
// Add delays between API calls to avoid rate limits
if (nextPageToken) {
  await new Promise((resolve) => setTimeout(resolve, 100));
}
```

## Environment Variables

```bash
# Required Tink configuration
TINK_CLIENT_ID=your_client_id
TINK_CLIENT_SECRET=your_client_secret
TINK_API_URL=https://api.tink.com
TINK_WEBHOOK_SECRET=your_webhook_secret

# Optional configuration
TINK_REDIRECT_URI=your_redirect_uri
TINK_ACTOR_CLIENT_ID=your_actor_client_id
```

## Usage Examples

### Complete Bank Connection Flow

```typescript
// 1. Get connection URL
const connectionUrl = await trpc.account.connectBankAccount.mutate({
  market: "FR",
  locale: "en_US",
});

// 2. User completes bank authentication (external)
// 3. Handle callback with authorization code

// 4. Sync accounts and transactions
const syncResult = await trpc.account.syncTinkAccounts.mutate({
  code: authorizationCode,
});

// Result includes:
// - Synchronized bank accounts
// - Initial transaction import (12 months)
// - Success/error statistics
```

### Ongoing Transaction Management

```typescript
// Get recent transactions
const recentTransactions = await trpc.transaction.list.query({
  bookedDateGte: "2024-01-01",
  statusIn: ["BOOKED"],
  pageSize: 20,
});

// Manual refresh when needed
await trpc.transaction.sync.mutate({
  dateRange: {
    from: "2024-01-01",
    to: "2024-12-31",
  },
});

// Get spending insights
const stats = await trpc.transaction.stats.query({
  dateRange: {
    from: "2024-01-01",
    to: "2024-12-31",
  },
});
```

## Performance Considerations

### 1. Pagination Strategy

- **Cursor-based pagination** for consistent results
- **Maximum page size**: 100 transactions
- **Efficient database queries** with proper indexing

### 2. Caching Strategy

- **Account metadata** cached in database
- **Token expiration** tracked to avoid unnecessary API calls
- **Last sync timestamps** prevent redundant operations

### 3. Background Processing

For production environments, consider:

- **Queue-based webhook processing** for high volume
- **Scheduled sync jobs** for regular updates
- **Dead letter queues** for failed operations

## Monitoring & Observability

### 1. Logging

```typescript
console.log(`Initial sync completed for account ${tinkAccountId}:`, {
  created: result.transactionsCreated,
  updated: result.transactionsUpdated,
  errors: result.errors.length,
  totalFetched: result.totalTransactionsFetched,
});
```

### 2. Metrics to Track

- Transaction sync success/failure rates
- API response times and error rates
- Webhook processing latency
- Database query performance
- Token expiration events

### 3. Alerting

Set up alerts for:

- High error rates in transaction processing
- Webhook signature validation failures
- Token expiration warnings
- Database connection issues

## Future Enhancements

### 1. Real-time Updates

- **WebSocket connections** for live transaction updates
- **Server-sent events** for transaction notifications
- **Push notifications** for important transactions

### 2. Advanced Analytics

- **Spending categorization** with ML
- **Fraud detection** patterns
- **Budget tracking** and alerts
- **Financial insights** and recommendations

### 3. Multi-provider Support

- **Pluggable architecture** for different banking APIs
- **Unified transaction format** across providers
- **Provider-specific optimizations**

## Troubleshooting

### Common Issues

1. **Webhook signature validation fails**

   - Check `TINK_WEBHOOK_SECRET` environment variable
   - Verify payload format matches expected structure

2. **Token expiration errors**

   - Implement token refresh logic
   - Guide users through reconnection flow

3. **Duplicate transactions**

   - Verify upsert logic is working correctly
   - Check `tinkTransactionId` uniqueness

4. **Performance issues**
   - Review database indexes
   - Optimize batch sizes
   - Consider pagination limits

### Debug Mode

Enable detailed logging:

```typescript
// Add to environment
DEBUG=transaction:*

// Logs will include:
// - API request/response details
// - Database operation timing
// - Error stack traces
// - Webhook processing steps
```

This implementation provides a robust, secure, and scalable foundation for transaction management with Tink integration.
