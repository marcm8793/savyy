"use client";

import { config } from "../lib/config";

export function ExampleTRPCUsage() {
  // Example of how to use queries and mutations with the new setup
  // Uncomment these when you have actual procedures in your router:

  // import { trpc } from "../lib/trpc";
  // const sessionQuery = trpc.auth.getSession.useQuery();
  // const updateProfileMutation = trpc.auth.updateProfile.useMutation();

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-xl font-bold mb-4">tRPC Connection Status</h2>

      <div className="space-y-4">
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
          <h3 className="font-semibold">Available tRPC Procedures:</h3>
          <ul className="list-disc list-inside text-sm text-gray-600">
            <li>trpc.auth.* - Authentication procedures</li>
            <li>trpc.transaction.* - Transaction procedures</li>
            <li>trpc.account.* - Account procedures</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold">Usage Examples:</h3>
          <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto">
            {`// Import the trpc hooks
import { trpc } from "../lib/trpc";

// Query example
const sessionQuery = trpc.auth.getSession.useQuery();

// Mutation example
const updateProfileMutation = trpc.auth.updateProfile.useMutation();

// Using the data
if (sessionQuery.data) {
  console.log('Session:', sessionQuery.data);
}

// Triggering a mutation
updateProfileMutation.mutate({ name: 'New Name' });`}
          </pre>
        </div>

        <div className="p-3 bg-green-50 border border-green-200 rounded">
          <p className="text-sm text-green-800">
            ✅ tRPC client is properly configured and ready to use!
            <br />
            All server URLs are now centralized in <code>lib/config.ts</code>
          </p>
        </div>
      </div>
    </div>
  );
}
