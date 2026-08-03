-- flow_posts was added after the initial migration enabled RLS on the other
-- public tables. The app accesses it only through the server-side service role,
-- so no anon or authenticated policies are required.
alter table public.flow_posts enable row level security;
