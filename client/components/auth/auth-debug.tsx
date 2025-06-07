"use client";

import { useSession } from "../../lib/auth-client";
import { trpc } from "../../lib/trpc";
import { config } from "../../lib/config";

export function AuthDebug() {
  const {
    data: session,
    isPending: sessionLoading,
    error: sessionError,
  } = useSession();
  const trpcSessionQuery = trpc.auth.getSession.useQuery();

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
                <strong>Email:</strong> {session.user?.email}
              </p>
              <p>
                <strong>Name:</strong> {session.user?.name || "Not set"}
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
