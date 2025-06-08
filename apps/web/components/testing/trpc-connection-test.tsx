"use client";

import { trpc } from "../../lib/trpc";
import { config } from "../../lib/config";

export function TRPCConnectionTest() {
  // Test the auth.getSession procedure (public, should work without authentication)
  const sessionQuery = trpc.auth.getSession.useQuery();

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h2 className="text-xl font-bold">tRPC Connection Test</h2>

      <div>
        <h3 className="font-semibold">Configuration:</h3>
        <div className="bg-gray-100 p-2 rounded text-sm">
          <p>
            <strong>tRPC URL:</strong> {config.urls.trpc}
          </p>
          <p>
            <strong>Auth URL:</strong> {config.urls.auth}
          </p>
          <p>
            <strong>Environment:</strong>{" "}
            {config.isDevelopment ? "Development" : "Production"}
          </p>
        </div>
      </div>

      <div>
        <h3 className="font-semibold">Connection Test:</h3>
        <div className="bg-gray-50 p-3 rounded">
          <p className="text-sm font-medium">
            Testing auth.getSession procedure:
          </p>

          {sessionQuery.isLoading && (
            <div className="text-blue-600">🔄 Loading...</div>
          )}

          {sessionQuery.error && (
            <div className="text-red-600">
              ❌ Error: {sessionQuery.error.message}
              <details className="mt-2 text-xs">
                <summary>Error Details</summary>
                <pre className="bg-red-50 p-2 rounded mt-1 overflow-x-auto">
                  {JSON.stringify(sessionQuery.error, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {sessionQuery.data && (
            <div className="text-green-600">
              ✅ Success! Connection working.
              <details className="mt-2 text-xs">
                <summary>Response Data</summary>
                <pre className="bg-green-50 p-2 rounded mt-1 overflow-x-auto">
                  {JSON.stringify(sessionQuery.data, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-semibold">Available Procedures:</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="font-medium">Auth Router:</h4>
            <ul className="list-disc list-inside text-gray-600">
              <li>getSession (public)</li>
              <li>getProfile (protected)</li>
              <li>updateProfile (protected)</li>
              <li>deleteAccount (protected)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium">Transaction Router:</h4>
            <ul className="list-disc list-inside text-gray-600">
              <li>getTransactions (protected)</li>
              <li>getTransaction (protected)</li>
              <li>createTransaction (protected)</li>
              <li>updateTransaction (protected)</li>
              <li>deleteTransaction (protected)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium">Account Router:</h4>
            <ul className="list-disc list-inside text-gray-600">
              <li>Available procedures...</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
