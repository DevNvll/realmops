import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: window.location.origin, // Uses Vite proxy
  plugins: [adminClient()],
});

export const {
  useSession,
  signIn,
  signOut,
  signUp,
} = authClient;

// Check if setup is needed (no users exist)
export async function checkSetupStatus(): Promise<{ needsSetup: boolean }> {
  const response = await fetch("/api/auth/setup-status", {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to check setup status");
  }
  return response.json();
}
