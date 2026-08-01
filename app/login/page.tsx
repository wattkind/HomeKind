"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Only allow redirecting back to a path within this site, never to an
// arbitrary external host supplied via ?next=.
function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/home";
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    const supabase = createClient();

    if (mode === "sign-in") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      setSubmitting(false);

      if (signInError) {
        setError("We couldn't sign you in. Check your email and password and try again.");
        return;
      }

      router.push(next);
      router.refresh();
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setSubmitting(false);

    if (signUpError) {
      setError("We couldn't create your account. " + signUpError.message);
      return;
    }

    setNotice("Almost there — we've sent a confirmation link to your email. Follow it to finish setting up your account.");
  }

  return (
    <div className="column" style={{ paddingBlock: "48px" }}>
      <p className="eyebrow">HomeKind</p>
      <h1>{mode === "sign-in" ? "Welcome back" : "Create your account"}</h1>
      <p>
        {mode === "sign-in"
          ? "Sign in to get to your household's devices, manuals and receipts."
          : "Set up an account, then create or join a household."}
      </p>

      <div className="card" style={{ marginTop: "24px" }}>
        {error ? (
          <div className="banner error" role="alert" style={{ marginBottom: "20px" }}>
            <p>{error}</p>
          </div>
        ) : null}
        {notice ? (
          <div className="banner" role="status" style={{ marginBottom: "20px" }}>
            <p>{notice}</p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {mode === "sign-up" ? <p className="hint">At least 8 characters.</p> : null}
          </div>

          <div className="form-actions">
            <button type="submit" className="button" disabled={submitting}>
              {submitting ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
            </button>
          </div>
        </form>

        <p className="form-footnote" style={{ marginTop: "20px" }}>
          {mode === "sign-in" ? (
            <>
              New to HomeKind?{" "}
              <button
                type="button"
                className="text-link"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                onClick={() => {
                  setMode("sign-up");
                  setError(null);
                  setNotice(null);
                }}
              >
                Create an account
              </button>
              .
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="text-link"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                onClick={() => {
                  setMode("sign-in");
                  setError(null);
                  setNotice(null);
                }}
              >
                Sign in
              </button>
              .
            </>
          )}
        </p>
      </div>
    </div>
  );
}
