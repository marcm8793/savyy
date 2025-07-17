import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

export interface User {
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

export interface UseUserResult {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: unknown;
}

/**
 * Custom hook that provides user data
 *
 * This hook prioritizes tRPC session data over Better Auth session data.
 *
 * Data Priority:
 * 1. tRPC session data - PRIMARY
 * 2. Better Auth session data (for authentication state) - FALLBACK
 *
 * @returns User data with proper loading states
 */
export function useUser(): UseUserResult {
  // Get Better Auth session for authentication state
  const {
    data: session,
    isPending: sessionLoading,
    error: sessionError,
  } = useSession();

  // Get tRPC session data which contains user information
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

  // Get user data - prioritize tRPC data
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
 * Generates initials from first and last name
 */
function generateInitials(
  firstName?: string | null,
  lastName?: string | null,
  fallbackName?: string
): string {
  if (firstName && lastName) {
    return `${firstName.charAt(0).toUpperCase()}${lastName
      .charAt(0)
      .toUpperCase()}`;
  }

  if (firstName) {
    return firstName.charAt(0).toUpperCase();
  }

  if (lastName) {
    return lastName.charAt(0).toUpperCase();
  }

  if (fallbackName) {
    const names = fallbackName.split(" ");
    if (names.length >= 2) {
      return `${names[0].charAt(0).toUpperCase()}${names[1]
        .charAt(0)
        .toUpperCase()}`;
    }
    return names[0].charAt(0).toUpperCase();
  }

  return "U";
}

/**
 * Hook specifically for getting user display data with fallbacks
 *
 * @returns User data suitable for UI display with proper fallbacks
 */
export function useUserDisplayData() {
  const { user, isLoading, isAuthenticated } = useUser();

  if (isLoading) {
    return {
      name: "Loading...",
      email: "Loading...",
      avatar: null,
      initials: "L",
      isLoading: true,
    };
  }

  if (!user || !isAuthenticated) {
    return {
      name: "Guest",
      email: "",
      avatar: null,
      initials: "G",
      isLoading: false,
    };
  }

  const initials = generateInitials(user.firstName, user.lastName, user.name);

  return {
    name: user.name || user.email || "User",
    email: user.email || "",
    avatar: user.image || null,
    initials,
    isLoading: false,
  };
}
