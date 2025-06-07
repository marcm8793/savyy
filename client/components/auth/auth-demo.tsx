"use client";

import { useState } from "react";
import { useSession } from "../../lib/auth-client";
import { SignInForm } from "./sign-in-form";
import { SignUpForm } from "./sign-up-form";
import { UserProfile } from "./user-profile";

type AuthMode = "signin" | "signup";

export function AuthDemo() {
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="p-6 border rounded-lg dark:bg-gray-800">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Loading...</span>
        </div>
      </div>
    );
  }

  // If user is authenticated, show profile
  if (session?.user) {
    return <UserProfile />;
  }

  // If not authenticated, show auth forms
  return (
    <div className="space-y-6 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Authentication Demo</h1>
        <p className="text-gray-600 mb-6">
          Sign in or create an account to test Better Auth + tRPC integration
        </p>

        {/* Auth Mode Toggle */}
        <div className="flex justify-center mb-6">
          <div className="bg-gray-100 p-1 rounded-lg dark:bg-gray-800">
            <button
              onClick={() => setAuthMode("signin")}
              className={`px-4 py-2 rounded-md transition-colors ${
                authMode === "signin"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthMode("signup")}
              className={`px-4 py-2 rounded-md transition-colors ${
                authMode === "signup"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>

      {/* Render appropriate form */}
      {authMode === "signin" ? <SignInForm /> : <SignUpForm />}

      {/* Additional Info */}
      <div className="max-w-md mx-auto p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">What this demo shows:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Better Auth email/password authentication</li>
          <li>• tRPC integration with authentication context</li>
          <li>• TanStack Query for reactive data fetching</li>
          <li>• Session management across client and server</li>
          <li>• Real-time session updates</li>
        </ul>
      </div>
    </div>
  );
}
