# Savyy Client - tRPC + TanStack Query Setup

This client application is set up with tRPC and TanStack Query for type-safe API communication with the server.

## Architecture Overview

The client uses the new TanStack Query integration pattern for tRPC, which provides better alignment with native TanStack Query patterns and improved developer experience.

## Key Files

### Core Setup

- `lib/trpc.ts` - Main tRPC client configuration and context creation
- `lib/query-client.ts` - QueryClient factory with optimized settings for SSR
- `components/providers.tsx` - Provider component that wraps the app with tRPC and TanStack Query

### Examples

- `components/auth-example.tsx` - Practical example using real auth procedures
- `components/example-trpc-usage.tsx` - Basic usage documentation

## Usage Patterns

### 1. Queries

```tsx
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../lib/trpc";

function MyComponent() {
  const trpc = useTRPC();

  // Basic query
  const sessionQuery = useQuery(trpc.auth.getSession.queryOptions());

  // Conditional query
  const profileQuery = useQuery({
    ...trpc.auth.getProfile.queryOptions(),
    enabled: sessionQuery.data?.isAuthenticated ?? false,
  });

  return (
    <div>
      {sessionQuery.isPending && <p>Loading...</p>}
      {sessionQuery.error && <p>Error: {sessionQuery.error.message}</p>}
      {sessionQuery.data && <p>Welcome, {sessionQuery.data.user?.name}!</p>}
    </div>
  );
}
```

### 2. Mutations

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../lib/trpc";

function MyComponent() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const updateProfileMutation = useMutation({
    ...trpc.auth.updateProfile.mutationOptions(),
    onSuccess: () => {
      // Invalidate related queries after successful mutation
      queryClient.invalidateQueries({ queryKey: ["auth", "getProfile"] });
    },
  });

  const handleUpdate = () => {
    updateProfileMutation.mutate({ name: "New Name" });
  };

  return (
    <button onClick={handleUpdate} disabled={updateProfileMutation.isPending}>
      {updateProfileMutation.isPending ? "Updating..." : "Update Profile"}
    </button>
  );
}
```

### 3. Server-Side Usage

For server-side operations (like in Server Components), you can use the vanilla tRPC client:

```tsx
import { trpcClient } from "../lib/trpc";

// In a Server Component or API route
async function getServerData() {
  const session = await trpcClient.auth.getSession.query();
  return session;
}
```

## Available Procedures

Based on your server setup, the following procedures are available:

### Auth Router (`trpc.auth.*`)

- `getSession.queryOptions()` - Get current session (public)
- `getProfile.queryOptions()` - Get user profile (protected)
- `updateProfile.mutationOptions()` - Update user profile (protected)
- `deleteAccount.mutationOptions()` - Delete user account (protected)

### Transaction Router (`trpc.transaction.*`)

- Check `server/src/routers/transactionRouter.ts` for available procedures

### Account Router (`trpc.account.*`)

- Check `server/src/routers/accountRouter.ts` for available procedures

## Error Handling

The setup includes automatic error handling. Errors are available through the query/mutation objects:

```tsx
const query = useQuery(trpc.auth.getSession.queryOptions());

if (query.error) {
  console.error("Query failed:", query.error.message);
}
```

## Cache Management

Use the QueryClient for cache management:

```tsx
import { useQueryClient } from "@tanstack/react-query";

function MyComponent() {
  const queryClient = useQueryClient();

  // Invalidate specific queries
  const invalidateAuth = () => {
    queryClient.invalidateQueries({ queryKey: ["auth"] });
  };

  // Set query data manually
  const setSessionData = (data) => {
    queryClient.setQueryData(["auth", "getSession"], data);
  };
}
```

## Development

1. Make sure your server is running on the configured port
2. The client will automatically connect to the tRPC endpoint
3. Use the example components to test the integration

## Configuration

The tRPC client is configured to connect to:

- Development: `http://localhost:3000/trpc`
- Production: Uses environment variables for URL detection

You can modify the URL configuration in `lib/trpc.ts` and `components/providers.tsx`.

## Type Safety

All procedures are fully type-safe. TypeScript will provide:

- Autocomplete for available procedures
- Type checking for input parameters
- Type inference for return data
- Error type safety

The types are automatically inferred from your server router definition.
