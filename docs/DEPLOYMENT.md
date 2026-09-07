# Deployment runbook

HomeKind deploys as a Next.js app on Vercel (`syd1`) backed by a Supabase project. This is the
step-by-step guide for standing up a new environment or reproducing production. It is written
to be honest about what is manual — none of this is automated end-to-end yet.

## (a) Supabase

1. Create a new Supabase project in region **ap-southeast-2** (Sydney) — this matches the
   Vercel deployment region (`syd1`) so the app and database are co-located.
2. Link the local checkout to it and push the migrations:

   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

   This applies the two migrations in `supabase/migrations/`: the initial schema (households,
   membership, invites, rooms, devices, documents, push subscriptions, warranty
   notifications, AI usage, and their Row Level Security policies) and the `device-documents`
   Storage bucket + its RLS policy.
3. In **Authentication → Providers**, confirm the **Email** provider is enabled (it is
   HomeKind's only sign-in method).
4. In **Authentication → URL Configuration**, set:
   - **Site URL**: `https://homekind.wattkind.ai`
   - **Additional Redirect URLs**:
     - `http://localhost:3000/auth/callback`
     - `https://homekind.wattkind.ai/auth/callback`
5. From **Project Settings → API**, copy:
   - the project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - the `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - the `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose to the
     client or commit it)

## (b) VAPID keys (Web Push)

Generate a key pair once per environment:

```bash
node scripts/generate-vapid.mjs
```

This prints `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` ready to paste into the
environment variables below. Set `VAPID_CONTACT=mailto:support@wattkind.ai` alongside them.

## (c) Vercel

1. Create a new Vercel project from the `red3112/HomeKind` GitHub repository.
2. Region is fixed by `vercel.json` (`"regions": ["syd1"]`) — no manual region selection needed.
3. Set the **Production Branch** to `main`.
4. Add the environment variables below. Set values directly in the Vercel dashboard —
   **never commit real values** to `.env.example` or anywhere else in the repository.

   | Variable | Production | Preview |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | yes | yes (preview/staging project if you run one) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | yes |
   | `SUPABASE_SERVICE_ROLE_KEY` | yes | yes |
   | `ANTHROPIC_API_KEY` | yes | yes |
   | `AI_ENABLED` | yes | yes |
   | `GLOBAL_BUDGET_CAP_USD` | yes | yes |
   | `CRON_SECRET` | yes | optional (only needed if you manually trigger the cron route in Preview) |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | yes | yes |
   | `VAPID_PRIVATE_KEY` | yes | yes |
   | `VAPID_CONTACT` | yes | yes |
   | `NEXT_PUBLIC_SITE_URL` | yes (`https://homekind.wattkind.ai`) | yes (the Preview deployment's own URL) |
   | `NEXT_PUBLIC_AUTOFETCH_ENABLED` | yes | yes |

   `TENANCY_TEST_URL` / `TENANCY_TEST_ANON_KEY` / `TENANCY_TEST_SERVICE_ROLE_KEY` are local-only
   test variables (see `tests/tenancy/tenancy.test.ts`) and must never be set in Vercel.

   **`AI_ENABLED`, `NEXT_PUBLIC_AUTOFETCH_ENABLED` and `GLOBAL_BUDGET_CAP_USD` are deployment
   ceilings, not the only controls.** Each household also has its own switches under
   *Settings → AI assistant* (`households.ai_enabled`, `households.manual_autofetch_enabled`,
   `households.ai_monthly_budget_usd`). The two layers are ANDed in `lib/ai/settings.ts`, so a
   deployment can always force a feature off and no stored row can turn it back on — which is
   what keeps a preview/dev deployment from spending on the production key. A household budget
   (including `0`) overrides `GLOBAL_BUDGET_CAP_USD`; leaving the household value null falls back
   to it.

5. **Cron**: the warranty-check job is already defined in `vercel.json`
   (`"crons": [{ "path": "/api/cron/warranty-check", "schedule": "0 21 * * *" }]`) — nothing to
   configure in the dashboard beyond setting `CRON_SECRET`. When that environment variable is
   set, Vercel automatically sends it as an `Authorization: Bearer <CRON_SECRET>` header on its
   own scheduled invocations of the route; the route itself refuses to run at all
   (`503 cron_disabled`) if `CRON_SECRET` is unset, and rejects any request whose header doesn't
   match (`401 unauthorized`). See `app/api/cron/warranty-check/route.ts`.

## (d) Cloudflare DNS

`wattkind.ai` is the Cloudflare-managed zone the WattKind AI properties share. Following the
same house rules as the other WattKind AI properties (see `red3112/WattKind-AI`'s
`deployments.md`):

1. In the Vercel project, add `homekind.wattkind.ai` as a **Custom Domain** first. Vercel will
   show you the exact CNAME target to create.
2. In the Cloudflare `wattkind.ai` zone, create that **exact** CNAME record, **unproxied**
   (grey cloud, DNS-only).
3. Never proxy this record through Cloudflare, never attach the apex `wattkind.ai` to this
   Vercel project, and never point it at the WattKind Cloudflare Pages project — that project
   serves the separate public WattKind AI website, not HomeKind.

## (e) Service worker caching

`public/sw.js` must never be cached long-term at the edge. Next.js's own static file serving
for `public/` uses sensible cache defaults for this file, so there is nothing to configure by
default. If a Cloudflare cache rule is ever added that covers `homekind.wattkind.ai` (there
isn't one today — the DNS record above is unproxied), explicitly exclude `/sw.js` from it, or a
stale service worker could get stuck serving an old app shell indefinitely.

## (f) Post-deploy smoke test

Run through this after every production deploy:

1. Sign up with a fresh email and confirm the account (Supabase Auth email flow).
2. Complete onboarding (creates a household with its four default rooms).
3. Add a device and attach a manual document.
4. Confirm the warranty banner appears/behaves correctly for a device with a near-term
   `warranty_end` date.
5. Manually trigger the cron route to confirm it runs end-to-end:

   ```bash
   curl -i https://homekind.wattkind.ai/api/cron/warranty-check \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

   Expect a `200` with a JSON body like `{"checked":N,"sent":N,"deduped":N,"pruned":N}`.
6. Subscribe to push notifications from the app and confirm a real push arrives (e.g. by
   temporarily lowering a device's warranty end date and re-running the cron trigger above).
7. Open a device's AI chat and ask a question answerable from its attached manual; confirm a
   grounded answer streams back.

## (g) iOS install note

Web Push on iOS (16.4+) only works from an **installed** PWA (Add to Home Screen) — it does not
work in Safari tabs. Include this in any user-facing onboarding copy about push notifications
on iOS.

## Contact

support@wattkind.ai

© 2026 WattKind AI
