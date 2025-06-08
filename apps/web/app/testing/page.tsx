import { AuthDemo } from "@/components/testing/auth-demo";
import { ExampleTRPCUsage } from "@/components/testing/example-trpc-usage";
import { UserProfile } from "@/components/auth/user-profile";
import { AuthDebug } from "@/components/testing/auth-debug";

export default function TestingPage() {
  return (
    <div className="container mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold mb-8">Testing</h1>
      <AuthDebug />
      <AuthDemo />
      <ExampleTRPCUsage />
      <UserProfile />
    </div>
  );
}
