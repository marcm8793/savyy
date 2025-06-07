"use client";

import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../../lib/trpc";
import { useSession, authClient } from "../../lib/auth-client";

export function UserProfile() {
  const queryClient = useQueryClient();

  // Get session from Better Auth
  const {
    data: session,
    isPending: sessionLoading,
    error: sessionError,
  } = useSession();

  // Get session from tRPC (this will use the Better Auth session)
  const trpcSessionQuery = trpc.auth.getSession.useQuery();

  // Get user profile if authenticated
  const profileQuery = trpc.auth.getProfile.useQuery(
    undefined, // no input needed
    {
      enabled: session?.user != null,
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
      window.location.reload(); // Simple reload to update UI
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const handleUpdateProfile = () => {
    const newName = prompt("Enter new name:", session?.user?.name || "");
    if (newName && newName.trim()) {
      updateProfileMutation.mutate({ name: newName.trim() });
    }
  };

  if (sessionLoading) {
    return (
      <div className="p-6 border rounded-lg">
        <p>Loading session...</p>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="p-6 border rounded-lg">
        <p className="text-red-600">Session error: {sessionError.message}</p>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="p-6 border rounded-lg">
        <p className="text-gray-600">Not signed in</p>
      </div>
    );
  }

  return (
    <div className="p-6 border rounded-lg space-y-6">
      <h2 className="text-2xl font-bold">User Profile</h2>

      {/* Better Auth Session Info */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Better Auth Session</h3>
        <div className="bg-blue-50 p-4 rounded">
          <p>
            <strong>Name:</strong> {session.user.name || "Not set"}
          </p>
          <p>
            <strong>Email:</strong> {session.user.email}
          </p>
          <p>
            <strong>User ID:</strong> {session.user.id}
          </p>
          <p>
            <strong>Email Verified:</strong>{" "}
            {session.user.emailVerified ? "Yes" : "No"}
          </p>
          <p>
            <strong>Created:</strong>{" "}
            {new Date(session.user.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      {/* tRPC Session Info */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">tRPC Session</h3>
        {trpcSessionQuery.isPending ? (
          <p>Loading tRPC session...</p>
        ) : trpcSessionQuery.error ? (
          <p className="text-red-600">
            tRPC Error: {trpcSessionQuery.error.message}
          </p>
        ) : (
          <div className="bg-green-50 p-4 rounded">
            <p>
              <strong>Authenticated:</strong>{" "}
              {trpcSessionQuery.data?.isAuthenticated ? "Yes" : "No"}
            </p>
            {trpcSessionQuery.data?.user && (
              <>
                <p>
                  <strong>tRPC User:</strong>{" "}
                  {trpcSessionQuery.data.user.name ||
                    trpcSessionQuery.data.user.email}
                </p>
                <p>
                  <strong>Session ID:</strong>{" "}
                  {trpcSessionQuery.data.session?.id}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Profile Information from tRPC */}
      {session.user && (
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

      {/* Actions */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Actions</h3>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleUpdateProfile}
            disabled={updateProfileMutation.isPending}
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
