"use client";

import { useSession } from "../../lib/auth-client";
import { trpc } from "../../lib/trpc";
import { config } from "../../lib/config";
import { useUser } from "@/hooks/use-user";

export function AuthDebug() {
  const {
    data: session,
    isPending: sessionLoading,
    error: sessionError,
  } = useSession();
  const trpcSessionQuery = trpc.auth.getSession.useQuery();
  const {
    user,
    isLoading: userLoading,
    isAuthenticated,
  } = useUser();

  return (
    <div className="p-6 border rounded-lg space-y-4 bg-gray-50 dark:bg-gray-800">
      <h2 className="text-xl font-bold">Authentication Debug</h2>

      {/* Configuration */}
      <div>
        <h3 className="font-semibold">Configuration:</h3>
        <div className="bg-white p-3 rounded text-sm dark:bg-gray-700">
          <p>
            <strong>Auth URL:</strong> {config.urls.auth}
          </p>
          <p>
            <strong>tRPC URL:</strong> {config.urls.trpc}
          </p>
          <p>
            <strong>Environment:</strong>{" "}
            {config.isDevelopment ? "Development" : "Production"}
          </p>
          <p>
            <strong>Base URL:</strong> {config.urls.base}
          </p>
        </div>
      </div>

      {/* Better Auth Session */}
      <div>
        <h3 className="font-semibold">Better Auth Session:</h3>
        <div className="bg-white p-3 rounded text-sm dark:bg-gray-700">
          <p>
            <strong>Loading:</strong> {sessionLoading ? "Yes" : "No"}
          </p>
          <p>
            <strong>Error:</strong>{" "}
            {sessionError ? sessionError.message : "None"}
          </p>
          <p>
            <strong>Session exists:</strong> {session ? "Yes" : "No"}
          </p>
          {session && (
            <>
              <p>
                <strong>User ID:</strong> {session.user?.id}
              </p>
              <p>
                <strong>Email:</strong>{" "}
                <span className="text-blue-600 font-mono text-xs">
                  {session.user?.email}
                </span>
              </p>
              <p>
                <strong>Name:</strong> {session.user?.name || "Not set"}
              </p>
            </>
          )}
        </div>
      </div>

      {/* User Data via tRPC */}
      <div>
        <h3 className="font-semibold">User Data via tRPC:</h3>
        <div className="bg-green-50 p-3 rounded text-sm dark:bg-gray-700">
          <p>
            <strong>Loading:</strong> {userLoading ? "Yes" : "No"}
          </p>
          <p>
            <strong>Authenticated:</strong> {isAuthenticated ? "Yes" : "No"}
          </p>
          <p>
            <strong>User exists:</strong> {user ? "Yes" : "No"}
          </p>
          {user && (
            <>
              <p>
                <strong>User ID:</strong> {user.id}
              </p>
              <p>
                <strong>Email:</strong>{" "}
                <span className="text-green-600 font-semibold">
                  {user.email}
                </span>
              </p>
              <p>
                <strong>Name:</strong> {user.name || "Not set"}
              </p>
              <p>
                <strong>First Name:</strong>{" "}
                {user.firstName || "Not set"}
              </p>
              <p>
                <strong>Last Name:</strong>{" "}
                {user.lastName || "Not set"}
              </p>
            </>
          )}
        </div>
      </div>

      {/* tRPC Session */}
      <div>
        <h3 className="font-semibold">tRPC Session Query:</h3>
        <div className="bg-white p-3 rounded text-sm dark:bg-gray-700">
          <p>
            <strong>Loading:</strong>{" "}
            {trpcSessionQuery.isPending ? "Yes" : "No"}
          </p>
          <p>
            <strong>Error:</strong>{" "}
            {trpcSessionQuery.error ? trpcSessionQuery.error.message : "None"}
          </p>
          <p>
            <strong>Data exists:</strong> {trpcSessionQuery.data ? "Yes" : "No"}
          </p>
          {trpcSessionQuery.data && (
            <>
              <p>
                <strong>Authenticated:</strong>{" "}
                {trpcSessionQuery.data.isAuthenticated ? "Yes" : "No"}
              </p>
              <p>
                <strong>User exists:</strong>{" "}
                {trpcSessionQuery.data.user ? "Yes" : "No"}
              </p>
              <p>
                <strong>Session exists:</strong>{" "}
                {trpcSessionQuery.data.session ? "Yes" : "No"}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Raw Data */}
      <div>
        <h3 className="font-semibold">Raw Data:</h3>
        <details className="bg-white p-3 rounded text-xs dark:bg-gray-700">
          <summary className="cursor-pointer font-medium">
            Better Auth Session Data
          </summary>
          <pre className="mt-2 overflow-x-auto">
            {JSON.stringify(session, null, 2)}
          </pre>
        </details>
        <details className="bg-white p-3 rounded text-xs mt-2 dark:bg-gray-700">
          <summary className="cursor-pointer font-medium">
            tRPC Session Data
          </summary>
          <pre className="mt-2 overflow-x-auto">
            {JSON.stringify(trpcSessionQuery.data, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
