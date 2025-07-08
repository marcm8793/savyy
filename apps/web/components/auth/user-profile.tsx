"use client";

import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../../lib/trpc";
import { useSession, authClient } from "../../lib/auth-client";
import { useRouter } from "next/navigation";
import { useDecryptedUser } from "@/hooks/use-decrypted-user";

export function UserProfile() {
  const queryClient = useQueryClient();
  const router = useRouter();

  // Get decrypted user data
  const { user, isLoading, isAuthenticated, error } = useDecryptedUser();

  // Get session from Better Auth (for comparison/debugging)
  const { data: session } = useSession();

  // Get user profile if authenticated
  const profileQuery = trpc.auth.getProfile.useQuery(
    undefined, // no input needed
    {
      enabled: isAuthenticated,
    }
  );

  // Update profile mutation
  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      // Invalidate and refetch profile data after successful update
      queryClient.invalidateQueries({ queryKey: [["auth", "getProfile"]] });
      queryClient.invalidateQueries({ queryKey: [["auth", "getSession"]] });
    },
  });

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      // Invalidate all queries after sign out
      queryClient.clear();
      // Redirect to home page after successful logout
      router.push("/");
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const handleUpdateProfile = () => {
    const newName = prompt("Enter new first name:", user?.name || "");
    if (newName && newName.trim()) {
      updateProfileMutation.mutate({ name: newName.trim() });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 border rounded-lg">
        <p>Loading user data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border rounded-lg">
        <p className="text-red-600">Error loading user data: {String(error)}</p>
      </div>
    );
  }

  if (!user || !isAuthenticated) {
    return (
      <div className="p-6 border rounded-lg">
        <p className="text-gray-600">Not signed in</p>
      </div>
    );
  }

  return (
    <div className="p-6 border rounded-lg space-y-6">
      <h2 className="text-2xl font-bold">User Profile</h2>

      {/* Main User Information (Decrypted) */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">User Information</h3>
        <div className="bg-green-50 p-4 rounded dark:bg-gray-800">
          <p>
            <strong>Name:</strong> {user.name || "Not set"}
          </p>
          <p>
            <strong>Email:</strong> {user.email}
          </p>
          <p>
            <strong>First Name:</strong> {user.firstName || "Not set"}
          </p>
          <p>
            <strong>Last Name:</strong> {user.lastName || "Not set"}
          </p>
          <p>
            <strong>User ID:</strong> {user.id}
          </p>
          <p>
            <strong>Email Verified:</strong> {user.emailVerified ? "Yes" : "No"}
          </p>
          <p>
            <strong>Role:</strong> {user.role}
          </p>
          <p>
            <strong>Created:</strong>{" "}
            {new Date(user.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Profile Information from tRPC */}
      {isAuthenticated && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Profile Information (tRPC)</h3>
          {profileQuery.isPending ? (
            <p>Loading profile...</p>
          ) : profileQuery.error ? (
            <p className="text-red-600">
              Profile Error: {profileQuery.error.message}
            </p>
          ) : profileQuery.data ? (
            <div className="bg-purple-50 p-4 rounded">
              <p>
                <strong>Profile User:</strong>{" "}
                {profileQuery.data.user.name || profileQuery.data.user.email}
              </p>
              <p>
                <strong>Session Expires:</strong>{" "}
                {new Date(profileQuery.data.session.expiresAt).toLocaleString()}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Technical Details (for debugging) */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Technical Details</h3>
        <div className="bg-gray-50 p-4 rounded dark:bg-gray-800 text-sm">
          <p>
            <strong>Authentication Status:</strong>{" "}
            {isAuthenticated ? "Authenticated" : "Not authenticated"}
          </p>
          <p>
            <strong>Data Source:</strong> Decrypted from tRPC (secure)
          </p>
          {session && (
            <p>
              <strong>Better Auth Session:</strong> Active (email hashed for
              security)
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Actions</h3>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleUpdateProfile}
            disabled={updateProfileMutation.isPending || !isAuthenticated}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {updateProfileMutation.isPending ? "Updating..." : "Update Name"}
          </button>

          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Sign Out
          </button>
        </div>

        {/* Mutation Results */}
        {updateProfileMutation.isSuccess && (
          <p className="text-green-600">Profile updated successfully!</p>
        )}
        {updateProfileMutation.error && (
          <p className="text-red-600">
            Update error: {updateProfileMutation.error.message}
          </p>
        )}
      </div>
    </div>
  );
}
