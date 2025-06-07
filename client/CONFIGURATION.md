# Configuration Guide

## Environment Variables

The tRPC client automatically detects the server URL based on the environment using a centralized configuration system.

### Development

- Default: `http://localhost:8080/trpc`
- The client assumes your server is running on port 8080 (configurable via PORT environment variable)

### Production

- Uses `VERCEL_URL` environment variable if available
- Falls back to the current domain if running in browser

## Centralized Configuration

All server URLs are now managed in a single file: `lib/config.ts`

### URL Configuration

The centralized config automatically handles:

1. **tRPC endpoint** - `/trpc` path
2. **Auth endpoint** - Better Auth integration
3. **Environment detection** - Development vs Production

```typescript
// lib/config.ts
import { getTRPCUrl, getAuthUrl, config } from "./lib/config";

// Get URLs
const trpcUrl = getTRPCUrl(); // http://localhost:8080/trpc
const authUrl = getAuthUrl(); // http://localhost:8080
const isDev = config.isDevelopment;
```

### Customizing URLs

To modify server URLs, edit `lib/config.ts`:

```typescript
function getBaseUrl(): string {
  if (typeof window !== "undefined") return "";

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.RENDER_INTERNAL_HOSTNAME) {
    return `http://${process.env.RENDER_INTERNAL_HOSTNAME}:${process.env.PORT}`;
  }

  // Change this for different dev server port
  return "http://localhost:8080";
}
```

## tRPC Client Setup

The tRPC client now uses the modern React Query integration:

### React Components

```typescript
import { trpc } from "../lib/trpc";

function MyComponent() {
  // Query example
  const sessionQuery = trpc.auth.getSession.useQuery();

  // Mutation example
  const updateProfile = trpc.auth.updateProfile.useMutation();

  return (
    <div>
      {sessionQuery.data && <p>Welcome {sessionQuery.data.user?.name}</p>}
    </div>
  );
}
```

### Provider Setup

The app is wrapped with the tRPC provider in `components/providers.tsx`:

```typescript
import { trpc } from "../lib/trpc";

export function TRPCQueryProvider({ children }) {
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: getTRPCUrl(),
          async headers() {
            // Better Auth handles cookies automatically
            return {};
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

## Server Configuration

Make sure your server is configured to:

1. **Run on the expected port** (default: 8080, configurable via PORT env var)
2. **Enable CORS** for your client domain
3. **Serve tRPC** on the `/trpc` endpoint

## Development Setup

1. **Start your server** first (usually on port 8080)
2. **Start the client** with `npm run dev`
3. **Check the browser console** for any connection errors
4. **Use the test components** to verify the integration

## Troubleshooting

### Common Issues

1. **CORS errors**: Make sure your server allows requests from your client domain
2. **Connection refused**: Ensure your server is running on the correct port (8080)
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

### Testing Connection

Use the `TRPCConnectionTest` component to verify your setup:

```typescript
import { TRPCConnectionTest } from "./components/trpc-connection-test";

function App() {
  return (
    <div>
      <TRPCConnectionTest />
    </div>
  );
}
```
