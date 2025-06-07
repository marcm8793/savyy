"use client";

export function ExampleTRPCUsage() {
  // Example query using the new TanStack Query integration
  // This would correspond to a procedure in your server router
  // For example: trpc.auth.getProfile.queryOptions()

  // Example of how to use a query (replace with actual procedures from your router)
  // const profileQuery = useQuery(trpc.auth.getProfile.queryOptions());

  // Example of how to use a mutation (replace with actual procedures from your router)
  // const updateProfileMutation = useMutation(trpc.auth.updateProfile.mutationOptions());

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-xl font-bold mb-4">tRPC + TanStack Query Example</h2>

      <div className="space-y-4">
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
            {`// Query example
const profileQuery = useQuery(trpc.auth.getProfile.queryOptions());

// Mutation example
const updateProfileMutation = useMutation(
  trpc.auth.updateProfile.mutationOptions()
);

// Using the data
if (profileQuery.data) {
  console.log('User profile:', profileQuery.data);
}

// Triggering a mutation
updateProfileMutation.mutate({ name: 'New Name' });`}
          </pre>
        </div>

        <div>
          <p className="text-sm text-gray-600">
            Replace the commented examples above with actual procedures from
            your server router. The tRPC client is properly configured and ready
            to use!
          </p>
        </div>
      </div>
    </div>
  );
}
