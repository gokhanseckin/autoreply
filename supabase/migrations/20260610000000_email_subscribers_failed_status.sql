-- The email step now records 'failed' when the provider call errors, so the
-- row is distinguishable from one still legitimately pending.
alter table email_subscribers drop constraint if exists email_subscribers_status_check;
alter table email_subscribers add constraint email_subscribers_status_check
  check (status in ('pending', 'confirmed', 'unsubscribed', 'deleted', 'failed'));
