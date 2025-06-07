# Configuration Guide

## Environment Variables

The tRPC client automatically detects the server URL based on the environment:

### Development

- Default: `http://localhost:3000/trpc`
- The client assumes your server is running on port 3000

### Production

- Uses `VERCEL_URL` environment variable if available
- Falls back to the current domain if running in browser

## Server Configuration

Make sure your server is configured to:

1. **Run on the expected port** (default: 3000)
2. **Enable CORS** for your client domain
3. **Serve tRPC** on the `/trpc` endpoint

## Client Configuration

### URL Configuration

You can modify the server URL in two places:

1. **`lib/trpc.ts`** - For the vanilla tRPC client
2. **`components/providers.tsx`** - For the React provider

```typescript
function getUrl() {
  const base = (() => {
    if (typeof window !== "undefined") return "";
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return "http://localhost:3000"; // Change this for different dev server
  })();
  return `${base}/trpc`;
}
```

### Headers Configuration

To add authentication headers or other custom headers:

```typescript
// In lib/trpc.ts or components/providers.tsx
httpBatchLink({
  url: getUrl(),
  async headers() {
    return {
      authorization: `Bearer ${getAuthToken()}`,
      "custom-header": "value",
    };
  },
});
```

### Query Client Options

Modify query defaults in `lib/query-client.ts`:

```typescript
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // How long data stays fresh
        gcTime: 5 * 60 * 1000, // How long data stays in cache
        retry: 3, // Number of retries on failure
      },
    },
  });
}
```

## Development Setup

1. **Start your server** first (usually on port 3000)
2. **Start the client** with `npm run dev`
3. **Check the browser console** for any connection errors
4. **Use the example components** to test the integration

## Troubleshooting

### Common Issues

1. **CORS errors**: Make sure your server allows requests from your client domain
2. **Connection refused**: Ensure your server is running and accessible
3. **Type errors**: Make sure you're importing the correct `AppRouter` type from your server

### Debug Mode

Enable debug logging by adding this to your query client:

```typescript
const queryClient = new QueryClient({
  logger: {
    log: console.log,
    warn: console.warn,
    error: console.error,
  },
});
```
