-- Atomic contact erasure. Replaces the previous non-transactional TS sequence so a
-- mid-way failure can't strand deletion_requests in 'pending' with partial deletion.
create or replace function erase_contact(p_contact_id uuid, p_requested_via text)
returns void
language plpgsql
security definer
as $$
declare
  v_request_id uuid;
begin
  insert into deletion_requests (contact_id, requested_via, status)
  values (p_contact_id, p_requested_via, 'pending')
  returning id into v_request_id;

  update email_subscribers
    set email = 'deleted:' || id::text, status = 'deleted'
    where contact_id = p_contact_id;

  update messages_log set payload = '{"redacted":true}'::jsonb where contact_id = p_contact_id;
  update consent_log set contact_id = null where contact_id = p_contact_id;
  delete from contacts where id = p_contact_id;

  update deletion_requests
    set status = 'completed', processed_at = now(), contact_id = null
    where id = v_request_id;
end;
$$;
