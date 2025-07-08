import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

export interface DecryptedUser {
  id: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface UseDecryptedUserResult {
  user: DecryptedUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: unknown;
}

/**
 * Custom hook that provides decrypted user data
 *
 * This hook prioritizes tRPC session data (which contains decrypted emails)
 * over Better Auth session data (which contains hashed emails for security).
 *
 * Data Priority:
 * 1. tRPC session data (contains decrypted email) - PRIMARY
 * 2. Better Auth session data (for authentication state) - FALLBACK
 *
 * @returns Decrypted user data with proper loading states
 */
export function useDecryptedUser(): UseDecryptedUserResult {
  // Get Better Auth session for authentication state
  const {
    data: session,
    isPending: sessionLoading,
    error: sessionError,
  } = useSession();

  // Get tRPC session data which contains decrypted user information
  const trpcSession = trpc.auth.getSession.useQuery(undefined, {
    enabled: !!session?.user, // Only fetch if we have a session
    retry: 3,
    retryDelay: (attemptIndex) => {
      return Math.min(1000 * 2 ** attemptIndex, 30000);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Determine loading state
  const isLoading = sessionLoading || trpcSession.isPending;

  // Determine authentication state
  const isAuthenticated =
    !!session?.user &&
    !trpcSession.error &&
    (trpcSession.data?.isAuthenticated ?? false);

  // Get user data - prioritize decrypted tRPC data
  const user = trpcSession.data?.user || null;

  // Handle errors
  const error = sessionError || trpcSession.error || null;

  return {
    user,
    isLoading,
    isAuthenticated,
    error,
  };
}

/**
 * Hook specifically for getting user display data with fallbacks
 *
 * @returns User data suitable for UI display with proper fallbacks
 */
export function useUserDisplayData() {
  const { user, isLoading, isAuthenticated } = useDecryptedUser();

  if (isLoading) {
    return {
      name: "Loading...",
      email: "Loading...",
      avatar: "/avatars/default.jpg",
      isLoading: true,
    };
  }

  if (!user || !isAuthenticated) {
    return {
      name: "Guest",
      email: "",
      avatar: "/avatars/default.jpg",
      isLoading: false,
    };
  }

  return {
    name: user.name || user.email || "User",
    email: user.email || "",
    avatar: user.image || "/avatars/default.jpg",
    isLoading: false,
  };
}
