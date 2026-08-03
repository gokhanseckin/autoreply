-- This RPC performs privileged, irreversible data erasure. Keep SECURITY
-- DEFINER for the server-side service-role call, but remove it from the public
-- API roles and use an empty search path to prevent object-shadowing attacks.
create or replace function public.erase_contact(p_contact_id uuid, p_requested_via text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
begin
  insert into public.deletion_requests (contact_id, requested_via, status)
  values (p_contact_id, p_requested_via, 'pending')
  returning id into v_request_id;

  update public.email_subscribers
    set email = 'deleted:' || id::text, status = 'deleted'
    where contact_id = p_contact_id;

  update public.messages_log
    set payload = '{"redacted":true}'::jsonb
    where contact_id = p_contact_id;

  update public.consent_log
    set contact_id = null
    where contact_id = p_contact_id;

  delete from public.contacts where id = p_contact_id;

  update public.deletion_requests
    set status = 'completed', processed_at = pg_catalog.now(), contact_id = null
    where id = v_request_id;
end;
$$;

revoke execute on function public.erase_contact(uuid, text) from public, anon, authenticated;
grant execute on function public.erase_contact(uuid, text) to service_role;
