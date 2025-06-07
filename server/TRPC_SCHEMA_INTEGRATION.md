## Advanced Integration Options

### Option 1: Drizzle-Zod Integration (Recommended)

Install and use `drizzle-zod` for automatic schema generation:

```bash
npm install drizzle-zod
```

```typescript
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { transaction } from "../../db/schema";

// Auto-generated Zod schemas from Drizzle
const insertTransactionSchema = createInsertSchema(transaction);
const selectTransactionSchema = createSelectSchema(transaction);

// Use in tRPC procedures
.input(insertTransactionSchema.omit({ id: true, userId: true }))
.output(selectTransactionSchema)
```

### Option 2: Shared Type Definitions

Create shared types that both Drizzle and Zod can use:

```typescript
// types/transaction.ts
export type Transaction = {
  id: number;
  userId: string;
  accountId: number;
  amount: number;
  date: Date;
  description: string | null;
};

// Use in both Drizzle schema and Zod schemas
```

## Client-Side Benefits

With proper schema integration, your client gets:

```typescript
// Fully typed tRPC client
const transactions = await trpc.transaction.getTransactions.query({
  limit: 10,
});
// transactions is typed as Transaction[]

// Type-safe mutations
const newTransaction = await trpc.transaction.createTransaction.mutate({
  accountId: 1,
  amount: 1000,
  date: new Date(),
  description: "Salary",
});
// newTransaction is typed as Transaction
```

## Migration Steps

If you want to fix the type consistency:

1. **Update schema** to use `text` for user IDs
2. **Generate migration**: `npm run db:generate`
3. **Apply migration**: `npm run db:push`
4. **Update services** to handle string user IDs
5. **Update tRPC schemas** to match
