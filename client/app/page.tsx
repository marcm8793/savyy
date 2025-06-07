import { ExampleTRPCUsage } from "../components/example-trpc-usage";
import { AuthDemo } from "../components/auth/auth-demo";
import { UserProfile } from "@/components/auth/user-profile";
import { AuthDebug } from "@/components/auth/auth-debug";

export default function Home() {
  return (
    <div className="container mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold mb-8">Savyy - Personal Finance App</h1>
      <AuthDebug />
      <AuthDemo />
      <ExampleTRPCUsage />
      <UserProfile />
    </div>
  );
}
