# Authentication Setup - Better Auth + tRPC + TanStack Query

This guide explains the complete authentication setup using Better Auth, tRPC, and TanStack Query in your Savyy application.

## Architecture Overview

The authentication system consists of:

1. **Better Auth** - Handles authentication logic, session management, and user data
2. **tRPC** - Provides type-safe API endpoints that respect authentication context
3. **TanStack Query** - Manages client-side state and caching for auth-related data

## Key Components

### Core Setup Files

- `lib/auth-client.ts` - Better Auth client configuration
- `components/auth/` - Authentication UI components
- `server/src/utils/auth.ts` - Better Auth server configuration (already exists)
- `server/src/context.ts` - tRPC context with Better Auth integration (already exists)

### Authentication Components

- `AuthDemo` - Main authentication component with mode switching
- `SignInForm` - Email/password sign-in form
- `SignUpForm` - User registration form
- `UserProfile` - Displays user information and session data

## Usage Examples

### 1. Using Better Auth Session Hook

```tsx
import { useSession } from "../../lib/auth-client";

function MyComponent() {
  const { data: session, isPending, error } = useSession();

  if (isPending) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!session?.user) return <div>Not signed in</div>;

  return <div>Welcome, {session.user.name}!</div>;
}
```

### 2. Combining Better Auth with tRPC

```tsx
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../../lib/trpc";
import { useSession } from "../../lib/auth-client";

function AuthenticatedComponent() {
  const trpc = useTRPC();
  const { data: session } = useSession();

  // tRPC query that requires authentication
  const profileQuery = useQuery({
    ...trpc.auth.getProfile.queryOptions(),
    enabled: session?.user != null,
  });

  return (
    <div>
      {profileQuery.data && <p>Profile: {profileQuery.data.user.name}</p>}
    </div>
  );
}
```

### 3. Authentication Actions

```tsx
import { authClient } from "../../lib/auth-client";

// Sign in
await authClient.signIn.email({
  email: "user@example.com",
  password: "password123",
});

// Sign up
await authClient.signUp.email({
  name: "John Doe",
  email: "user@example.com",
  password: "password123",
});

// Sign out
await authClient.signOut();
```

### 4. Using tRPC Mutations with Authentication

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../../lib/trpc";

function ProfileUpdater() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    ...trpc.auth.updateProfile.mutationOptions(),
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });

  const handleUpdate = () => {
    updateMutation.mutate({ name: "New Name" });
  };

  return (
    <button onClick={handleUpdate} disabled={updateMutation.isPending}>
      {updateMutation.isPending ? "Updating..." : "Update Profile"}
    </button>
  );
}
```

## Authentication Flow

### 1. Session Management

- Better Auth handles session creation and validation
- Sessions are automatically passed to tRPC context
- Client-side session state is reactive via `useSession`

### 2. tRPC Integration

- Server context includes user and session from Better Auth
- Protected procedures automatically have access to authenticated user
- Client requests include session cookies automatically

### 3. Query Invalidation

- Sign in/out triggers query cache invalidation
- Profile updates invalidate related queries
- Reactive UI updates based on authentication state

## Available tRPC Procedures

### Public Procedures

- `trpc.auth.getSession` - Get current session (works for both authenticated and non-authenticated)

### Protected Procedures (require authentication)

- `trpc.auth.getProfile` - Get detailed user profile
- `trpc.auth.updateProfile` - Update user profile
- `trpc.auth.deleteAccount` - Delete user account

## Error Handling

### Better Auth Errors

```tsx
const { data: session, error } = useSession();

if (error) {
  console.error("Session error:", error.message);
}
```

### tRPC Errors

```tsx
const profileQuery = useQuery(trpc.auth.getProfile.queryOptions());

if (profileQuery.error) {
  console.error("tRPC error:", profileQuery.error.message);
}
```

### Authentication Action Errors

```tsx
try {
  await authClient.signIn.email({ email, password });
} catch (error) {
  console.error("Sign in failed:", error);
}
```

## Configuration

### Environment Variables

For production, set these environment variables:

```env
# Client-side (Next.js)
NEXT_PUBLIC_AUTH_URL=https://your-domain.com

# Server-side (already configured)
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=https://your-domain.com
CLIENT_ORIGIN=https://your-client-domain.com
```

### Development Setup

1. **Start the server** (port 3000)
2. **Start the client** with `npm run dev`
3. **Visit the homepage** to see the authentication demo
4. **Test sign up/sign in** functionality

## Security Features

### Built-in Security

- CSRF protection via Better Auth
- Secure session management
- Password hashing
- Email verification support
- Session expiration handling

### tRPC Security

- Type-safe API endpoints
- Automatic authentication context
- Protected procedure middleware
- Request validation via Zod schemas

## Troubleshooting

### Common Issues

1. **Session not persisting**

   - Check that cookies are enabled
   - Verify CORS configuration
   - Ensure same-origin requests

2. **tRPC authentication errors**

   - Verify server is running
   - Check Better Auth configuration
   - Ensure context is properly set up

3. **Type errors**
   - Make sure Better Auth types are properly imported
   - Verify tRPC router types are up to date

### Debug Mode

Enable debug logging:

```tsx
// In your auth client setup
export const authClient = createAuthClient({
  baseURL: "http://localhost:3000",
  // Add debug options if available
});
```

## Next Steps

1. **Add social providers** (Google, GitHub, etc.)
2. **Implement email verification**
3. **Add password reset functionality**
4. **Set up role-based access control**
5. **Add two-factor authentication**

## Resources

- [Better Auth Documentation](https://better-auth.com)
- [tRPC Documentation](https://trpc.io)
- [TanStack Query Documentation](https://tanstack.com/query)

The authentication system is now fully integrated and ready for production use!
