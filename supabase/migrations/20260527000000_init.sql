-- IG accounts
create table ig_accounts (
  id uuid primary key default gen_random_uuid(),
  ig_business_account_id text not null unique,
  fb_page_id text not null,
  page_access_token_enc bytea not null,
  name text not null,
  default_language text not null default 'tr',
  email_provider_config jsonb not null default '{"kind":"none"}'::jsonb,
  created_at timestamptz not null default now()
);

-- Posts
create table posts (
  id uuid primary key default gen_random_uuid(),
  ig_account_id uuid not null references ig_accounts(id) on delete cascade,
  ig_media_id text not null unique,
  caption_excerpt text,
  permalink text,
  monitored boolean not null default false,
  created_at timestamptz not null default now()
);
create index posts_ig_account_idx on posts(ig_account_id, monitored);

-- Flows
create table flows (
  id uuid primary key default gen_random_uuid(),
  ig_account_id uuid not null references ig_accounts(id) on delete cascade,
  name text not null,
  language text not null default 'tr',
  trigger_type text not null check (trigger_type in ('comment','dm','story_reply')),
  trigger_keywords text[] not null default '{}',
  post_id uuid references posts(id) on delete set null,
  steps jsonb not null default '[]'::jsonb,
  email_capture_enabled boolean not null default false,
  email_provider text not null default 'none',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index flows_lookup_idx on flows(ig_account_id, trigger_type, archived);

-- Contacts
create table contacts (
  id uuid primary key default gen_random_uuid(),
  ig_account_id uuid not null references ig_accounts(id) on delete cascade,
  ig_user_id text not null,
  ig_username text,
  language text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(ig_account_id, ig_user_id)
);

-- Conversation state
create table conversation_state (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null unique references contacts(id) on delete cascade,
  current_flow_id uuid references flows(id) on delete set null,
  current_step_id text,
  awaiting_input_type text check (awaiting_input_type in ('email','button','text') or awaiting_input_type is null),
  context jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Messages log
create table messages_log (
  id uuid primary key default gen_random_uuid(),
  ig_account_id uuid not null references ig_accounts(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  direction text not null check (direction in ('in','out')),
  message_type text not null,
  payload jsonb not null,
  meta_message_id text unique,
  error jsonb,
  sent_at timestamptz not null default now()
);
create index messages_log_contact_idx on messages_log(contact_id, sent_at desc);
create index messages_log_failures_idx on messages_log(ig_account_id, sent_at desc) where error is not null;

-- Links and click tracking
create table links (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references flows(id) on delete cascade,
  step_id text not null,
  label text not null,
  destination_url text not null,
  created_at timestamptz not null default now()
);

create table link_codes (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references links(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  code text not null unique,
  first_clicked_at timestamptz,
  created_at timestamptz not null default now()
);
create index link_codes_code_idx on link_codes(code);

create table clicks (
  id uuid primary key default gen_random_uuid(),
  link_code_id uuid not null references link_codes(id) on delete cascade,
  ip_hash text not null,
  user_agent text,
  clicked_at timestamptz not null default now()
);

-- Email subscribers
create table email_subscribers (
  id uuid primary key default gen_random_uuid(),
  ig_account_id uuid not null references ig_accounts(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  email text not null,
  consent_at timestamptz not null,
  consent_text_version text not null,
  source_flow_id uuid references flows(id) on delete set null,
  provider_id text,
  status text not null check (status in ('pending','confirmed','unsubscribed','deleted')),
  created_at timestamptz not null default now()
);

-- Consent log (append-only)
create table consent_log (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete set null,
  consent_type text not null check (consent_type in ('privacy_footer','email_capture','deletion')),
  consent_text_version text not null,
  granted_at timestamptz not null default now(),
  dm_message_id uuid references messages_log(id) on delete set null
);

-- Deletion requests
create table deletion_requests (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete set null,
  requested_via text not null check (requested_via in ('dm','admin','email')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'pending' check (status in ('pending','completed'))
);

-- Enable RLS everywhere; service role bypasses RLS
alter table ig_accounts enable row level security;
alter table posts enable row level security;
alter table flows enable row level security;
alter table contacts enable row level security;
alter table conversation_state enable row level security;
alter table messages_log enable row level security;
alter table links enable row level security;
alter table link_codes enable row level security;
alter table clicks enable row level security;
alter table email_subscribers enable row level security;
alter table consent_log enable row level security;
alter table deletion_requests enable row level security;

-- Prevent UPDATE/DELETE on consent_log even via the API (service role bypasses, used only on hard erasure to NULL contact_id)
create policy consent_log_insert on consent_log for insert with check (false);
create policy consent_log_select on consent_log for select using (false);
