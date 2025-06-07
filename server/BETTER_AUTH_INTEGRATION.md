# Better Auth + Fastify + tRPC Integration Guide

## Frontend Integration Examples

### React/Next.js Client Setup

```typescript
// lib/trpc.ts
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../backend/src/routers"; // Adjust path
import { authClient } from "./auth-client";

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "http://localhost:YOUR_PORT/trpc", // Your backend tRPC URL
      headers() {
        const headers = new Map<string, string>();
        const cookies = authClient.getCookie();
        if (cookies) {
          headers.set("Cookie", cookies);
        }
        return Object.fromEntries(headers);
      },
    }),
  ],
});
```

## Usage Examples

### Authentication Flow

```typescript
// Sign up
await authClient.signUp.email({
  email: "user@example.com",
  password: "securepassword",
  name: "John Doe",
});

// Sign in
await authClient.signIn.email({
  email: "user@example.com",
  password: "securepassword",
});

// Sign out
await authClient.signOut();

// Get session
const session = await authClient.getSession();
```

### Using tRPC with Authentication

```typescript
// Public endpoint - works without authentication
const sessionData = await trpc.auth.getSession.query();

// Protected endpoint - requires authentication
try {
  const profile = await trpc.auth.getProfile.query();
  console.log("User profile:", profile);
} catch (error) {
  // Will throw UNAUTHORIZED if not logged in
  console.error("Not authenticated:", error);
}

// Update profile (protected)
await trpc.auth.updateProfile.mutate({
  name: "New Name",
});
```

### React Component Example

```tsx
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

function ProfileComponent() {
  const { data: session } = authClient.useSession();
  const { data: profile, isLoading } = trpc.auth.getProfile.useQuery(
    undefined,
    { enabled: !!session?.user }
  );

  if (!session?.user) {
    return <div>Please log in</div>;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Welcome, {profile?.user.name || profile?.user.email}!</h1>
      <p>Session expires: {profile?.session.expiresAt}</p>
    </div>
  );
}
```
