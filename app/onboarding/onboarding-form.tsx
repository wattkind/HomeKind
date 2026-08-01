"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("create_household_with_defaults", {
      p_name: name,
    });

    if (rpcError) {
      setSubmitting(false);
      setError("We couldn't create your household. Give it a name between 1 and 80 characters and try again.");
      return;
    }

    router.push("/home");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error ? (
        <div className="banner error" role="alert" style={{ marginBottom: "20px" }}>
          <p>{error}</p>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="household-name">Household name</label>
        <input
          id="household-name"
          name="household-name"
          type="text"
          required
          maxLength={80}
          placeholder="e.g. The Smith Family"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <p className="hint">We'll set up Kitchen, Living Room, Laundry and Garage rooms to start you off.</p>
      </div>

      <div className="form-actions">
        <button type="submit" className="button" disabled={submitting || name.trim().length === 0}>
          {submitting ? "Creating…" : "Create household"}
        </button>
      </div>
    </form>
  );
}
