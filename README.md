# HomeKind

HomeKind is a WattKind AI property: it keeps every household device's manuals, receipts and
warranties in one place, and answers questions about a specific appliance using its own manual.

It is a multi-tenant web app built for a household (not a single user): everyone in the
household can add devices, attach documents and browse the same shared library, an owner
manages membership and invites, and warranty-expiry reminders go out to whoever wants them,
by push notification or an in-app banner.

## What it does

- **Devices** — one record per appliance/electronic item: name, brand, model number, purchase
  date and price, warranty end date, and an optional room (Kitchen, Living Room, Laundry,
  Garage by default, or any room the household adds).
- **Documents** — manuals, receipts and other files attached to a device, stored privately per
  household in Supabase Storage.
- **Auto-fetch** — optional lookup of manual/receipt metadata from a scanned barcode or model
  number, to save manual entry (can be switched off).
- **Warranty tracking** — a banner in the app and, if the household opts in, a push
  notification ahead of a warranty's end date, on a per-member lead time (30/60/90 days).
- **Per-device AI chat** — ask a question about one device and get an answer grounded in that
  device's own manual, not a generic web answer.
- **Households and invites** — multiple people per household, an invite flow to add members,
  and an owner role for managing that membership.
- **Offline** — the app shell and previously-opened manuals are available offline as an
  installable PWA.

## Stack

- [Next.js 15](https://nextjs.org/) (App Router), TypeScript in strict mode
- [Supabase](https://supabase.com/) — Postgres, Auth, Storage, Row Level Security
- [Vercel](https://vercel.com/) — hosting, cron (warranty check), region `syd1`
- [Anthropic](https://www.anthropic.com/) (`@anthropic-ai/sdk`) — the per-device AI chat
- Web Push (`web-push`) for warranty reminders
- [Vitest](https://vitest.dev/) for unit tests

## Local development

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` (never commit it). For a local Supabase stack:

```bash
npx supabase start
npx supabase db push
```

`npx supabase status -o env` prints the local URL/anon key/service-role key to paste into
`.env.local`. Then:

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serve a production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Run the Vitest suite once |
| `npm run verify` | Lint, typecheck, test and build, in that order — the full pre-push check |
| `node scripts/generate-vapid.mjs` | Generate a VAPID key pair for Web Push (see `.env.example`) |
| `node scripts/generate-brand.mjs` | Regenerate the logo, favicon, PWA icon and social-card set from the approved mark |

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full runbook: Supabase project setup and
migrations, VAPID keys, the Vercel project and environment variables, Cloudflare DNS for
`homekind.wattkind.ai`, and a post-deploy smoke test.

## Feature areas

Roughly in the order they were built:

- **Database** — households, membership, invites, rooms, devices, documents, push
  subscriptions, warranty notifications and AI usage tracking, all under Row Level Security
  scoped to household membership (see `supabase/migrations/`).
- **Auth, households and invites** — sign-up/sign-in, onboarding into a household, invite
  links to add members.
- **Devices, rooms and documents** — the core device library and its attached files.
- **Offline** — a service worker caching the app shell and opened manuals, installable as a
  PWA.
- **Warranty tracking** — the in-app banner and a daily cron job (`vercel.json`) that sends
  push notifications for warranties approaching their end date, without repeating a
  notification already sent.
- **Per-device AI chat** — a chat scoped to one device, answering from that device's manual
  only (see `prompts/PROMPTS.md` for the model/prompt catalogue).
- **Tests and docs** — the unit test suite, the tenancy isolation suite, and this
  documentation.

## Tests

`npm run test` runs everything under `tests/`. Most of it is plain unit tests with no external
dependencies. `tests/tenancy/tenancy.test.ts` is different: it proves Row Level Security keeps
one household's data from another's, against a *real* Supabase instance, and is skipped
automatically unless `TENANCY_TEST_URL`, `TENANCY_TEST_ANON_KEY` and
`TENANCY_TEST_SERVICE_ROLE_KEY` are set. Only ever point those at a disposable local
`supabase start` stack — never at a hosted project. See the comment at the top of that file
before running it.

## Brand

HomeKind's mark is a house enclosing the WattKind brain-heart — the family relationship
StudyKind makes with a book, HomeKind makes with a home. The approved artwork, the lockups,
the type and the usage rules are in [`docs/BRAND.md`](docs/BRAND.md); the assets themselves are
in `public/assets/brand/`, indexed by `public/assets/brand/manifest.json`. Colour, typography
and tone come from the canonical
[WattKind AI brand guide](https://github.com/red3112/WattKind-AI/blob/main/BRAND-GUIDE.md) —
this repository is not an independent brand authority.

Everything raster is derived from one supplied source file by `node scripts/generate-brand.mjs`.
Do not redraw the mark.

## Fonts

`public/assets/fonts/` ships Inter and Nunito, both licensed under the SIL Open Font License
(OFL) — see `Inter-OFL.txt` and `Nunito-OFL.txt` alongside the font files for the full licence
text.

## Contact

support@wattkind.ai

© 2026 WattKind AI
