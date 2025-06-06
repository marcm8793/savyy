# Better Auth + Fastify + tRPC Integration Guide

## Overview

Your authentication setup is already excellent! You're using Better Auth with Fastify and tRPC, which follows all the best practices from the Better Auth documentation.

## Current Setup ✅

### 1. Better Auth Configuration (`src/utils/auth.ts`)

- ✅ Properly configured with Drizzle adapter
- ✅ Email/password authentication enabled
- ✅ Session management configured

### 2. Fastify Integration (`src/index.ts`)

- ✅ Auth handler mounted at `/api/auth/*` (lines 51-88)
- ✅ CORS properly configured
- ✅ tRPC integration working

### 3. tRPC Context (`src/context.ts`)

- ✅ Updated to use Better Auth session API
- ✅ Provides both user and session to procedures

### 4. tRPC Procedures (`src/trpc.ts`)

- ✅ Added `protectedProcedure` for authenticated routes
- ✅ Added `optionalAuthProcedure` for flexible auth
- ✅ Proper error handling for unauthorized access

## Frontend Integration Examples

### React/Next.js Client Setup

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "http://localhost:YOUR_PORT", // Your backend URL
});

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

## Environment Variables

Make sure you have these environment variables set:

```env
# Backend (.env)
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="your-secret-key"
BETTER_AUTH_URL="http://localhost:YOUR_PORT"
CLIENT_ORIGIN="http://localhost:3000"
PORT=4000
```

## File Structure

Your current file structure is perfect:

```
backend/src/
├── index.ts              # ✅ Fastify server with auth handler
├── context.ts            # ✅ tRPC context with Better Auth
├── trpc.ts              # ✅ tRPC procedures with auth middleware
├── utils/
│   └── auth.ts          # ✅ Better Auth configuration
├── middleware/
│   └── authMiddleware.ts # ✅ Fastify auth middleware
└── routers/
    ├── index.ts         # ✅ Main router
    └── authRouter.ts    # ✅ Auth-related tRPC procedures
```

## Key Benefits of Your Setup

1. **Type Safety**: Full TypeScript support across client and server
2. **Session Management**: Better Auth handles cookies and sessions automatically
3. **Flexible Auth**: Support for both protected and optional auth procedures
4. **Framework Agnostic**: Works with React, Vue, Svelte, etc.
5. **Production Ready**: Proper error handling and security practices

## Next Steps

1. **Add more auth providers** (OAuth, magic links, etc.) to Better Auth config
2. **Implement role-based access control** using Better Auth plugins
3. **Add rate limiting** to your auth endpoints
4. **Set up email verification** and password reset flows
5. **Add 2FA support** using Better Auth plugins

Your authentication setup is already following all the best practices from Better Auth! 🎉
