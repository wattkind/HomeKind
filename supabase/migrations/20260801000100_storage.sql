-- Private Storage bucket for device manuals/receipts.
--
-- Note: row level security on storage.objects is already enabled by Supabase
-- itself (it is a Supabase-managed table) -- this migration only adds the
-- bucket and a policy, it does not (and must not) ALTER TABLE storage.objects
-- to enable RLS.
--
-- Objects live under households/<household_id>/devices/<device_id>/<uuid>.<ext> .

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('device-documents', 'device-documents', false, 52428800,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- storage.foldername(name) splits the object path on '/' into a text[].
-- For a path like 'households/<household_id>/devices/<device_id>/<uuid>.<ext>':
--   [1] = 'households'        (the literal path prefix, not data)
--   [2] = '<household_id>'    (the tenant scope we check membership against)
--   [3] = 'devices'
--   [4] = '<device_id>'
-- so (storage.foldername(name))[2] is the household id.
--
-- Guard against malformed paths before the ::uuid cast, which would otherwise
-- raise a policy-evaluation error (rather than just deny access) on a
-- non-uuid or too-short path: require the 'households/' prefix and at least
-- 3 folder segments, and use a regex check so a non-uuid second segment
-- fails the `like` match instead of reaching the cast.
create policy device_documents_own_household on storage.objects for all
  using (
    bucket_id = 'device-documents'
    and name like 'households/%'
    and array_length(storage.foldername(name), 1) >= 3
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and (storage.foldername(name))[2]::uuid in (select public.current_household_ids())
  )
  with check (
    bucket_id = 'device-documents'
    and name like 'households/%'
    and array_length(storage.foldername(name), 1) >= 3
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and (storage.foldername(name))[2]::uuid in (select public.current_household_ids())
  );
comment on policy device_documents_own_household on storage.objects is
  'Scopes device-documents bucket access to members of the household named in the path (households/<household_id>/devices/<device_id>/<file>). The regex guard ensures a malformed or non-uuid path segment fails the policy predicate rather than erroring the ::uuid cast.';
