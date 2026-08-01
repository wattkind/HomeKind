import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

/**
 * Server-side Supabase client for use in Server Components, Route Handlers
 * and Server Actions. Reads env inside the function body so a build with no
 * env configured never throws at import time.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in Supabase project values.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component with no request/response cycle to
          // write cookies on — safe to ignore as long as middleware.ts is
          // also refreshing the session on every request.
        }
      },
    },
  });
}

/**
 * Returns the signed-in user, or redirects to /login if there isn't one.
 * Always uses getUser() (never getSession()) so identity is verified against
 * the Supabase auth server rather than trusted from an unverified cookie.
 */
export async function requireUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

/**
 * Returns the signed-in user's household membership, or redirects to
 * /onboarding if they don't belong to one yet. v1 expects a single household
 * per user; if more than one membership row exists, the earliest is used.
 */
export async function requireHousehold(): Promise<{
  user: User;
  householdId: string;
  role: "owner" | "member";
}> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  return { user, householdId: membership.household_id, role: membership.role };
}
