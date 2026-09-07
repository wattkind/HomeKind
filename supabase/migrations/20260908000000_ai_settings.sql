-- === Household-level AI settings ================================================
--
-- Before this migration the three AI switches were deployment environment
-- variables only (AI_ENABLED, NEXT_PUBLIC_AUTOFETCH_ENABLED,
-- GLOBAL_BUDGET_CAP_USD), so a household had no way to turn the assistant or
-- the manual auto-fetch off, and no way to see or change what it was allowed
-- to spend. These columns move that control into the product.
--
-- Layering rule (enforced in lib/ai/settings.ts, not here): the environment
-- stays a hard ceiling and these columns can only narrow it. A deployment
-- with AI_ENABLED=false or no ANTHROPIC_API_KEY (the dev instance) stays off
-- no matter what a row says. That keeps the "dev must never spend" guarantee
-- a property of the deployment rather than of data anyone can edit.

alter table households
  add column ai_enabled boolean not null default true,
  add column manual_autofetch_enabled boolean not null default true,
  add column ai_monthly_budget_usd numeric(10, 2);

comment on column households.ai_enabled is
  'Household switch for every AI feature (device chat + manual auto-fetch). ANDed with the deployment''s AI_ENABLED/ANTHROPIC_API_KEY -- it can only turn AI off, never on.';
comment on column households.manual_autofetch_enabled is
  'Household switch for the web-search manual lookup specifically. Independent of ai_enabled so a household can keep device chat but stop paying for lookups; ANDed with ai_enabled and with NEXT_PUBLIC_AUTOFETCH_ENABLED.';
comment on column households.ai_monthly_budget_usd is
  'Per-calendar-month (UTC) AI spend cap in USD for this household. NULL means "fall back to the deployment GLOBAL_BUDGET_CAP_USD"; 0 means a real cap of zero (no spend allowed). See lib/ai/usage.ts budgetExhausted().';

-- 0 is a meaningful value (a hard stop), so only negatives are rejected. The
-- upper bound is a sanity guard against a fat-fingered cap, not a policy.
alter table households
  add constraint households_ai_monthly_budget_usd_check
  check (ai_monthly_budget_usd is null or (ai_monthly_budget_usd >= 0 and ai_monthly_budget_usd <= 10000));

-- No new RLS policy is needed and none should be added: households already
-- carries households_own_household (SELECT for any member, via
-- current_household_ids()) and households_own_household_update (UPDATE only
-- where owner_id = auth.uid()). That is exactly the split we want here --
-- every member can read whether AI is on, only the owner can change what the
-- household is allowed to spend.
